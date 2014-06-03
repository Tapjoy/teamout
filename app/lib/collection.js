var _ = require('underscore');
var Backbone = require('backbone');

// A group of multiple related models
var Collection = Backbone.Collection.extend({
  /**
   * Adds the given list of ids to the collection
   */
  add: function(models) {
    if (_.isArray(models)) {
      var allIds = _.every(models, function(model) {
        return _.isString(model) || _.isNumber(model);
      });

      if (allIds) {
        models = _.map(models, function(id) { return {id: id}; });
      }
    }

    return Backbone.Collection.prototype.add.apply(this, arguments);
  },

  /**
   * Gets models for the given ids
   */
  getAll: function(ids) {
    return _.compact(_.map(ids, function(id) { return this.get(id); }, this));
  }
});

module.exports = Collection;