var $ = require('jquery');
var _ = require('underscore');

var Platform = require('./platform.js');

var Notifier = {
  defaults: {
    // The amount of time to allow to pass before notifications are automatically hidden
    timeout: 5000,

    // The title to display in desktop notifications
    title: 'Google Hangouts',

    // The icon to display in desktop notifications
    icon: null,

    // Whether to play a sound when the notification is shown
    sound: false,

    // Whether to show the notification on the desktop
    desktop: false
  },

  /**
   * Cache of sounds mapped by event name
   */
  sounds: {},

  /**
   * Requests permission to show desktop notifications
   */
  requestDesktopPermission: function(onSuccess, onError) {
    if (this.hasDesktopPermission()) {
      onSuccess();
    } else {
      var callback = _.bind(function() {
        if (this.hasDesktopPermission()) {
          onSuccess();
        } else {
          onError();
        }
      }, this);

      if (window.webkitNotifications) {
        webkitNotifications.requestPermission(callback);
      } else if (window.Notification) {
        Notification.requestPermission(callback);
      }

      // Make sure the user notices the authorization
      this.show('notifications', 'Please select Allow above to start using desktop notifications');
    }
  },

  /**
   * Determines whether the page currently has permission to generate desktop
   * notifications
   */
  hasDesktopPermission: function() {
    var hasPermission = false;
    if (window.webkitNotifications) {
      hasPermission = webkitNotifications.checkPermission() == 0;
    } else if (window.Notification) {
      hasPermission = Notification.permission == 'granted';
    }

    return hasPermission;
  },

  /**
   * Generates a notification for the given event
   */
  show: function(event, content, options) {
    options = _.extend({}, this.defaults, options);

    if (options.desktop && this.hasDesktopPermission()) {
      var title = options.title;
      var icon = options.icon;
      var timeout = options.timeout;
      var notification;

      if (window.webkitNotifications) {
        notification = webkitNotifications.createNotification(icon, title, content);
        notification.show();
        setTimeout(_.bind(notification.cancel, notification), timeout);
      } else {
        notification = new Notification(title, {icon: icon, body: content});
        setTimeout(_.bind(notification.close, notification), timeout);
      }
    } else {
      Platform.displayNotice(content);
    }

    if (options.sound) {
      this._play(event);
    }
  },

  /**
   * Plays the sound associated with the given event
   */
  _play: function(event) {
    var sound = this.sounds[event];

    if (!sound) {
      this._loadSound(event, _.bind(this._play, this, event));
    } else {
      sound.play();
    }
  },

  /**
   * Loads the sound associated with the given event.  The given callback will
   * be invoked when the sound is available to be played.
   */
  _loadSound: function(event, callback) {
    var sound = new Audio();
    $(sound).on('canplaythrough', _.bind(function() {
      this.sounds[event] = sound;
      callback();
    }, this));
    sound.src = '//' + app.get('host') + '/assets/audio/chime.ogg';
  }
};

module.exports = Notifier;