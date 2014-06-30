var $ = require('jquery');
var _ = require('underscore');
var WebFont = require('webfont');

var Model = require('../lib/model.js');
var Notifier = require('../lib/notifier.js');
var Platform = require('../lib/platform.js');
var AuthorizedUser = require('./authorizeduser.js')
var Rooms = require('../collections/rooms.js');

// The main application (singleton)
var App = Model.extend({
  urlRoot: '/app',
  defaults: {
    id: 'default',
    roomId: 'default',
    roomIds: [],
    rooms: new Rooms(),
    components: {
      platform: false,
      fonts: false
    },
    host: (function() {
      var src = $('script').filter(function() {
        var src = $(this).attr('src');
        return src && src.indexOf('assets/js/main.js') >= 0;
      }).attr('src');

      var match = src && src.match(/(\/\/([^\/]+))?(\/(.*))?\/assets\/js\/main\.js/);
      var host = match[2] || location.host;
      var path = match[3] || '';

      return host + path;
    })()
  },

  initialize: function() {
    // Track when platform is ready
    Platform.initialize();
    if (Platform.isReady()) {
      this.ready('platform');
    } else {
      Platform.once('ready', _.bind(this.ready, this, 'platform'));
    }

    // Track when fonts are ready
    WebFont.load({
      custom: {
        families: ['Glyphicons Regular'],
        testStrings: {'Glyphicons Regular': "\uE004\uE039\uE073\uE111\uE125\uE162\uE171"}
      },
      active: _.bind(this.ready, this, 'fonts')
    });

    // Set up notifications
    _.extend(Notifier.defaults, {
      icon: 'http://' + this.get('host') + '/assets/images/google-hangouts-icon.png'
    });
  },

  /**
   * Loads fonts required for this application and invokes the callback when
   * complete
   */
  ready: function(component) {
    var components = this.get('components');
    components[component] = true;

    var isReady = _.every(_.keys(components), function(component) {
      return components[component];
    });

    if (isReady) {
      this._onReady();
    }
  },

  /**
   * Callback when the Hangouts API is fully ready
   */
  _onReady: function() {
    // Set up app
    this.set(Platform.getSeedData());
    this.fetch();

    // Set up current room
    var rooms = this.get('rooms');
    var room = rooms.add({id: this.get('roomId')});
    this.set({room: room});

    // Set up current user
    var user = new AuthorizedUser(Platform.getCurrentUser());
    this.set({user: user});
    room.enter();

    // Track room directory
    rooms.add(this.get('roomIds').concat(user.get('roomIds')));
    this.on('change:roomIds', function(self, roomIds) { rooms.add(roomIds); }, this);
    rooms.on('add remove', this._onRoomsChanged, this);
    this._onRoomsChanged();

    this.trigger('ready');
  },

  /**
   * Callback when the list of rooms has changed
   */
  _onRoomsChanged: function() {
    var roomIds = this.get('rooms').pluck('id');

    // Save to both the app and the user
    this.save({roomIds: roomIds});
    this.get('user').save({roomIds: roomIds});
  },

  /**
   * Generates a JSON representation of the model.
   */
  toJSON: function() {
    var attributes = Model.prototype.toJSON.apply(this, arguments);
    return _.pick(attributes, 'id', 'roomId', 'roomIds');
  }
});

module.exports = App;