/*\
title: $:/plugins/BenSweaterVest/cloudflare-saver/startup.js
type: application/javascript
module-type: startup

Initialises the saver status, removes settings left over from version 1,
and wires up the buttons in the settings tab.

\*/

'use strict';

exports.name = 'cloudflare-saver';
exports.platforms = ['browser'];
exports.after = ['startup'];
exports.synchronous = true;

// Settings that version 1 stored as real tiddlers. They no longer apply.
const V1_SETTINGS = ['endpoint', 'timeout', 'notifications', 'auto-retry', 'remember-password', 'enabled'];

function removeVersionOneSettings(wiki) {
  const prefix = '$:/config/cloudflare-saver/';
  if (!wiki.tiddlerExists(`${prefix}endpoint`)) {
    return;
  }
  const titles = V1_SETTINGS.map(name => prefix + name)
    .concat(wiki.filterTiddlers(`[prefix[${prefix}stats/]]`));
  titles.forEach(title => {
    if (wiki.tiddlerExists(title)) {
      wiki.deleteTiddler(title);
    }
  });
}

exports.removeVersionOneSettings = removeVersionOneSettings;

exports.startup = function() {
  const core = require('$:/plugins/BenSweaterVest/cloudflare-saver/core.js');
  const controller = core.get();

  removeVersionOneSettings($tw.wiki);
  controller.initStatus();

  if (/^https?:$/.test(location.protocol)) {
    const learn = status => {
      if (status && status.version) {
        controller.client.detected = true;
        controller.client.serverVersion = status.version;
        controller.initStatus();
        controller.setStatus({ 'signed-in': status.signedIn ? 'yes' : 'no' });
      }
    };
    controller.client.request('/status?quick=1').then(learn, () => {});
  }

  const handlers = {
    'tm-cloudflare-saver-signin': () => controller.signIn(),
    'tm-cloudflare-saver-signout': () => controller.signOut(),
    'tm-cloudflare-saver-check': () => controller.check(),
    'tm-cloudflare-saver-update-plugin': () => controller.updatePlugin()
  };
  Object.keys(handlers).forEach(type => {
    $tw.rootWidget.addEventListener(type, () => {
      handlers[type]();
      return false;
    });
  });
};
