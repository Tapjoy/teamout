var app = {
  /**
   * Initializes the state of the application
   */
  init: function() {
    // The browser-specific implementation for retrieving a webcam stream
    navigator.getMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

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
      this.participant.init();
      this.participants.init();
      this.layout.init();
      this.avatar.refresh();

      gapi.hangout.data.onStateChanged($.proxy(this.onStateChanged, this));
    }
  },

  /**
   * Callback when the state of this extension has changed
   */
  onStateChanged: function(event) {
    console.log('STATE CHANGED');
    console.log(event);
  },

  // Represents the layout of the hangout
  layout: {
    /**
     * Sets the initial state of the layout on the screen
     */
    init: function() {
      gapi.hangout.layout.setChatPaneVisible(false);
    }
  },

  // Represents the current, local participant
  participant: {
    init: function() {
      this.mute();
      gapi.hangout.av.setLocalAudioNotificationsMute(true);
      gapi.hangout.av.setLocalParticipantVideoMirrored(false);
    },

    /**
     * Mutes the local participant
     */
    mute: function(muted) {
      if (muted === undefined) { muted = true; }

      gapi.hangout.av.setCameraMute(muted);
      gapi.hangout.av.setMicrophoneMute(muted);
    }
  },

  // Represents all participants in the hangout
  participants: {
    init: function() {
      this.muteAll();
      gapi.hangout.onParticipantsAdded($.proxy(this.onAdded, this));
      gapi.hangout.onParticipantsRemoved($.proxy(this.onRemoved, this));
    },

    /**
     * Callback when a participant is added to the hangout
     */
    onAdded: function(event) {
      var participants = event.addedParticipants;
      for (var i = 0; i < participants.length; i++) {
        var participant = participants[i];
        this.mute(participant);
      }

      this.refresh();
    },

    /**
     * Callback when a participant is removed from the hangout
     */
    onRemoved: function(event) {
      this.refresh();
    },

    /**
     * Mutes all remote participants
     */
    muteAll: function() {
      var participants = gapi.hangout.getParticipants();
      for (var index in participants) {
        var participant = participants[index];
        this.mute(participant);
      }
    },

    /**
     * Mutes the given participant
     */
    mute: function(participant, muted) {
      if (muted === undefined) { muted = true; }

      gapi.hangout.av.setParticipantAudible(participant.id, muted);
      gapi.hangout.av.setParticipantVisible(participant.id, muted);
    },

    /**
     * Refreshes snapshots for the current participants
     */
    refresh: function() {
      // var participants = gapi.hangout.getParticipants();
      // var retVal = '<p>Participants: </p><ul>';

      // for (var index in participants) {
      //   var participant = participants[index];

      //   if (!participant.person) {
      //     retVal += '<li>A participant not running this app</li>';
      //   }
      //   retVal += '<li>' + participant.person.displayName + '</li>';
      // }

      // retVal += '</ul>';
      // var div = document.getElementById('participantsDiv');
      // div.innerHTML = retVal;
    }
  },

  avatar: {
    // Provides a helper for building URLs from streams
    buildURL: window.webkitURL || window.URL,

    /**
     * Refreshes the image representing the local participant
     */
    refresh: function() {
      if (this.canRefresh()) {
        navigator.getMedia(
          {video: true},
          $.proxy(this.refreshWithStream, this),
          $.proxy(this.onError, this)
        );
      }
    },

    /**
     * Determines whether the avatar is capable of being refrehs
     */
    canRefresh: function() {
      return gapi.hangout.av.getCameraMute() == true && gapi.hangout.av.getMicrophoneMute() == true
    },

    /**
     * Callback when the system is ready to refresh
     */
    refreshWithStream: function(stream) {
      var urlBuilder = window.webkitURL || window.URL;
      var url = urlBuilder ? urlBuilder.createObjectURL(stream) : stream;
      var video = this.buildVideo(url);
      $(video).on('canplay', $.proxy(function() {
        this.captureImage(video, $.proxy(this.update, this), $.proxy(this.onError, this));
      }, this));
    },

    /**
     * Callback when an error is encountered updating the avatar
     */
    onError: function(error) {
      console.log('Error updating avatar: ', error); 
    },

    /**
     * Loads a video feed for the given url, capturing the first image available
     */
    buildVideo: function(url) {
      var video = $('<video />').attr({width: 640, height: 480})[0];
      video.src = url;
      video.play();
      return video;
    },

    /**
     * Captures the image 
     */
    captureImage: function(video, success, error) {
      try {
        // Draw the video onto our canvas
        var canvas = $('<canvas />').attr({width: 640, height: 480})[0];
        var context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, 640, 480);

        // Convert to Black & White
        this.convertToBW(canvas, context);

        // Save the image and kill the video
        var imageDataUrl = canvas.toDataURL('image/png');
        video.pause();

        success(imageDataUrl);
      } catch(e) {
        if (e.name == 'NS_ERROR_NOT_AVAILABLE') {
          setTimeout($.proxy(this.captureImage, this, video, success, error), 1000);
        } else {
          error(e);
        }
      }
    },

    /**
     * Converts the image on the given canvas to black and white
     */
    convertToBW: function(canvas, context) {
      var data = context.getImageData(0, 0, canvas.width, canvas.height);
      var pixels = data.data;

      for (var i = 0, n = pixels.length; i < n; i += 4) {
        var grayscale = pixels[i] * 0.3 + pixels[i + 1] * 0.59 + pixels[i + 2] * 0.11;
        pixels[i] = grayscale; // red
        pixels[i + 1] = grayscale; // green
        pixels[i + 2] = grayscale; // blue
      }

      // Redraw the image in black and white
      context.putImageData(data, 0, 0);
    },

    /**
     * Updates the current participant's avatar with the given url
     */
    update: function(imageDataUrl) {
      var participant = gapi.hangout.getLocalParticipant();
      gapi.hangout.av.setAvatar(participant.id, imageDataUrl);

      // Send a notification to other participants of the updated image
      gapi.hangout.data.setValue('participants/' + participant.id + '/avatar', imageDataUrl)
    }
  }
};

app.init();