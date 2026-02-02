/*\
title: $:/plugins/BenSweaterVest/cloudflare-saver/auto-detect-endpoint-action.js
type: application/javascript
module-type: widget

Action widget to auto-detect and set the Cloudflare endpoint URL

\*/
(function(){

  'use strict';

  const Widget = require('$:/core/modules/widgets/widget.js').widget;

  const AutoDetectEndpointAction = function(parseTreeNode,options) {
    this.initialise(parseTreeNode,options);
  };

  AutoDetectEndpointAction.prototype = new Widget();

  AutoDetectEndpointAction.prototype.render = function(_parent,_nextSibling) {
    this.computeAttributes();
    this.execute();
  };

  AutoDetectEndpointAction.prototype.execute = function() {
    // Nothing to execute
  };

  AutoDetectEndpointAction.prototype.refresh = function(_changedTiddlers) {
    return false;
  };

  AutoDetectEndpointAction.prototype.invokeAction = function(_triggeringWidget,_event) {
    // Get the current origin
    let origin = '';
    if (typeof window !== 'undefined' && window.location) {
      origin = window.location.origin ||
               (`${window.location.protocol}//${window.location.host}`);
    }

    if (!origin) {
      // Show notification if we can't detect
      if ($tw.notifier) {
        const tempTiddler = '$:/temp/cloudflare-auto-detect-failed';
        $tw.wiki.addTiddler(new $tw.Tiddler({
          title: tempTiddler,
          text: 'Could not auto-detect endpoint URL. Please enter it manually.',
          tags: '$:/tags/Alert'
        }));

        setTimeout(() => {
          if($tw.wiki.getTiddler(tempTiddler)) {
            $tw.wiki.deleteTiddler(tempTiddler);
          }
        }, 3000);
      }
      return true;
    }

    // Set the endpoint URL
    const endpoint = `${origin}/save`;
    $tw.wiki.addTiddler(new $tw.Tiddler({
      title: '$:/config/cloudflare-saver/endpoint',
      text: endpoint
    }));

    // Show success notification
    if ($tw.notifier) {
      const tempTiddler = '$:/temp/cloudflare-auto-detect-success';
      $tw.wiki.addTiddler(new $tw.Tiddler({
        title: tempTiddler,
        text: `Endpoint auto-detected: ${endpoint}`,
        tags: '$:/tags/Alert'
      }));

      setTimeout(() => {
        if($tw.wiki.getTiddler(tempTiddler)) {
          $tw.wiki.deleteTiddler(tempTiddler);
        }
      }, 3000);
    }

    return true;
  };

  exports['action-auto-detect-cloudflare-endpoint'] = AutoDetectEndpointAction;

})();
