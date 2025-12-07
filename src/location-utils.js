/*\
title: $:/plugins/BenSweaterVest/cloudflare-saver/location-utils.js
type: application/javascript
module-type: utils

Utility functions for getting browser location information

\*/
(function(){

  'use strict';

  /**
   * Get the current origin (protocol + hostname + port)
   * @returns {string} The current origin
   */
  exports.getOrigin = function() {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.origin ||
             (window.location.protocol + '//' + window.location.host);
    }
    return '';
  };

  /**
   * Get the auto-detected endpoint URL
   * @returns {string} The endpoint URL (origin + /save)
   */
  exports.getAutoEndpoint = function() {
    const origin = exports.getOrigin();
    return origin ? origin + '/save' : '';
  };

})();
