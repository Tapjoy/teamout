// Represents settings for the extension
app.settings = {
  // Represents the local version of the settings
  state: {
    available: 'true',
    playSounds: 'true',
    useDesktopNotifications: 'false',
    photoEnabled: 'true',
    photoInterval: '1',
    photoPrivacy: 'none',
    photoSource: '',
    unmuteVideo: 'true',
    initialPhoto: 'true'
  },

  init: function(callback) {
    var storedState = JSON.parse(localStorage[app.participant.googleId] || '{}');
    $.extend(this.state, storedState);

    // Control dropdowns
    $('.menubar .btn-dropdown-container').click(function(event) {
      // Toggle other dropdowns
      var $dropdown = $(this);
      $('.menubar .btn-dropdown-container').not($dropdown).removeClass('open');

      $dropdown.toggleClass('open');

      event.preventDefault();
      event.stopPropagation();
    })
    $('.menubar .dropdown-menu').on('click mouseenter focusin', function(event) {
      event.stopPropagation();
    });
    $(document).click(function() {
      $('.menubar .open > .dropdown-toggle').each(function() {
        $(this).parent().removeClass('open');
      });
    });

    // Setting: photos
    if (!app.photo.isSupported()) {
      this.set('photoEnabled', 'false');
      $('.menubar .btn-photo').addClass('disabled');
      $('.menubar .btn-photo-dropdown').addClass('disabled');

      app.notification.show('Photos are not supported in your browser. Please consider upgrading to a newer version.');
    }
    if (this.get('photoEnabled') == 'false') {
      $('.menubar .btn-photo').button('toggle');
    }
    $('.menubar .btn-photo input').change($.proxy(this.onChangePhotoEnabled, this));

    // Setting: unmute video
    $('.menubar .setting-unmute_video input')
      .prop('checked', this.get('unmuteVideo') == 'true')
      .click($.proxy(this.onChangeUnmuteVideo, this));

    // Setting: photo privacy
    $('.menubar .setting-photo_privacy select').change($.proxy(this.onChangePhotoPrivacy, this));
    var photoPrivacy = this.get('photoPrivacy');
    $('.menubar .setting-photo_privacy select option[value="' + photoPrivacy + '"]').attr({selected: true});

    // Setting: photo interval
    $('.menubar .setting-photo_interval select').change($.proxy(this.onChangePhotoInterval, this));
    var photoInterval = this.get('photoInterval');
    $('.menubar .setting-photo_interval select option[value="' + photoInterval + '"]').attr({selected: true});

    // Setting: photo source
    app.photo.sources($.proxy(function(sources) {
      var $setting = $('.menubar .setting-photo_source select');
      $setting.change($.proxy(this.onChangePhotoSource, this));

      // Add known sources
      var photoSource = this.get('photoSource');
      for (var i = 0; i < sources.length; i++) {
        var source = sources[i];
        $('<option>')
          .attr({value: source.id, selected: photoSource == source.id})
          .text(source.label || 'Default')
          .appendTo($setting);
      }

      // Set the default if there isn't already one
      var $option = $setting.find('option:selected');
      if ($option.length) {
        this.set('photoSource', $option.val());
      } else {
        $setting.parent().hide();
        this.set('photoSource', '');
      }
    }, this));

    // Setting: availability
    if (this.get('available') == 'false') {
      $('.menubar .btn-available').button('toggle');
    }
    $('.menubar .btn-available input').change($.proxy(this.onChangeAvailable, this));
    app.data.set(app.participant.id + '/available', this.get('available') + '')

    // Setting: sound
    if (this.get('playSounds') == 'false') {
      $('.menubar .btn-sounds').button('toggle');
    }
    $('.menubar .btn-sounds input').change($.proxy(this.onChangeSounds, this));

    // Setting: desktop notifications
    if (this.get('useDesktopNotifications') == 'false') {
      $('.menubar .btn-notifications').button('toggle');
    }
    $('.menubar .btn-notifications input').change($.proxy(this.onChangeNotifications, this));

    // Setting: autoload
    if (!gapi.hangout.willAutoLoad()) {
      $('.menubar .btn-autostart').button('toggle');
    }
    $('.menubar .btn-autostart input').change($.proxy(this.onChangeAutostart, this));

    // Setting: rooms
    $('.btn-rooms').click($.proxy(this.onClickRooms, this));

    // Setting: conversation
    $('.btn-leave').click($.proxy(this.onClickLeave, this));

    // Tooltips
    $('.menubar > .btn')
      .tooltip({placement: 'bottom', animation: false, title: this.title})
      .change($.proxy(this.onChangeButton, this));
  },

  /**
   * Callback when one of the main buttons has changed state
   */
  onChangeButton: function(event) {
    var $setting = $(event.target);
    $setting.parent('.btn').tooltip('show');
  },

  /**
   * Gets the title for the given button
   */
  title: function() {
    var $btn = $(this);
    var title = $btn.find('> input').prop('checked') ? $btn.data('title-on') : $btn.data('title-off');
    return title || $btn.attr('title');
  },

  /**
   * Callback when the user has changed the setting for availability
   */
  onChangeAvailable: function(event) {
    var $setting = $(event.target);
    var enabled = !$setting.is(':checked');
    this.set('available', enabled + '');

    // Communicate to everyone in the hangout so that they get the right messaging
    app.data.set(app.participant.id + '/available', enabled + '')
  },

  /**
   * Callback when the user has changed the setting for playing sounds
   */
  onChangeSounds: function(event) {
    var $setting = $(event.target);
    this.set('playSounds', !$setting.is(':checked') + '');
  },

  /**
   * Callback when the user has changed the setting for using desktop notifications
   */
  onChangeNotifications: function(event) {
    var $setting = $(event.target);
    var enabled = !$setting.is(':checked');

    if (enabled) {
      app.notification.requestPermission(
        $.proxy(function() {
          // Received permission
          this.set('useDesktopNotifications', 'true');
        }, this),
        $.proxy(function() {
          // Did not receive permission; toggle off
          $('.menubar .btn-notifications').button('toggle');
        }, this)
      );
    } else {
      this.set('useDesktopNotifications', 'false');
    }
  },

  /**
   * Callback when the user has changed the setting for autostarting the extension
   */
  onChangeAutostart: function(event) {
    var $setting = $(event.target);
    var enabled = !$setting.is(':checked');
    gapi.hangout.setWillAutoLoad(enabled);
  },

  /**
   * Callback when the user has changed the setting for taking presence photos
   */
  onChangePhotoEnabled: function(event) {
    var $setting = $(event.target);
    var enabled = !$setting.is(':checked');
    this.set('photoEnabled', enabled + '');

    app.photo.refresh();
  },

  /**
   * Callback when the user has changed the setting for photo privacy mode
   */
  onChangePhotoPrivacy: function(event) {
    var $setting = $(event.target);
    var privacy = $setting.val();
    this.set('photoPrivacy', privacy);
  },

  /**
   * Callback when the user has changed the setting for presence photo intervals
   */
  onChangePhotoInterval: function(event) {
    var $setting = $(event.target);
    var interval = $setting.val();
    this.set('photoInterval', interval);

    app.photo.refresh();
  },

  /**
   * Callback when the user has changed the setting for the video source to
   * use for photos
   */
  onChangePhotoSource: function(event) {
    var $setting = $(event.target);
    var sourceId = $setting.val();
    this.set('photoSource', sourceId);
  },

  /**
   * Callback when the user has changed whether to unmute video when a new
   * conversation has started
   */
  onChangeUnmuteVideo: function(event) {
    var $setting = $(event.target);
    var enabled = $setting.is(':checked');
    this.set('unmuteVideo', enabled + '');
  },

  /**
   * Callback when the user has clicked on the rooms action
   */
  onClickRooms: function(event) {
    event.stopPropagation();
    $('.menubar .btn-dropdown-container').removeClass('open');
    app.rooms.show();
  },

  /**
   * Callback when the user has clicked on the leave action
   */
  onClickLeave: function(event) {
    event.stopPropagation();
    $('.menubar .btn-dropdown-container').removeClass('open');
    app.conversation.leave();
  },

  /**
   * Sets the given setting for the current user that will persist across sessions
   */
  set: function(key, value) {
    this.state[key] = value;
    localStorage.setItem(app.participant.googleId, JSON.stringify(this.state));
  },

  /**
   * Gets the setting for the given key
   */
  get: function(key) {
    return this.state[key];
  }
};