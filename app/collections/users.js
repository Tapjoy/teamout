var Collection = require('../lib/collection.js');
var User = require('../models/user.js');

// A collection of User models
var Users = Collection.extend({
  url: '/users',
  model: User,
  comparator: function (user) {
    return user.get('name');
  },

  /**
   * Gets a list of users available to join a conversation with
   */
  joinable: function() {
    return this.filter(function(user) { return user.isJoinable(); });
  },

  /**
   * Mutes all users in the collection
   */
  mute: function(options) {
    this.each(function(user) { user.mute(options); });
  }
});

module.exports = Users;