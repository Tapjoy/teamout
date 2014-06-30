var $ = require('jquery');
var _ = require('underscore');

var Model = require('../lib/model.js');
var Platform = require('../lib/platform.js');
var User = require('./user.js');
var Users = require('../collections/users.js');
var Conversations = require('../collections/conversations.js');

// A channel for multiple users to hang in
var Room = Model.extend({
  defaults: function() {
    return {
      users: new Users(),
      conversations: new Conversations()
    };
  },

  /**
   * Generates a url for sharing access to the room.  This url will be
   * consistent across multiple calls.
   */
  shareUrl: function() {
    return Platform.getRoomUrl(this, app.id);
  },

  /**
   * Navigates the browser to this room
   */
  switch: function() {
    window.top.location = this.shareUrl();
  },

  /**
   * Registers the current user with this room
   */
  enter: function() {
    // Set up users
    this.get('users').add(app.get('user'));
    this.get('users').add(Platform.getUsers());
    Platform.on('useradded', this._onUserAdded, this);
    Platform.on('userremoved', this._onUserRemoved, this);

    // Monitor for new conversations
    Platform.on('statechanged', this._onStateChanged, this);
    this._onStateChanged({updates: Platform.getState(), removes: []});

    // Clean out old state from users / conversations that are no longer valid
    this.clean();
  },

  /**
   * Whether this room has any users in it
   */
  isEmpty: function() {
    return this.get('users').length == 1;
  },

  /**
   * Gets the given user in this room
   */
  user: function(id) {
    return this.get('users').get(id);
  },

  /**
   * Gets all users that match the given list
   */
  all: function(ids) {
    return this.get('users').getAll(ids);
  },

  /**
   * Whether the given user is currently in this room
   */
  contains: function(id) {
    return this.user(id) != null;
  },

  /**
   * Registers the given user(s) with the room
   */
  add: function(user) {
    return this.get('users').add(user);
  },

  /**
   * Removes the given user(s) from the room
   */
  remove: function(user) {
    var users = this.all($.makeArray(user));
    _.each(users, function(user) { user.quit(); });
    return this.get('users').remove(user);
  },

  /**
   * Determines whether this room is currently hidden
   */
  isHidden: function() {
    return _.contains(app.get('user').get('hiddenRoomIds'), this.id);
  },

  /**
   * Marks this room as hidden and, therefore, shouldn't be shown to the user
   */
  hide: function() {
    if (!this.isHidden()) {
      var user = app.get('user');
      user.save({hiddenRoomIds: user.get('hiddenRoomIds').concat([this.id])});
    }
  },

  /**
   * Marks this room as no longer hidden
   */
  unhide: function() {
    if (this.isHidden()) {
      var user = app.get('user');
      user.save({hiddenRoomIds: _.without(user.get('hiddenRoomIds'), this.id)});
    }
  },

  /**
   * Cleans up keys belonging to users no longer in this room
   */
  clean: function() {
    var state = Platform.getState();
    var validUrls = this.get('users').map(function(user) { return user.url(); });
    var allUrls = _.keys(state).filter(function(key) { return key.indexOf('/users/') == 0; });

    var removes = _.difference(allUrls, validUrls);
    Platform.syncState({removes: removes});
  },

  /**
   * Generates a JSON representation of the room
   */
  toJSON: function() {
    return {
      id: this.id,
      shareUrl: this.shareUrl()
    };
  },

  /**
   * Callback when data in the app has changed
   */
  _onStateChanged: function(event) {
    var conversations = this.get('conversations');

    // Look for new conversations
    var updates = event.updates;
    for (var key in updates) {
      if (key.indexOf('/conversations') == 0) {
        var attributes = updates[key];
        if (!conversations.get(attributes)) {
          conversations.add(attributes);
        }
      }
    }

    // Look for removed conversations
    var removes = event.removes;
    for (var i = 0; i < removes.length; i++) {
      var key = removes[i];
      if (key.indexOf('/conversations') == 0) {
        var id = key.replace('/conversations/', '');

        var conversation = conversations.get(id);
        if (conversation) {
          conversation.destroy();
        }
      }
    }
  },

  /**
   * Callback when a user is added (via an external source) to the room
   */
  _onUserAdded: function(event) {
    var user = this.add(event.user);
    app.get('user').notify('EnterRoom', user.get('name') + ' has entered the room');
  },

  /**
   * Callback when a user is removed (via an external source) from the room
   */
  _onUserRemoved: function(event) {
    var user = this.remove(event.user);
    app.get('user').notify('LeaveRoom', user.get('name') + ' has left the room');
  }
});

module.exports = Room;