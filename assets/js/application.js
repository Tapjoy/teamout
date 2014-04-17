var app = {
  /**
   * Initializes the state of the application
   */
  init: function() {
    gadgets.util.registerOnLoadHandler($.proxy(this.onLoad, this));
  },

  /**
   * Callback when the gadget is ready
   */
  onLoad: function() {
    gapi.hangout.onApiReady.add($.proxy(this.onReady, this));
  },

  /**
   * Callback when the Hangouts API is fully ready
   */
  onReady: function(event) {
    if (event.isApiReady) {
      this.initAV();
      this.refreshParticipants();
    }
  },

  /**
   * Sets the initial state of the layout on the screen
   */
  initLayout: function() {
    gapi.hangout.layout.setChatPaneVisible(false);
  },

  /**
   * Sets the initial state of audio / video for the local participant
   */
  initAV: function() {
    // Mute the local participant
    gapi.hangout.av.setLocalAudioNotificationsMute(true);
    gapi.hangout.av.setLocalParticipantVideoMirrored(false);
    gapi.hangout.av.setCameraMute(true);
    gapi.hangout.av.setMicrophoneMute(true);

    // Mute / Hide remote participants
    var participants = gapi.hangout.getParticipants();
    for (var index in participants) {
      var participant = participants[index];
      gapi.hangout.av.setParticipantAudible(participant.id, false);
      gapi.hangout.av.setParticipantVisible(participant.id, false);
    }
  },

  /**
   * Refreshes snapshots for the current participants
   */
  refreshParticipants: function() {
    var participants = gapi.hangout.getParticipants();
    var retVal = '<p>Participants: </p><ul>';

    for (var index in participants) {
      var participant = participants[index];

      if (!participant.person) {
        retVal += '<li>A participant not running this app</li>';
      }
      retVal += '<li>' + participant.person.displayName + '</li>';
    }

    retVal += '</ul>';
    var div = document.getElementById('participantsDiv');
    div.innerHTML = retVal;
  }
};

app.init();