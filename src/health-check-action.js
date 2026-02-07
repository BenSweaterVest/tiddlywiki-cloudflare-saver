/*\
title: $:/plugins/BenSweaterVest/cloudflare-saver/health-check-action.js
type: application/javascript
module-type: widget

Action widget to run Cloudflare Function health checks

\*/
(function(){

  'use strict';

  const Widget = require('$:/core/modules/widgets/widget.js').widget;

  const HealthCheckAction = function(parseTreeNode,options) {
    this.initialise(parseTreeNode,options);
  };

  HealthCheckAction.prototype = new Widget();

  HealthCheckAction.prototype.render = function(_parent,_nextSibling) {
    this.computeAttributes();
    this.execute();
  };

  HealthCheckAction.prototype.execute = function() {
    // Nothing to execute
  };

  HealthCheckAction.prototype.refresh = function(_changedTiddlers) {
    return false;
  };

  HealthCheckAction.prototype.invokeAction = async function(_triggeringWidget,_event) {
    const self = this;

    const endpoint = $tw.wiki.getTiddlerText('$:/config/cloudflare-saver/endpoint', '');
    const enabled = $tw.wiki.getTiddlerText('$:/config/cloudflare-saver/enabled', 'no') === 'yes';

    if (!enabled) {
      self.showAlert('Cloudflare Saver is not enabled. Enable it before running health checks.', 'error');
      return true;
    }

    if (!endpoint || endpoint.trim() === '') {
      self.showAlert('No Cloudflare Function endpoint configured. Please enter your endpoint URL.', 'error');
      return true;
    }

    const timeout = Math.max(5, parseInt($tw.wiki.getTiddlerText('$:/config/cloudflare-saver/timeout', '30')) || 30) * 1000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));
      const ready = data?.configuration?.ready;
      const statusText = response.ok ? 'OK' : 'ERROR';
      const title = response.ok ? 'Health Check Passed' : 'Health Check Failed';
      const color = response.ok ? 'green' : 'red';

      const details = [
        `Status: ${statusText} (HTTP ${response.status})`,
        `Version: ${data.version || 'Unknown'}`,
        `Timestamp: ${data.timestamp || 'Unknown'}`,
        `Ready: ${ready === true ? 'Yes' : ready === false ? 'No' : 'Unknown'}`
      ];

      if (data?.configuration) {
        details.push(`GitHub token: ${data.configuration.githubToken || 'unknown'}`);
        details.push(`GitHub repo: ${data.configuration.githubRepo || 'unknown'}`);
        details.push(`Save password: ${data.configuration.savePassword || 'unknown'}`);
      }

      if (data?.rateLimiting) {
        details.push(`Rate limit: ${data.rateLimiting.maxRequests || 'unknown'} per ${data.rateLimiting.window || 'unknown'}`);
      }

      self.showAlert(details.join('\n'), response.ok ? 'success' : 'error', title, color);
    } catch(error) {
      clearTimeout(timeoutId);

      let errorMsg = 'Network error';
      if (error.name === 'AbortError') {
        errorMsg = 'Request timeout';
      } else {
        errorMsg = error.message;
      }

      self.showAlert(`Health check failed.\n\nError: ${errorMsg}`, 'error');
    }

    return true;
  };

  HealthCheckAction.prototype.showAlert = function(message, type, titleOverride, colorOverride) {
    const tempTiddler = '$:/temp/cloudflare-health-check-result';

    let icon = '';
    let title = titleOverride || 'Cloudflare Health Check';
    let color = colorOverride || '';

    if (type === 'success') {
      icon = 'OK';
      title = titleOverride || 'Health Check Passed';
      color = colorOverride || 'green';
    } else if (type === 'error') {
      icon = 'ERROR';
      title = titleOverride || 'Health Check Failed';
      color = colorOverride || 'red';
    }

    const messageLines = message.split('\n').filter(line => line.trim()).join('\n\n');
    const formattedText = `<div style="background-color: ${color === 'green' ? '#d4edda' : '#f8d7da'}; border: 1px solid ${color === 'green' ? '#c3e6cb' : '#f5c6cb'}; border-radius: 4px; padding: 15px; margin: 10px 0;">

!! ${icon} ${title}

${messageLines}

</div>`;

    $tw.wiki.addTiddler(new $tw.Tiddler({
      title: tempTiddler,
      text: formattedText,
      type: 'text/vnd.tiddlywiki',
      'modal-title': title
    }));

    $tw.modal.display(tempTiddler, {
      downloadLink: null
    });
  };

  exports['action-health-check-cloudflare'] = HealthCheckAction;

})();
