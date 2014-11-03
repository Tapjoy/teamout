var View = require('../../lib/view.js');

// The directory of rooms available to chat
var RoomDirectoryView = View.extend({
  template: require('./directory.ractive'),
  eventNames: ['shareRoom', 'hideRoom', 'createRoom', 'pressKey'],
  data: {
    newRoomId: ''
  },
  computed: {
    visibleRooms: function() {
      return this.get('rooms').visible();
    }
  },

  init: function() {
    View.prototype.init.apply(this, arguments);

    this.get('rooms').on('change', this._onRoomChanged, this);
  },

  /**
   * Callback when the user has clicked on the url for the room
   */
  shareRoom: function(event) {
    var input = event.node;
    input.focus();
    input.select();
  },

  /**
   * Callback when the user has requested to hide a room
   */
  hideRoom: function(event, room) {
    event.original.stopPropagation();
    event.original.preventDefault();

    room.hide();
    this.update();
  },

  /**
   * Callback when the user has requested to create a room
   */
  createRoom: function() {
    var roomId = this.get('newRoomId');
    if (roomId) {
      var room = this.get('rooms').add({id: roomId});
      room.unhide();
      this.set({newRoomId: ''})
    }

    this.update();
  },

  /**
   * Callback when the user has pressed a key for the room id field
   */
  pressKey: function(event) {
    if (event.original.which == '13') {
      this.createRoom(event);
    }
  },

  /**
   * Callback when the data associated with a room has changed
   */
  _onRoomChanged: function(room) {
    this.update('visibleRooms');
  }
});

module.exports = RoomDirectoryView;