var $ = require('jquery');
var _ = require('underscore');

var Model = require('../lib/model.js');
var Users = require('../collections/users.js');

// An active chat between a subset of users in the room
var Conversation = Model.extend({
  defaults: function() {
    return {
      startedAt: _.now(),
      userIds: [],
      locked: false,
      users: new Users()
    };
  },

  initialize: function() {
    this.fetch();

    // Proxy events
    var users = this.get('users');
    users.on('all', function(event) {
      this.trigger.apply(this, [event + 'user'].concat(Array.prototype.slice.call(arguments, 1)));
    }, this);

    // Sync collection on change
    this.on('change:userIds', function(self, userIds) {
      this._update(app.get('room').all(userIds));
    }, this);

    // Clean up on destroy
    this.on('destroy', function(self) {
      this.get('users').each(function(user) {
        if (user.get('conversation') == self) {
          user.unset('conversation');
        }
      });
    });

    // Sync up with the latest data for this conversation
    this._update(app.get('room').all(this.get('userIds')));

    // Listen for changes to the lock status
    this.on('change:locked', this._onChangeLocked, this);
  },

  /**
   * Whether the given user is in the conversation
   */
  contains: function(user) {
    return this.get('users').get(user) != null;
  },

  /**
   * Whether there are any users in this conversation
   */
  isEmpty: function() {
    return this.get('users').isEmpty();
  },

  /**
   * Merges in users from the given conversation into this one
   */
  merge: function(conversation) {
    this.add(conversation.get('users').models);
  },

  /**
   * Adds the given user to the conversation
   */
  add: function(user) {
    this._update(this.get('users').models.concat($.makeArray(user)));
  },

  /**
   * Removes the given participant from the conversation
   */
  remove: function(user) {
    this._update(_.without.apply(_, [this.get('users').models].concat($.makeArray(user))));
  },

  /**
   * Updates the list of users currently in this conversation.  This will
   * basically do a merge.
   */
  _update: function(newModels) {
    var users = this.get('users');
    var oldModels = users.models;
    var removes = _.difference(oldModels, newModels);
    var adds = _.difference(newModels, oldModels);

    // Sync up the collection
    users.remove(removes);
    users.add(adds);

    // Make sure removed users know they're no longer in this conversation
    for (var i = 0; i < removes.length; i++) {
      var user = removes[i];
      if (user.get('conversation') == this) {
        user.unset('conversation');
      }
    }

    if (users.length <= 1) {
      // No one left to talk to: kill the conversation
      this.destroy();
    } else {
      // Only save if the list of users has actually changed
      if (!_.isEqual(this.get('userIds'), users.pluck('id'))) {
        this.save({userIds: users.pluck('id')});
      }

      // Make sure new users know they're in this conversation
      for (var i = 0; i < adds.length; i++) {
        var user = adds[i];
        user.set({conversation: this});
      }
    }
  },

  /**
   * Callback when the lock status of the conversation has changed
   */
  _onChangeLocked: function() {
    var user = app.get('user');
    if (this.contains(user)) {
      if (this.get('locked')) {
        user.notify('ConversationLocked', 'Conversation has been locked');
      } else {
        user.notify('ConversationLocked', 'Conversation has been unlocked');
      }
    }
  }
});

module.exports = Conversation;