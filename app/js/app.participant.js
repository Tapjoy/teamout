// Represents the current, local participant
app.participant = {
  init: function() {
    var participant = gapi.hangout.getLocalParticipant();
    this.id = participant.id;
    this.googleId = participant.person.id;

    // Clean up old data
    this.cleanup();

    // Set up audio / video streams
    this.mute();
    gapi.hangout.av.setLocalAudioNotificationsMute(true);
    gapi.hangout.av.setLocalParticipantVideoMirrored(false);
    gapi.hangout.av.onCameraMute.add($.proxy(this.onCameraMute, this));
    gapi.hangout.av.onMicrophoneMute.add($.proxy(this.onMicrophoneMute, this));
  },

  /**
   * Resets all data associated with this participant
   */
  cleanup: function() {
    var keys = app.data.keys();
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var participantId = app.participants.idFromKey(key);
      if (participantId == app.participant.id) {
        app.data.clear(key);
      }
    }
  },

  /**
   * Mutes the local participant
   */
  mute: function(muted) {
    if (muted === undefined) { muted = true; }

    gapi.hangout.av.setCameraMute(muted);
    gapi.hangout.av.setMicrophoneMute(muted);
  },

  /**
   * Callback when the user has changed whether the camera is muted
   */
  onCameraMute: function(event) {
    if (!this.isHanging() && !event.isCameraMute) {
      this.mute();
    }
  },

  /**
   * Callback when the user has changed whether the microphone is muted
   */
  onMicrophoneMute: function(event) {
    if (!this.isHanging() && !event.isMicrophoneMute) {
      this.mute();
    }
  },

  /**
   * Determines whether the given participant is currently hanging with other users
   */
  isHanging: function() {
    return this.hangingWith().length > 0;
  },

  /**
   * Determines whether the given participant is joined into a conversation
   * with the current user
   */
  isHangingWith: function(participant) {
    return $.inArray(participant.id, this.hangingWith()) >= 0
    ;
  },

  /**
   * Gets the list of participants this user is currently hanging with
   */
  hangingWith: function() {
    return app.participants.hangingWith(gapi.hangout.getLocalParticipant());
  },

  /**
   * Updates the participant ids currently hanging with this user
   */
  updateHangingWith: function(ids) {
    if (ids.length) {
      app.data.set(this.id + '/hanging_with', ids.join(','));
    } else {
      app.data.clear(this.id + '/hanging_with');
    }
  }
};