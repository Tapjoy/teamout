app.rooms = {
  // The id for this hangout
  id: 'default',

  // The group (e.g. company) this hangout belongs to
  groupId: 'default',

  init: function() {
    var startData = gapi.hangout.getStartData() || app.data.get('room/data');
    if (startData) {
      this.setIdFromData(startData);
    }

    // Merge the room's ids + this user's stored ids + this room's id
    var ids = this.ids().concat(this.storedIds());
    if (this.id != 'default') {
      ids.push(this.id);
    }
    this.set('room_ids', ids, true);

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
    var startData = this.groupId + ',' + roomId;
    var hangoutId = (new jsSHA(startData, 'TEXT')).getHash('SHA-1', 'HEX');

    return 'https://talkgadget.google.com/hangouts/_/widget/' + hangoutId + '?gid=' + app.id + '&gd=' + startData;
  },

  /**
   * Updates the URL shown in the UI for sharing
   */
  updateShareUrl: function() {
    $('#rooms .rooms-share input').val(this.url());
    $('#rooms .rooms-share .rooms-share-name').text('@' + this.id);
  },

  /**
   * Gets the list of room ids known within the hangout
   */
  ids: function() {
    return JSON.parse(app.data.get('room/room_ids') || '[]');
  },

  /**
   * Gets the list of room ids known by the user
   */
  storedIds: function() {
    return JSON.parse(app.settings.get(this.groupId + '/room_ids') || '[]');
  },

  /**
   * Gets the list of room ids the user has requested to not display in the UI
   */
  blacklistedIds: function() {
    return JSON.parse(app.settings.get(this.groupId + '/blacklisted_room_ids') || '[]');
  },

  /**
   * Determines whether the given room is blacklisted by the user
   */
  isBlacklisted: function(roomId) {
    return $.inArray(roomId, this.blacklistedIds()) >= 0;
  },

  /**
   * Determines whether the given room is whitelisted by the user
   */
  isWhitelisted: function(roomId) {
    return !this.isBlacklisted(roomId);
  },

  /**
   * Gets the list of room ids to display in the UI
   */
  visibleIds: function() {
    return $.grep(this.ids(), $.proxy(function(id) {
      return id != this.id && this.isWhitelisted(id);
    }, this));
  },

  /**
   * Determines whether there are any rooms to display
   */
  isEmpty: function() {
    return this.visibleIds().length == 0;
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
      // Determine the new list of ids
      this.set('room_ids', this.ids().concat([roomId]), true);

      // Remove it from the list of blacklisted ids
      var blacklistedIds = $.grep(this.blacklistedIds(), function(id) { return id != roomId; });
      this.set('blacklisted_room_ids', blacklistedIds);

      // Update the UI
      this.update();
      $('#rooms .rooms-create input').val('');
    }
  },

  /**
   * Update UI to reflect the current list of room ids
   */
  update: function() {
    var currentIds = this.visibleIds();
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

    // Hide the "no rooms" notice
    $('#rooms .rooms-other .rooms-none').hide();

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
    // Blacklist the id
    this.set('blacklisted_room_ids', this.blacklistedIds().concat([roomId]));

    // Remove from UI
    $('#room-' + this.safeId(roomId)).remove();

    if (this.isEmpty()) {
      // Show the "no rooms" notice
      $('#rooms .rooms-other .rooms-none').show();
    }
  },

  /**
   * Persists the given list of roomIds.  If remote is set, then the data will
   * also be share with other users in the hangout.
   */
  set: function(listName, ids, remote) {
    ids = $.unique(ids);
    ids.sort();
    var data = JSON.stringify(ids);

    app.settings.set(this.groupId + '/' + listName, data);

    if (remote) {
      app.data.set('room/' + listName, data);
    }
  },

  /**
   * Navigates to the given room
   */
  go: function(roomId) {
    window.top.location = this.urlFor(roomId);
  }
};