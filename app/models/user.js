var _ = require('underscore');

var Model = require('../lib/model.js');
var Platform = require('../lib/platform.js');
var Avatar = require('./avatar.js');
var Photo = require('./photo.js');

// Represents a user in a room
var User = Model.extend({
  defaults: function() {
    return {
      available: true,
      present: false,
      lastUpdatedAt: null,
      photoUrl: Photo.defaultUrl(),
      avatar: {}
    };
  },

  initialize: function() {
    this.fetch();

    // Set up avatar
    var avatarAttrs = _.extend({user: this}, this.get('avatar'));
    this.set({avatar: new Avatar(avatarAttrs)});

    // Set up audio / video streams
    this.mute();
  },

  /**
   * Checks whether this is still a valid user
   */
  validate: function(attrs, options) {
    if (!app.get('room').contains(this) && app.get('user') != this) {
      return 'is not in the current room';
    }
  },

  /**
   * First name for the user
   */
  getFirstName: function() {
    return this.get('name').split(' ')[0];
  },

  /**
   * Whether we can join the conversation with this user
   */
  isJoinable: function() {
    return !this.isConversingWith(app.get('user'));
  },

  /**
   * Determines whether this user is currently in a conversation with the given
   * user
   */
  isConversingWith: function(user) {
    return this.has('conversation') && this.get('conversation').contains(user);
  },

  /**
   * Mutes / unmutes the user
   */
  mute: function(muted) {
    if (muted === undefined) {
      muted = true;
    }
    if (_.isBoolean(muted)) {
      muted = {audio: muted, video: muted};
    }

    Platform.muteVideo(this, muted.video);
    Platform.muteMicrophone(this, muted.audio);

    if (muted.video) {
      this.get('avatar').show();
    } else {
      this.get('avatar').reset();
    }
  },

  /**
   * Marks the user as no longer in the room
   */
  quit: function() {
    if (this.has('conversation')) {
      this.get('conversation').remove(this);
    }

    this.clean();
  }
});

module.exports = User;