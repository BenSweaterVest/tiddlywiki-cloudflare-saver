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

"use strict";

/**
 * CloudflareSaver constructor
 * @param {Object} wiki - TiddlyWiki wiki object
 */
var CloudflareSaver = function(wiki) {
    this.wiki = wiki;
    this.sessionPassword = null; // Store password for session if enabled
};

CloudflareSaver.prototype.save = function(text, method, callback, options) {
    var self = this;
    options = options || {};

    // Check if this saver is enabled
    var enabled = self.wiki.getTiddlerText("$:/config/cloudflare-saver/enabled", "no") === "yes";
    if(!enabled) {
        return false; // Let other savers handle it
    }

    // Only handle saves when explicitly selected
    if(method !== "save") {
        return false;
    }

    var config = {
        endpoint: self.wiki.getTiddlerText("$:/config/cloudflare-saver/endpoint", ""),
        timeout: parseInt(self.wiki.getTiddlerText("$:/config/cloudflare-saver/timeout", "30")) * 1000,
        notifications: self.wiki.getTiddlerText("$:/config/cloudflare-saver/notifications", "yes") === "yes",
        autoRetry: self.wiki.getTiddlerText("$:/config/cloudflare-saver/auto-retry", "yes") === "yes",
        rememberPassword: self.wiki.getTiddlerText("$:/config/cloudflare-saver/remember-password", "no") === "yes",
        debug: self.wiki.getTiddlerText("$:/config/cloudflare-saver/debug", "no") === "yes"
    };

    // Validate configuration
    if(!config.endpoint || config.endpoint.trim() === "") {
        callback("Cloudflare saver not configured. Please set endpoint URL in settings.");
        return false;
    }

    if(config.debug) {
        console.log("[CloudflareSaver] Starting save process");
    }

    var password = null;
    if(config.rememberPassword && self.sessionPassword) {
        password = self.sessionPassword;
    } else {
        password = prompt("Enter Cloudflare save password:");
        if (!password) {
            callback("Cloudflare save cancelled by user");
            return false;
        }
        if(config.rememberPassword) {
            self.sessionPassword = password;
        }
    }

    if(config.notifications && $tw.notifier) {
        $tw.notifier.display("$:/plugins/BenSweaterVest/cloudflare-saver/notifications/saving");
    }

    self._performSave(text, password, callback, config, 0);
    return true;
};

CloudflareSaver.prototype._performSave = function(text, password, callback, config, retryCount) {
    var self = this;
    var maxRetries = config.autoRetry ? 3 : 0;
    
    var xhr = new XMLHttpRequest();
    xhr.open("POST", config.endpoint, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.timeout = config.timeout;
    
    xhr.onload = function() {
        if(xhr.status === 200) {
            if(config.debug) {
                console.log("[CloudflareSaver] Save successful");
            }
            callback(null);
            if(config.notifications && $tw.notifier) {
                $tw.notifier.display("$:/plugins/BenSweaterVest/cloudflare-saver/notifications/success");
            }
        } else {
            self._handleSaveError(xhr, password, text, callback, config, retryCount);
        }
    };
    
    xhr.onerror = function() {
        self._handleSaveError(xhr, password, text, callback, config, retryCount);
    };
    
    xhr.ontimeout = function() {
        self._handleSaveError(xhr, password, text, callback, config, retryCount);
    };
    
    try {
        var payload = {
            content: text,
            password: password,
            timestamp: new Date().toISOString(),
            retryCount: retryCount
        };
        xhr.send(JSON.stringify(payload));
    } catch(e) {
        callback("Failed to send Cloudflare save request: " + e.message);
    }
};

CloudflareSaver.prototype._handleSaveError = function(xhr, password, text, callback, config, retryCount) {
    var self = this;
    var maxRetries = config.autoRetry ? 3 : 0;

    var errorMsg = "Cloudflare save failed";
    if(xhr.status) {
        errorMsg += ": HTTP " + xhr.status;
        if(xhr.statusText) {
            errorMsg += " " + xhr.statusText;
        }
    }

    // Parse response for detailed error information
    if(xhr.responseText) {
        try {
            var response = JSON.parse(xhr.responseText);
            if(response.error) {
                errorMsg += " - " + response.error;
            }
            // Add rate limit information if available
            if(response.resetIn) {
                errorMsg += " (retry in " + response.resetIn + " seconds)";
            }
        } catch(e) {
            if(xhr.responseText.length < 200) {
                errorMsg += " - " + xhr.responseText;
            }
        }
    }

    // Handle specific HTTP status codes
    if(xhr.status === 401) {
        self.sessionPassword = null;
        errorMsg = "Cloudflare authentication failed. Please check your password.";
    } else if(xhr.status === 429) {
        errorMsg = "Rate limit exceeded. Please wait a minute before trying again.";
    } else if(xhr.status === 413) {
        errorMsg = "Content too large. Your TiddlyWiki exceeds the maximum allowed size.";
    } else if(xhr.status === 409) {
        errorMsg = "Conflict detected. Another save may be in progress.";
    }

    if(config.debug) {
        console.error("[CloudflareSaver] Error:", errorMsg, {
            status: xhr.status,
            retryCount: retryCount,
            willRetry: retryCount < maxRetries && xhr.status !== 401
        });
    }

    // Retry logic (don't retry auth failures or rate limits)
    if(retryCount < maxRetries && xhr.status !== 401 && xhr.status !== 429) {
        var retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        if(config.debug) {
            console.log("[CloudflareSaver] Retrying in " + (retryDelay / 1000) + " seconds...");
        }
        setTimeout(function() {
            self._performSave(text, password, callback, config, retryCount + 1);
        }, retryDelay);
    } else {
        callback(errorMsg);
        if(config.notifications && $tw.notifier) {
            $tw.notifier.display("$:/plugins/BenSweaterVest/cloudflare-saver/notifications/failure");
        }
    }
};

CloudflareSaver.prototype.info = {
    name: "cloudflare",
    priority: 1000, // Lower priority so it doesn't override other savers
    capabilities: ["save", "autosave"]
};

// Export module-level functions as required by TiddlyWiki
exports.canSave = function(wiki) {
    // Use $tw.wiki global instead of wiki parameter during initialization
    var enabled = $tw.wiki.getTiddlerText("$:/config/cloudflare-saver/enabled", "no") === "yes";
    return enabled;
};

exports.create = function(wiki) {
    return new CloudflareSaver(wiki);
};

})();

