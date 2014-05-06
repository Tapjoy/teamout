// Represents the avatar for the user
app.avatar = {
  // The size to generate for avatars
  size: 300,

  init: function() {
    gapi.hangout.layout.getDefaultVideoFeed().onDisplayedParticipantChanged.add($.proxy(this.onAvatarSelected, this));

    this.show();
    this.onAvatarSelected();
  },

  /**
   * Callback when the user has attempted to change the currently displayed
   * participant in the video feed
   */
  onAvatarSelected: function() {
    if (!app.participant.isHanging()) {
      gapi.hangout.layout.getDefaultVideoFeed().setDisplayedParticipant(app.participant.id);
    }
  },

  /**
   * Shows the latest photo as the user's current avatar
   */
  show: function() {
    var canvas = $('<canvas />').attr({width: this.size, height: this.size})[0];
    var context = canvas.getContext('2d');
    context.fillStyle = '#181818';
    context.fillRect(0, 0, canvas.width, canvas.height);

    var url = canvas.toDataURL('image/jpeg');
    gapi.hangout.av.setAvatar(app.participant.id, url);
  },

  /**
   * Clears the avatar for the current user
   */
  clear: function() {
    gapi.hangout.av.clearAvatar(app.participant.id);
  }
};