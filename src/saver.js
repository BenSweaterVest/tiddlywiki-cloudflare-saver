/*\
title: $:/plugins/BenSweaterVest/cloudflare-saver/saver.js
type: application/javascript
module-type: saver

Cloudflare Functions saver for TiddlyWiki - Additional Saver Option
\*/
(function(){

"use strict";

var CloudflareSaver = function(wiki) {
    this.wiki = wiki;
    this.sessionPassword = null;
};

CloudflareSaver.prototype.save = function(text, method, callback, options) {
    var self = this;
    options = options || {};
    
    // Only handle saves when explicitly selected
    if(method !== "save") {
        return false;
    }
    
    // Check if this saver is enabled
    var enabledSavers = self.wiki.getTiddlerText("$:/config/SaverFilter", "").split(" ");
    if(enabledSavers.indexOf("cloudflare") === -1) {
        return false; // Let other savers handle it
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
    
    if(xhr.responseText) {
        try {
            var response = JSON.parse(xhr.responseText);
            if(response.error) {
                errorMsg += " - " + response.error;
            }
        } catch(e) {
            if(xhr.responseText.length < 200) {
                errorMsg += " - " + xhr.responseText;
            }
        }
    }
    
    if(xhr.status === 401) {
        self.sessionPassword = null;
        errorMsg = "Cloudflare authentication failed. Please check your password.";
    }
    
    if(config.debug) {
        console.error("[CloudflareSaver] Error:", errorMsg);
    }
    
    if(retryCount < maxRetries && xhr.status !== 401) {
        var retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
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

exports.CloudflareSaver = CloudflareSaver;

})();

