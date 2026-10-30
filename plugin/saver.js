/*\
title: $:/plugins/BenSweaterVest/cloudflare-saver/saver.js
type: application/javascript
module-type: saver

Saves the wiki through the Cloudflare Saver Worker that served it.

The saver is only active when the page was actually served by the Worker,
so the same wiki opened from a file or another host falls back to the
usual savers automatically.

\*/

'use strict';

const core = require('$:/plugins/BenSweaterVest/cloudflare-saver/core.js');

function CloudflareSaver(_wiki) {}

CloudflareSaver.prototype.save = function(text, method, callback) {
  return core.get().save(text, method, callback);
};

CloudflareSaver.prototype.info = {
  name: 'cloudflare',
  // Above the download saver (100) and the other built-in savers.
  priority: 2000,
  capabilities: ['save', 'autosave']
};

exports.canSave = function(_handler) {
  return Boolean($tw.browser) && typeof location !== 'undefined' && /^https?:$/.test(location.protocol);
};

exports.create = function(wiki) {
  return new CloudflareSaver(wiki);
};
