/*\
title: $:/plugins/BenSweaterVest/cloudflare-saver/clear-password-action.js
type: application/javascript
module-type: widget

Action widget to clear the remembered session password

\*/
(function(){

  'use strict';

  const Widget = require('$:/core/modules/widgets/widget.js').widget;

  const ClearPasswordAction = function(parseTreeNode,options) {
    this.initialise(parseTreeNode,options);
  };

  ClearPasswordAction.prototype = new Widget();

  ClearPasswordAction.prototype.render = function(_parent,_nextSibling) {
    this.computeAttributes();
    this.execute();
  };

  ClearPasswordAction.prototype.execute = function() {
    // Nothing to execute
  };

  ClearPasswordAction.prototype.refresh = function(_changedTiddlers) {
    return false;
  };

  ClearPasswordAction.prototype.invokeAction = function(_triggeringWidget,_event) {
    // Clear the session password by sending a message to the saver
    $tw.rootWidget.dispatchEvent({
      type: 'cloudflare-clear-password'
    });

    // Show notification
    if ($tw.notifier) {
      const tempTiddler = '$:/temp/cloudflare-password-cleared';
      $tw.wiki.addTiddler(new $tw.Tiddler({
        title: tempTiddler,
        text: 'Session password cleared',
        tags: '$:/tags/Alert'
      }));

      setTimeout(() => {
        $tw.wiki.deleteTiddler(tempTiddler);
      }, 3000);
    }

    return true;
  };

  exports['action-clear-cloudflare-password'] = ClearPasswordAction;

})();
