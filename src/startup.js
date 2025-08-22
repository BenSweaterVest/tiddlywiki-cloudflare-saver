/*\
title: $:/plugins/BenSweaterVest/cloudflare-saver/startup.js
type: application/javascript
module-type: startup

Startup module for Cloudflare Saver plugin - Register as additional saver
\*/
(function(){

"use strict";

exports.name = "cloudflare-saver-startup";
exports.platforms = ["browser"];
exports.after = ["startup"];
exports.synchronous = true;

exports.startup = function() {
    // Don't automatically set as default saver - let users choose
    
    // Set up configuration defaults
    var configDefaults = {
        "$:/config/cloudflare-saver/endpoint": "",
        "$:/config/cloudflare-saver/timeout": "30",
        "$:/config/cloudflare-saver/notifications": "yes",
        "$:/config/cloudflare-saver/auto-retry": "yes",
        "$:/config/cloudflare-saver/remember-password": "no",
        "$:/config/cloudflare-saver/debug": "no",
        "$:/config/cloudflare-saver/enabled": "no"
    };
    
    Object.keys(configDefaults).forEach(function(title) {
        if(!$tw.wiki.getTiddler(title)) {
            $tw.wiki.addTiddler(new $tw.Tiddler({
                title: title,
                text: configDefaults[title]
            }));
        }
    });
    
    // Add to SaverFilter if enabled
    var enabled = $tw.wiki.getTiddlerText("$:/config/cloudflare-saver/enabled", "no") === "yes";
    if(enabled) {
        var currentFilter = $tw.wiki.getTiddlerText("$:/config/SaverFilter", "");
        if(currentFilter.indexOf("cloudflare") === -1) {
            var newFilter = currentFilter ? currentFilter + " cloudflare" : "cloudflare";
            $tw.wiki.addTiddler(new $tw.Tiddler({
                title: "$:/config/SaverFilter",
                text: newFilter.trim()
            }));
        }
    }
    
    console.log("[CloudflareSaver] Plugin loaded successfully" + (enabled ? " and enabled" : " (disabled)"));
};

})();

