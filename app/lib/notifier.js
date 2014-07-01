var $ = require('jquery');
var _ = require('underscore');

var Platform = require('./platform.js');

// Provide a cross-browser API for notifications
if (window.Notification) {
  // Provide a wrapper to the permission property in order to have a single API
  // across multiple browsers
  Notification.getPermission = function() {
    return this.permission;
  };
} else if (window.webkitNotifications) {
  // Expose webkit notifications under the standard Notification API
  window.Notification = function(title, options) {
    if (!options) { options = {} };
    this.notification = webkitNotifications.createNotification(options.icon, title, options.body);
    this.notification.show();
  };

  _.extend(Notification, {
    requestPermission: webkitNotifications.requestPermission,
    getPermission: function() {
      return webkitNotifications.checkPermission() == 0 ? 'granted' : 'default';
    }
  });

  _.extend(Notification.prototype, {
    close: function() {
      this.notification.cancel();
    }
  });
}

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
   * Whether desktop notification access is supported in this browser
   */
  desktopSupported: window.Notification != undefined,

  /**
   * Cache of sounds mapped by event name
   */
  sounds: {},

  /**
   * Requests permission to show desktop notifications
   */
  requestDesktopPermission: function(onSuccess, onError) {
    if (!this.desktopSupported) {
      onError();
    } else if (this.hasDesktopPermission()) {
      onSuccess();
    } else {
      var callback = _.bind(function() {
        if (this.hasDesktopPermission()) {
          onSuccess();
        } else {
          onError();
        }
      }, this);

      Notification.requestPermission(callback);

      // Make sure the user notices the authorization
      this.show('notifications', 'Please select Allow above to start using desktop notifications');
    }
  },

  /**
   * Determines whether the page currently has permission to generate desktop
   * notifications
   */
  hasDesktopPermission: function() {
    return this.desktopSupported && Notification.getPermission() == 'granted';
  },

  /**
   * Generates a notification for the given event
   */
  show: function(event, content, options) {
    options = _.extend({}, this.defaults, options);

    if (options.display) {
      if (options.desktop && this.hasDesktopPermission()) {
        var title = options.title;
        var icon = options.icon;
        var timeout = options.timeout;

        var notification = new Notification(title, {icon: icon, body: content});
        setTimeout(_.bind(notification.close, notification), timeout);
      } else {
        Platform.displayNotice(content);
      }
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