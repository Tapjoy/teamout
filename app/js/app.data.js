app.data = {
  // Represents the local version of the state
  state: {},

  init: function() {
    this.state = gapi.hangout.data.getState();
    this.cleanup();
    gapi.hangout.data.onStateChanged.add($.proxy(this.onChanged, this));
  },

  /**
   * Cleans up keys belonging to participants no longer in this hangout
   */
  cleanup: function() {
    var participantIds = app.participants.ids();
    var keys = this.keys();

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var participantId = app.participants.idFromKey(key);

      if ($.inArray(participantId, participantIds) == -1) {
        this.clear(key);
      }
    }
  },

  /**
   * Sets the given key in shared state
   */
  set: function(key, value) {
    this.state[key] = value;
    gapi.hangout.data.setValue(key, value);
  },

  /**
   * Gets the given key in shared state
   */
  get: function(key) {
    return this.state[key];
  },

  /**
   * Clears / removes the given key in shared state
   */
  clear: function(key) {
    delete this.state[key];
    gapi.hangout.data.clearValue(key);
  },

  /**
   * Gets the list of keys in shared state
   */
  keys: function() {
    return gapi.hangout.data.getKeys();
  },

  /**
   * Syncs up additions / removals of keys.  Only keys added / removed that
   * are associated with other users will actually get synced here.  The
   * assumption is that keys associated with the current user get set
   * directly through calling #set / #remove instead of through a sync.
   */
  sync: function(addedKeys, removedKeys) {
    for (var i = 0; i < addedKeys.length; i++) {
      var key = addedKeys[i];
      var participantId = app.participants.idFromKey(key.key);

      if (participantId != app.participant.id) {
        this.state[key.key] = key.value;
        this.onKeyAdded(key.key, key.value);
      }
    }

    for (var i = 0; i < removedKeys.length; i++) {
      var key = removedKeys[i];
      var participantId = app.participants.idFromKey(key);

      if (participantId != app.participant.id) {
        delete this.state[key];
        this.onKeyRemoved(key);
      }
    }
  },

  /**
   * Callback when the state of this extension has changed
   */
  onChanged: function(event) {
    this.sync(event.addedKeys, event.removedKeys);
  },

  /**
   * Callback when a key has been added to the shared data
   */
  onKeyAdded: function(key, value) {
    var participant = app.participants.fromKey(key);
    var resource = key.match(/^[^\/]+\/([^\/]+)/)[1];

    if (resource == 'photo' || resource == 'photos') {
      // Photo updated
      app.participants.updatePhoto(participant);
    } else if (resource == 'requests') {
      if (key.indexOf(app.participant.id) > 0) {
        // Participant joined in hangout with this user
        app.conversation.add(participant, false);
      }
    } else if (resource == 'hanging_with') {
      // Participant joined in hangout with another user
      app.participants.addConversation(participant);
    } else if (resource == 'available') {
      app.participants.updateAvailability(participant);
    }
  },

  /**
   * Callback when a key has been removed from the shared data
   */
  onKeyRemoved: function(key) {
    var participant = app.participants.fromKey(key);
    var resource = key.match(/^[^\/]+\/([^\/]+)/)[1];

    if (participant && resource == 'hanging_with') {
      if (app.participant.isHangingWith(participant)) {
        // Participant left a hangout with this user
        app.conversation.remove(participant);
      } else {
        // Participant is no longer in a hangout
        app.participants.removeConversation(participant);
      }
    }
  }
};