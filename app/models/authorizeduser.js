var _ = require('underscore');
var uuid = require('node-uuid');

var Notifier = require('../lib/notifier.js');
var Platform = require('../lib/platform.js');
var Avatar = require('./avatar.js');
var Camera = require('./camera.js');
var Photo = require('./photo.js');
var User = require('./user.js');

// The current user in the app
var AuthorizedUser = User.extend({
  urlRoot: '/users',
  defaults: function() {
    return _.extend(_.result(User.prototype, 'defaults'), {
      authorized: true,
      playSounds: true,
      useDesktopNotifications: false,
      photoEnabled: true,
      photoInterval: 1,
      photoPrivacy: 'none',
      photoSource: null,
      unmuteVideo: true,
      roomIds: [],
      hiddenRoomIds: [],
      camera: new Camera(),
      avatar: {includeName: false}
    });
  },

  initialize: function() {
    User.prototype.initialize.apply(this, arguments);

    // Set up audio / video streams
    Platform.on('videomute', this._onVideoMute, this);
    Platform.on('videomute microphonemute', this._onMediaMute, this);

    // Set up camera
    var camera = this.get('camera');
    camera.set({enabled: _.bind(this.canTakePhotos, this)});
    camera.on('newphoto', this._onNewPhoto, this);
    camera.timeLapse();
    this.on('change:photoSource', function(self, value) { camera.set({source: value}); });
    this.on('change:photoInterval', function(self, value) { camera.set({interval: value}); });
    this.on('change:photoEnabled change:photoSource change:photoInterval', _.bind(camera.timeLapse, camera));

    // Set up conversation
    this.on('change:conversation', this._onChangeConversation, this);

    // Set up notifications
    this.on('change:useDesktopNotifications', this._onChangeNotifications, this);
  },

  /**
   * Gets the local settings for this user.  This does *not* include data that
   * gets persisted globally for other users to see.
   */
  settings: function() {
    var attributes = User.prototype.toJSON.apply(this);
    return _.omit(attributes, ['id', 'sessionId', 'name', 'authorized', 'present', 'lastUpdatedAt', 'photoUrl']);
  },

  /**
   * Determines whether the user can currently take photos with the camera
   */
  canTakePhotos: function() {
    return this.get('photoEnabled') &&
      Platform.isVideoMuted(this) &&
      Platform.isMicrophoneMuted(this) &&
      !this.has('conversation') &&
      !app.get('room').isEmpty();
  },

  /**
   * Never able to join with the current user
   */
  isJoinable: function() {
    return false;
  },

  /**
   * Joins into a conversation with the given user.  If the user is already in
   * a conversation, then this user will join in with everyone in that
   * conversation.  If both this and the given user are in conversations, then
   * both conversations will get merged.
   */
  join: function(user) {
    this._joining = true;

    if (this.has('conversation') && user.has('conversation')) {
      this.get('conversation').merge(user.get('conversation'));
    } else if (this.has('conversation')) {
      this.get('conversation').add(user);
    } else if (user.has('conversation')) {
      user.get('conversation').add(this);
    } else {
      var conversation = app.get('room').get('conversations').add({
        id: this.id + '-' + uuid.v4(),
        userIds: [this.id, user.id]
      });
      conversation.save();
    }

    this._joining = false;
  },

  /**
   * Leaves the current conversation the user is in.  If the user is not already
   * in a conversation, then this is a no-op.
   */
  leave: function() {
    if (this.has('conversation')) {
      this.get('conversation').remove(this);
    }
  },

  /**
   * Generates a notification for the given event
   */
  notify: function(event, content, options) {
    options = _.extend({sound: false}, options);
    if (!this.get('playSounds')) { options.sound = false; }
    if (!this.get('useDesktopNotifications')) { options.desktop = false; }

    Notifier.show(event, content, options);
  },

  /**
   * Reads / persists the current state for this user
   */
  sync: function(method, model, options) {
    switch (method) {
      case 'read':
        var data;
        try {
          data = JSON.parse(localStorage[this.id] || '{}');
        } catch(e) {
          data = {};
        }

        options.success(data);
        break;

      case 'update':
        try {
          localStorage.setItem(this.id, JSON.stringify(this.settings()));
        } catch (e) {}

      default:
        User.prototype.sync.apply(this, arguments);
        break;
    }
  },

  /**
   * Generates a JSON representation of the model.  Note that this only includes
   * attributes that should get communicated to other users in the room.  It
   * does *not* include local settings.
   */
  toJSON: function() {
    var attributes = User.prototype.toJSON.apply(this, arguments);
    return _.pick(attributes, ['available', 'present', 'lastUpdatedAt', 'photoUrl']);
  },

  /**
   * Callback when the user has changed whether the camera/microphone is muted
   */
  _onMediaMute: function(event) {
    if (!this.has('conversation') && !event.muted) {
      this.mute();
    }
  },

  /**
   * Callback when user has changed whether the camera is muted
   */
  _onVideoMute: function(event) {
    Platform.mirrorVideo(this.has('conversation') && !event.muted);

    if (event.muted) {
      this.get('avatar').show();
    } else {
      this.get('avatar').reset();
    }
  },

  /**
   * Callback when a new photo has been taken with the camera
   */
  _onNewPhoto: function(event) {
    // Generate a url
    var photo = event.photo;
    var privacy = this.get('photoPrivacy');
    var photoUrl;
    if (privacy == 'silhouette') {
      photoUrl = Photo.defaultUrl();
    } else {
      photo.filter('desaturate');
      photo.filter(privacy);
      photoUrl = photo.imageUrl();
    }

    this.save({
      photoUrl: photoUrl,
      present: photo.hasFaces(),
      lastUpdatedAt: _.now()
    });
  },

  /**
   * Callback when the conversation this user is in has changed
   */
  _onChangeConversation: function(self, conversation) {
    if (conversation) {
      if (!this.previous('conversation')) {
        // New conversation: set up the audio / video stream
        var busy = !this.get('available');
        var muteVideo = !this.get('unmuteVideo');
        this.mute({audio: busy, video: busy || muteVideo});
      } else {
        // Remove self from the previous conversation
        this.previous('conversation').remove(this);
      }

      // Display a notice in the hangout
      if (!this._joining) {
        this.notify('newconversation', 'A new conversation has started', {desktop: true, sound: true});
      }

      // Join each user in the conversation
      conversation.get('users').each(function(user) {
        this._onJoinUser(user);
      }, this);

      // Track when users join / leave
      conversation.on({adduser: this._onJoinUser, removeuser: this._onLeaveUser}, this);
    } else {
      this.mute();
      this.get('camera').timeLapse();
    }
  },

  /**
   * Callback when a new user has joined the conversation
   */
  _onJoinUser: function(user) {
    if (user != this) {
      user.mute(false);
    }
  },

  /**
   * Callback when a user has left the conversation
   */
  _onLeaveUser: function(user) {
    if (user != this) {
      user.mute();
    }
  },

  /**
   * Calback when the setting for using desktop notifications has changed
   */
  _onChangeNotifications: function(self, enabled) {
    if (enabled) {
      Notifier.requestDesktopPermission(_.constant(undefined),
        _.bind(function() {
          this.set({useDesktopNotifications: false});
        }, this)
      );
    }
  },

  // No-op when the state changes
  _onStateChanged: function(event) {
  }
});

module.exports = AuthorizedUser;