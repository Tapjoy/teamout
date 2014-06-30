var $ = require('jquery');
var _ = require('underscore');

var View = require('../../lib/view.js');
var Camera = require('../../models/camera.js');
var DialogView = require('../shared/dialog.js');
var HelpShowView = require('../help/show.js');
var RoomDirectoryView = require('../room/directory.js');

// Represents settings for the app
var SettingListView = View.extend({
  template: require('./list.ractive'),
  eventNames: ['showRoomDirectory', 'showHelpGuide'],
  data: {
    photoIntervals: [
      {value: 0.5, name: '30 seconds'},
      {value: 1, name: '1 minute'},
      {value: 2, name: '2 minutes'},
      {value: 3, name: '3 minutes'},
      {value: 4, name: '4 minutes'},
      {value: 5, name: '5 minutes'}
    ],
    photoPrivacies: [
      {value: 'none', name: 'None'},
      {value: 'blur', name: 'Blur'},
      {value: 'pixelate', name: 'Pixelate'},
      {value: 'silhouette', name: 'Presence Only'}
    ],
    photoSources: [],
    photoSupported: Camera.supported
  },
  partials: {
    menuAvailable: require('./menu-available.ractive'),
    menuNotifications: require('./menu-notifications.ractive'),
    menuPhoto: require('./menu-photo.ractive'),
    menuRooms: require('./menu-rooms.ractive'),
    menuHelp: require('./menu-help.ractive')
  },
  computed: {
    photoDisabled: {
      get: function() { return !this.get('user.photoEnabled'); },
      set: function(value) { this.set('user.photoEnabled', !value); }
    },
    busy: {
      get: function() { return !this.get('user.available'); },
      set: function(value) { this.set('user.available', !value); }
    },
    muteSounds: {
      get: function() { return !this.get('user.playSounds'); },
      set: function(value) { this.set('user.playSounds', !value); }
    },
    notificationsDisabled: {
      get: function() { return !this.get('user.notificationsEnabled'); },
      set: function(value) { this.set('user.notificationsEnabled', !value); }
    }
  },

  init: function() {
    View.prototype.init.apply(this, arguments);

    // Set up camera info
    this.get('user').get('camera').sources(_.bind(function(sources) {
      this.set({photoSources: sources});
    }, this));

    // Auto-save on data change
    this.on('change', _.bind(function(event) {
      this.get('user').save();
    }, this));

    // Control dropdowns
    this.$('.menubar .btn-dropdown').click(_.bind(this._onClickDropdown, this));
    this.$('.menubar .dropdown-menu').click(_.bind(this._onClickDropdownContent, this));
    $(document).click(_.bind(this._onClickPage, this));

    // Tooltips
    this.$('.menubar > .btn')
      .tooltip({placement: 'bottom', animation: false, html: true, title: this._title})
      .change(_.bind(this._onChangeButton, this));
  },

  /**
   * Show the room directory UI
   */
  showRoomDirectory: function(event) {
    event.original.stopPropagation();
    this.$('.menubar .btn-dropdown').removeClass('open');

    new DialogView({
      components: {content: RoomDirectoryView},
      data: {
        id: 'rooms',
        title: 'Room Directory',
        rooms: app.get('rooms')
      }
    });
  },

  /**
   * Show the help guide UI
   */
  showHelpGuide: function(event) {
    event.original.stopPropagation();
    this.$('.menubar .btn-dropdown').removeClass('open');

    new DialogView({
      components: {content: HelpShowView},
      data: {
        id: 'help',
        title: 'Help Guide'
      }
    });
  },

  /**
   * Gets the title for the given button
   */
  _title: function() {
    var $btn = $(this);
    var title = $btn.find('> input').prop('checked') ? $btn.data('title-on') : $btn.data('title-off');
    return title || $btn.attr('title');
  },

  /**
   * Callback when use has clicked on the dropdown menu
   */
  _onClickDropdown: function(event) {
    // Toggle other dropdowns
    var $dropdown = $(event.currentTarget);
    this.$('.menubar .btn-dropdown').not($dropdown).removeClass('open');

    $dropdown.toggleClass('open');
    event.stopPropagation();
  },

  /**
   * Callback when the user has clicked somewhere within the content of the
   * dropdown menu
   */
  _onClickDropdownContent: function(event) {
    event.stopPropagation();
  },

  /**
   * Callback when the user has clicked somewhere on the page
   */
  _onClickPage: function(event) {
    if (!$(event.target).parents('.dropdown-menu').length) {
      this.$('.menubar > .open').removeClass('open');
    }
  },

  /**
   * Callback when one of the main buttons has changed state
   */
  _onChangeButton: function(event) {
    var $setting = $(event.target);

    // Reset the text shown for the tooltip
    $setting.parent('.btn').tooltip('show');

    // Sync up
    this.updateModel();
  },
});

module.exports = SettingListView;