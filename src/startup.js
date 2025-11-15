/*\
title: $:/plugins/BenSweaterVest/cloudflare-saver/startup.js
type: application/javascript
module-type: startup

Startup module for Cloudflare Saver plugin - Register as additional saver
\*/
(function(){

  'use strict';

  exports.name = 'cloudflare-saver-startup';
  exports.platforms = ['browser'];
  exports.after = ['startup'];
  exports.synchronous = true;

  exports.startup = function() {
    // Don't automatically set as default saver - let users choose

    // Set up configuration defaults
    const configDefaults = {
      '$:/config/cloudflare-saver/endpoint': '',
      '$:/config/cloudflare-saver/timeout': '30',
      '$:/config/cloudflare-saver/notifications': 'yes',
      '$:/config/cloudflare-saver/auto-retry': 'yes',
      '$:/config/cloudflare-saver/remember-password': 'no',
      '$:/config/cloudflare-saver/debug': 'no',
      '$:/config/cloudflare-saver/enabled': 'no'
    };

    Object.keys(configDefaults).forEach((title) => {
      if(!$tw.wiki.getTiddler(title)) {
        $tw.wiki.addTiddler(new $tw.Tiddler({
          title,
          text: configDefaults[title]
        }));
      }
    });

    const enabled = $tw.wiki.getTiddlerText('$:/config/cloudflare-saver/enabled', 'no') === 'yes';
    const debug = $tw.wiki.getTiddlerText('$:/config/cloudflare-saver/debug', 'no') === 'yes';

    if (debug) {
      console.log(`[CloudflareSaver] Plugin loaded successfully${  enabled ? ' and enabled' : ' (disabled)'}`);
    }
  };

})();

