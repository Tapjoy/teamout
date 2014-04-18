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
   * Returns the current timestamp
   */
  now: function() {
    return +(new Date());
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
      this.avatar.init();

      gapi.hangout.data.onStateChanged.add($.proxy(this.onStateChanged, this));
    }
  },

  /**
   * Callback when the state of this extension has changed
   */
  onStateChanged: function(event) {
    var keys = event.addedKeys;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i].key;

      if (key.match(/\/avatar/)) {
        var participantId = key.match(/(.*)\/avatar/)[1];
        var participant = gapi.hangout.getParticipantById(participantId);

        if (participant) {
          this.participants.updateAvatar(participant);
        }
      }
    }
  },

  // Represents the layout of the hangout
  layout: {
    /**
     * Sets the initial state of the layout on the screen
     */
    init: function() {
      gapi.hangout.layout.setChatPaneVisible(false);

      $('.menubar > li > a').click($.proxy(this.initScrollers, this));
      this.initScrollers();
    },

    /**
     * Initializes scroll panes on the page
     */
    initScrollers: function() {
      setTimeout(function() {
        $('.nano:visible').nanoScroller({alwaysVisible: true});
      }, 0);
    },
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
      gapi.hangout.onParticipantsAdded.add($.proxy(this.onAdded, this));
      gapi.hangout.onParticipantsRemoved.add($.proxy(this.onRemoved, this));
    },

    /**
     * Callback when a participant is added to the hangout
     */
    onAdded: function(event) {
      var participants = event.addedParticipants;
      for (var i = 0; i < participants.length; i++) {
        var participant = participants[i];
        this.add(participant);
      }

      this.refresh();
    },

    /**
     * Adds the given participant to the hangout
     */
    add: function(participant) {
      this.mute(participant);
    },

    /**
     * Callback when a participant is removed from the hangout
     */
    onRemoved: function(event) {
      var participants = event.removedParticipants;
      for (var i = 0; i < participants.length; i++) {
        var participant = participants[i];
        this.remove(participant);
      }

      this.refresh();
    },

    /**
     * Removes the given participant from the hangout
     */
    remove: function(participant) {
      var keys = gapi.hangout.data.getKeys();
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.indexOf(participant) >= 0) {
          gapi.hangout.data.clearValue(key);
        }
      }
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
      var participants = gapi.hangout.getParticipants();
      for (var i = 0; i < participants.length; i++) {
        var participant = participants[0];
        this.updateAvatar(participant);
      }
    },

    /**
     * Updates the image for the given participant
     */
    updateAvatar: function(participant) {
      // if (participant.id != gapi.hangout.getLocalParticipant().id) {
        // Build the image data url
        var data = gapi.hangout.data.getValue(participant.id + '/avatar');
        if (!data) { return; }

        var avatarId = data.split(',')[0];
        var partsCount = parseInt(data.split(',')[1]);

        var imageDataUrl = '';
        for (var i = 0; i < partsCount; i++) {
          var part = gapi.hangout.data.getValue(participant.id + '/avatars/' + avatarId + '/parts/' + i);
          if (!part) { return; }

          imageDataUrl += part;
        }

        var $participants = $('.participants');
        var $participant = $('#' + participant.person.id);
        if ($participant.length) {
          // Fade in the new avatar
          var $previousAvatar = $participant.find('img');
          var $newAvatar = $('<img />')
            .attr({src: imageDataUrl})
            .hide()
            .addClass('img-rounded')
            .prependTo($participant)
            .fadeIn(250, $.proxy($previousAvatar.remove, $previousAvatar));
        } else {
          // Add a new avatar to the list
          var $link = $('<a />')
            .attr({href: '#'})
            .addClass('thumbnail')
            .append(
              $('<img />').attr({src: imageDataUrl}).addClass('img-thumbnail'),
              $('<div />').addClass('action').append(
                $('<span />').addClass('glyphicon glyphicon-facetime-video'),
                $('<span />').text('Start Conversation')
              ),
              $('<span />').addClass('caption').text(participant.person.displayName)
            )
            .click($.proxy(this.onJoinRequest, this));

          $('<li />')
            .addClass('list-group-item')
            .append($link)
            .appendTo($participants);
        }
      // }
    },

    /**
     * Callback when the local participant has requested to join another participant
     */
    onJoinRequest: function(event) {

    }
  },

  avatar: {
    // Dimensions of avatars
    width: 300,
    height: 225,
    quality: 0.7,

    // The maximum size avatar parts can be stored in
    partSize: 8192,

    // Provides a helper for building URLs from streams
    buildURL: window.webkitURL || window.URL,

    init: function() {
      this.refresh();
      // setInterval($.proxy(this.refresh, this), 15000);
    },

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
      return gapi.hangout.av.getCameraMute() == true && gapi.hangout.av.getMicrophoneMute() == true;
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
      var video = $('<video />').attr({width: this.width, height: this.height})[0];
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
        var canvas = $('<canvas />').attr({width: this.width, height: this.height})[0];
        var context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, this.width, this.height);

        // Convert to Black & White
        this.convertToBW(canvas, context);

        // Save the image and kill the video
        var imageDataUrl = canvas.toDataURL('image/jpeg', this.quality);
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

      // Clear out old avatar keys
      var oldAvatarKeys = gapi.hangout.data.getKeys();
      for (var i = 0; i < oldAvatarKeys.length; i++) {
        var key = oldAvatarKeys[i];
        if (key.indexOf(participant.id) == 0 && key.indexOf('/avatars') > 0) {
          gapi.hangout.data.clearValue(key);
        }
      }

      var avatarId = app.now();

      // Send a notification to other participants of the updated image
      for (var i = 0; i < imageDataUrl.length; i += this.partSize) {
        var partId = i / this.partSize;
        var data = imageDataUrl.substr(i, Math.min(imageDataUrl.length - i, this.partSize));
        gapi.hangout.data.setValue(participant.id + '/avatars/' + avatarId + '/parts/' + partId, data)
      }

      var partsCount = Math.ceil(imageDataUrl.length / this.partSize);
      gapi.hangout.data.setValue(participant.id + '/avatar', avatarId + ',' + partsCount);
    }
  }
};

app.init();