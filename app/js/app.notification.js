app.notification = {
  /**
   * The amount of time to allow to pass before the notification is
   * automatically hidden
   */
  timeout: 5000,

  /**
   * Requests permission to show desktop notifications
   */
  requestPermission: function(onSuccess, onError) {
    if (this.hasDesktopPermission()) {
      onSuccess();
    } else {
      var callback = $.proxy(function() {
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
      app.notification.show("Please select Allow above to start using desktop notifications");
    }
  },

  /**
   * Determines whether the app currently has permission to generate desktop
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
   * Determines whether the app show be display messages as desktop notifications
   */
  useDesktopNotifications: function() {
    return this.hasDesktopPermission() && app.settings.get('useDesktopNotifications') == 'true';
  },

  /**
   * Shows a notification with the given message
   */
  show: function(message, options) {
    if (!options) { options = {desktop: false}; }

    if (options.desktop && this.useDesktopNotifications()) {
      var title = 'Google Hangouts';
      var icon = 'http://' + app.host + '/assets/images/google-hangouts-icon.png';
      var notification;

      if (window.webkitNotifications) {
        notification = webkitNotifications.createNotification(icon, title, message);
        notification.show();
        setTimeout($.proxy(notification.cancel, notification), this.timeout);
      } else {
        notification = new Notification(title, {icon: icon, body: message});
        setTimeout($.proxy(notification.close, notification), this.timeout);
      }
    } else {
      gapi.hangout.layout.displayNotice(message);
    }
  }
};