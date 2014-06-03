var $ = require('jquery');
var _ = require('underscore');
var strftime = require('strftime');
var Backbone = require('backbone');
var Ractive = require('ractive');
require('ractive-adaptors-backbone');
require('ractive-transitions-fade');
require('ractive-transitions-slide');

// A UI component within the app
var View = Ractive.extend({
  adapt: ['Backbone'],
  eventNames: [],
  data: {
    formatTimestamp: function(timestamp, format) {
      return strftime(format, new Date(timestamp)).trim();
    }
  },

  init: function() {
    // Bind known events
    for (var i = 0; i < this.eventNames.length; i++) {
      var name = this.eventNames[i];
      this.on(name, _.bind(this[name], this));
    }
  },

  /**
   * Looks up elements relative to the root node in this view
   */
  $: function(selector) {
    return $(this.el).find(selector);
  }
});

module.exports = View;