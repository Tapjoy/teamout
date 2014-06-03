var Collection = require('../lib/collection.js');
var Room = require('../models/room.js');

// A collection of Room models
var Rooms = Collection.extend({
  url: '/rooms',
  model: Room,
  comparator: function (room) {
    return room.get('id');
  },

  /**
   * Lists all of the rooms that have not been hidden by the user
   */
  visible: function() {
    return this.select(function(room) { return !room.isHidden(); });
  }
});

module.exports = Rooms;