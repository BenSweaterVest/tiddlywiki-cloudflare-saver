/*\
title: $:/plugins/BenSweaterVest/cloudflare-saver/saver.js
type: application/javascript
module-type: saver

Cloudflare Functions saver for TiddlyWiki - Additional Saver Option

This saver allows TiddlyWiki to save to GitHub via a Cloudflare Function.
It works as an additional save option alongside other savers.

Features:
- Password authentication
- Auto-retry with exponential backoff
- Session password memory
- Visual notifications
- Comprehensive error handling

\*/
(function(){

  'use strict';

  /**
 * CloudflareSaver constructor
 * @param {Object} wiki - TiddlyWiki wiki object
 */
  const CloudflareSaver = function(wiki) {
    this.wiki = wiki;
    this.sessionPassword = null; // Store password for session if enabled

    // Listen for clear password events
    const self = this;
    $tw.rootWidget.addEventListener('cloudflare-clear-password', () => {
      self.sessionPassword = null;
    });
  };

  CloudflareSaver.prototype.save = function(text, method, callback, options) {
    const self = this;
    options = options || {};

    // Check if this saver is enabled
    const enabled = self.wiki.getTiddlerText('$:/config/cloudflare-saver/enabled', 'no') === 'yes';
    if(!enabled) {
      return false; // Let other savers handle it
    }

    // Validate configuration before claiming to handle the save
    const endpoint = self.wiki.getTiddlerText('$:/config/cloudflare-saver/endpoint', '');
    if(!endpoint || endpoint.trim() === '') {
      return false; // Let other savers handle it if not configured
    }

    // We can handle save and autosave methods
    if(method !== 'save' && method !== 'autosave') {
      return false;
    }

    const config = {
      endpoint,
      timeout: Math.max(5, parseInt(self.wiki.getTiddlerText('$:/config/cloudflare-saver/timeout', '30')) || 30) * 1000,
      notifications: self.wiki.getTiddlerText('$:/config/cloudflare-saver/notifications', 'yes') === 'yes',
      autoRetry: self.wiki.getTiddlerText('$:/config/cloudflare-saver/auto-retry', 'yes') === 'yes',
      rememberPassword: self.wiki.getTiddlerText('$:/config/cloudflare-saver/remember-password', 'no') === 'yes',
      debug: self.wiki.getTiddlerText('$:/config/cloudflare-saver/debug', 'no') === 'yes'
    };

    if(config.debug) {
      console.log('[CloudflareSaver] Starting save process');
    }

    let password = null;
    if(config.rememberPassword && self.sessionPassword) {
      password = self.sessionPassword;
    } else {
      password = prompt('Enter Cloudflare save password:');
      if (!password) {
        callback('Cloudflare save cancelled by user');
        return false;
      }
      if(config.rememberPassword) {
        self.sessionPassword = password;
      }
    }

    if(config.notifications && typeof $tw !== 'undefined' && $tw.notifier) {
      $tw.notifier.display('$:/plugins/BenSweaterVest/cloudflare-saver/notifications/saving');
    }

    self._performSave(text, password, callback, config, 0);
    return true;
  };

  CloudflareSaver.prototype._performSave = async function(text, password, callback, config, retryCount) {
    const self = this;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const payload = {
        content: text,
        password,
        timestamp: new Date().toISOString(),
        retryCount
      };

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if(response.ok) {
        if(config.debug) {
          console.log('[CloudflareSaver] Save successful');
        }

        // Update statistics
        self._incrementStat('successful-saves');
        self._updateLastSave('success');

        callback(null);
        if(config.notifications && typeof $tw !== 'undefined' && $tw.notifier) {
          $tw.notifier.display('$:/plugins/BenSweaterVest/cloudflare-saver/notifications/success');
        }
      } else {
        const responseText = await response.text();
        self._handleSaveError(response.status, response.statusText, responseText, password, text, callback, config, retryCount);
      }
    } catch(error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout separately
      if (error.name === 'AbortError') {
        self._handleSaveError(0, 'Request timeout', '', password, text, callback, config, retryCount);
      } else {
        self._handleSaveError(0, 'Network error', error.message, password, text, callback, config, retryCount);
      }
    }
  };

  CloudflareSaver.prototype._handleSaveError = function(status, statusText, responseText, password, text, callback, config, retryCount) {
    const self = this;
    const maxRetries = config.autoRetry ? 3 : 0;

    let errorMsg = 'Cloudflare save failed';
    if(status) {
      errorMsg += `: HTTP ${  status}`;
      if(statusText) {
        errorMsg += ` ${  statusText}`;
      }
    }

    // Parse response for detailed error information
    if(responseText) {
      try {
        const response = JSON.parse(responseText);
        if(response.error) {
          errorMsg += ` - ${  response.error}`;
        }
        // Add rate limit information if available
        if(response.resetIn) {
          errorMsg += ` (retry in ${  response.resetIn  } seconds)`;
        }
      } catch(e) {
        if(responseText.length < 200) {
          errorMsg += ` - ${  responseText}`;
        }
      }
    }

    // Handle specific HTTP status codes
    if(status === 401) {
      self.sessionPassword = null;
      errorMsg = 'Cloudflare authentication failed. Please check your password.';
    } else if(status === 429) {
      errorMsg = 'Rate limit exceeded. Please wait a minute before trying again.';
    } else if(status === 413) {
      errorMsg = 'Content too large. Your TiddlyWiki exceeds the maximum allowed size.';
    } else if(status === 409) {
      errorMsg = 'Conflict detected. Another save may be in progress.';
    }

    if(config.debug) {
      console.error('[CloudflareSaver] Error:', errorMsg, {
        status,
        retryCount,
        willRetry: retryCount < maxRetries && status !== 401
      });
    }

    // Retry logic (don't retry auth failures or rate limits)
    if(retryCount < maxRetries && status !== 401 && status !== 429) {
      const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      if(config.debug) {
        console.log(`[CloudflareSaver] Retrying in ${  retryDelay / 1000  } seconds...`);
      }
      setTimeout(() => {
        self._performSave(text, password, callback, config, retryCount + 1);
      }, retryDelay);
    } else {
      // Update statistics for final failure
      self._incrementStat('failed-saves');
      self._updateLastSave('failure', errorMsg);

      callback(errorMsg);
      if(config.notifications && typeof $tw !== 'undefined' && $tw.notifier) {
        $tw.notifier.display('$:/plugins/BenSweaterVest/cloudflare-saver/notifications/failure');
      }
    }
  };

  CloudflareSaver.prototype._incrementStat = function(statName) {
    const tiddlerTitle = `$:/config/cloudflare-saver/stats/${statName}`;
    const currentValue = parseInt(this.wiki.getTiddlerText(tiddlerTitle, '0')) || 0;
    this.wiki.addTiddler(new $tw.Tiddler({
      title: tiddlerTitle,
      text: String(currentValue + 1)
    }));
  };

  CloudflareSaver.prototype._updateLastSave = function(status, error) {
    const timestamp = new Date().toISOString();
    this.wiki.addTiddler(new $tw.Tiddler({
      title: '$:/config/cloudflare-saver/stats/last-save-status',
      text: status,
      'last-save-time': timestamp,
      'last-save-error': error || ''
    }));
  };

  CloudflareSaver.prototype.info = {
    name: 'cloudflare',
    priority: 2000, // High priority - when enabled, prefer this over download saver
    capabilities: ['save', 'autosave']
  };

  // Export saver info at module level
  exports.info = {
    name: 'cloudflare',
    priority: 2000,
    capabilities: ['save', 'autosave']
  };

  // Export module-level functions as required by TiddlyWiki
  exports.canSave = function(wiki) {
    // Use $tw.wiki global instead of wiki parameter during initialization
    const enabled = $tw.wiki.getTiddlerText('$:/config/cloudflare-saver/enabled', 'no') === 'yes';
    const endpoint = $tw.wiki.getTiddlerText('$:/config/cloudflare-saver/endpoint', '');
    // Only claim we can save if both enabled AND endpoint is configured
    return enabled && endpoint && endpoint.trim() !== '';
  };

  exports.create = function(wiki) {
    return new CloudflareSaver(wiki);
  };

})();
