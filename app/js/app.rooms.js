app.rooms = {
  // The id for this hangout
  id: 'default',

  // The group (e.g. company) this hangout belongs to
  groupId: 'default',

  init: function() {
    var startData = gapi.hangout.getStartData() || app.data.get('startData');
    if (startData) {
      this.setIdFromData(startData);
    }

    this.updateShareUrl();
    this.update();

    // Register click handlers
    $('#rooms .rooms-create .btn').click($.proxy(this.onCreateRoom, this));
    $('#rooms .rooms-create input').keypress($.proxy(this.onKeyRoomId, this));
    $('#rooms .rooms-share input').click(function() { this.focus(); this.select(); });
  },

  /**
   * Sets the initial group / room id based on the given start data for the
   * hangout
   */
  setIdFromData: function(startData) {
    // Make sure other folks are aware of the group / room id
    app.data.set('room/data', startData);

    var parts = startData.match(/([^,]+),(.+)/);
    this.groupId = parts[1];
    this.id = parts[2];

    this.updateShareUrl();
  },

  /**
   * Generates an HTML-safe identifier for the given room id
   */
  safeId: function(roomId) {
    return roomId.replace(/[^a-zA-Z0-9]/g, '');
  },

  /**
   * Generates a hangout url for the current room.
   */
  url: function() {
    return this.urlFor(this.id);
  },

  /**
   * Generates a hangout url for the given room id.  This url will be consistent
   * across multiple calls.
   */
  urlFor: function(roomId) {
    var hangoutId = this.groupId + ',' + roomId;
    var hangoutHash = (new jsSHA(hangoutId, 'TEXT')).getHash('SHA-1', 'HEX');

    return 'https://talkgadget.google.com/hangouts/_/widget/' + hangoutHash + '?gid=' + app.id + '&gd=' + hangoutId;
  },

  /**
   * Updates the URL shown in the UI for sharing
   */
  updateShareUrl: function() {
    $('#rooms .rooms-share input').val(this.url());
  },

  /**
   * Gets the current list of room ids saved for the user
   */
  ids: function() {
    return JSON.parse(app.data.get('room/room_ids') || '[]');
  },

  /**
   * Callback when the user has requested to join a room
   */
  onJoinRoom: function(event) {
    event.preventDefault();

    var $room = $(event.target).parents('li');
    var roomId = $room.data('roomId');
    this.go(roomId);
  },

  /**
   * Callback when the user has requested to remove a room
   */
  onRemoveRoom: function(event) {
    event.stopPropagation();
    event.preventDefault();

    var $room = $(event.target).parents('li');
    var roomId = $room.data('roomId');
    this.remove(roomId);
  },

  /**
   * Callback when the user has requested to create a room
   */
  onCreateRoom: function(event) {
    var roomId = $('#rooms .rooms-create input').val();
    this.create(roomId);
  },

  /**
   * Callback when the user has pressed a key for the room id field
   */
  onKeyRoomId: function(event) {
    if (event.which == '13') {
      this.onCreateRoom(event);
    }
  },

  /**
   * Shows the room directory UI
   */
  show: function() {
    $('#rooms').modal('show');
  },

  /**
   * Creates a room with the given id and adds it to the UI
   */
  create: function(roomId) {
    if (roomId) {
      var roomIds = this.ids();
      roomIds.push(roomId);
      roomIds.sort();
      roomIds = $.unique(roomIds);
      app.data.set('room/room_ids', JSON.stringify(roomIds));

      this.add(roomId);
      $('#rooms .rooms-create input').val('');
    }
  },

  /**
   * Update UI to reflect the current list of room ids
   */
  update: function() {
    var currentIds = this.ids();
    var listedIds = $('#rooms .rooms-other .nav li').map(function() { return $(this).data('roomId'); });

    // Add new rooms
    for (var i = 0; i < currentIds.length; i++) {
      var id = currentIds[i];
      if ($.inArray(id, listedIds) == -1) {
        this.add(id);
      }
    }

    // Remove deleted rooms
    for (var i = 0; i < listedIds.length; i++) {
      var id = listedIds[i];
      if ($.inArray(id, currentIds) == -1) {
        this.remove(id);
      }
    }
  },

  /**
   * Adds the given room id to the UI
   */
  add: function(roomId) {
    var name = '@' + roomId;

    var $nav = $('#rooms .rooms-other .nav');
    var $rooms = $nav.find('li');
    var $room = $('<li />')
      .attr({id: 'room-' + this.safeId(roomId)})
      .data({roomId: roomId})
      .click($.proxy(this.onJoinRoom, this))
      .append(
        $('<a />').attr({href: this.urlFor(roomId)}).text(name).append(
          $('<span />')
            .addClass('glyphicon glyphicon-remove')
            .attr({title: 'Remove'})
            .click($.proxy(this.onRemoveRoom, this))
        )
      );

    var names = $rooms.map(function() { return $(this).text(); });
    names.push(name);
    names.sort();

    // Add in the right position
    var position = $.inArray(name, names);
    if (position == 0) {
      $room.prependTo($nav);
    } else if (position == names.length - 1) {
      $room.appendTo($nav);
    } else {
      $room.insertBefore($rooms.eq(position));
    }
  },

  /**
   * Removes the given room id from the user's current list
   */
  remove: function(roomId) {
    var roomIds = this.ids();
    var index = $.inArray(roomId, roomIds);
    if (index >= 0) {
      roomIds.splice(index, 1);
      app.data.set('room/room_ids', JSON.stringify(roomIds));
    }

    // Remove from UI
    $('#room-' + this.safeId(roomId)).remove();
  },

  /**
   * Navigates to the given room
   */
  go: function(roomId) {
    window.top.location = this.urlFor(roomId);
  }
};