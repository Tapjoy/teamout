var _ = require('underscore');
var Backbone = require('backbone');

var Platform = require('./platform.js');

// A resource within the app, which may or may not be backed by data storage
var Model = Backbone.Model.extend({
  // Whether this model should be syncing with a backend
  _syncing: false,

  /**
   * Syncs the data from this model
   */
  sync: function(method, model, options) {
    switch (method) {
      case 'read':
        var data = Platform.getState()[this.url()] || {};
        options.success(data);
        break;

      case 'create':
      case 'update':
        var updates = {};
        updates[this.url()] = this.toJSON();
        Platform.syncState({updates: updates});
        options.success();
        break;

      case 'clean':
      case 'delete':
        this._syncing = false;
        Platform.off('statechanged', null, this);
        Platform.syncState({removes: [this.url()]});
        options.success();
        break;
    }
  },

  /**
   * Callback when data in the app has changed
   */
  fetch: function() {
    if (!this._syncing) {
      this._syncing = true;

      // Listen for changes to data related to this model
      Platform.on('statechanged', this._onStateChanged, this);
    }

    Backbone.Model.prototype.fetch.apply(this, arguments);
  },

  /**
   * Resets all data associated with this model
   */
  clean: function(options) {
    options = _.extend({success: function() {}}, options);
    this.sync('clean', this, options)
  },

  /**
   * Generates a JSON representation of the model
   */
  toJSON: function() {
    var attributes = _.clone(this.attributes);
    for (var key in attributes) {
      var value = attributes[key];
      if (value && value.sync) {
        delete attributes[key];
      }
    }
    return attributes;
  },

  /**
   * Callback when data in the app has changed
   */
  _onStateChanged: function(event) {
    if (this._syncing && event.updates[this.url()]) {
      this.fetch();
    }
  }
});

module.exports = Model;