var app = {
  /**
   * Initializes the state of the application
   */
  init: function() {
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
      this.data.init();
      this.settings.init();
      this.layout.init();
      this.hangout.init();

      // Participant data
      this.participants.init();
      this.participant.init();
      this.avatar.init();
    }
  },

  data: {
    // Represents the local version of the state
    state: {},

    init: function() {
      // Set initial state
      this.state = gapi.hangout.data.getState();

      // Remove keys belonging to participants no longer in this hangout
      var participantIds = $.map(gapi.hangout.getParticipants(), function(participant) { return participant.id; });
      var keys = this.keys();
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var participantId = key.match(/^([^\/]+)\//)[1];
        if ($.inArray(participantId, participantIds) == -1) {
          this.clear(key);
        }
      }

      gapi.hangout.data.onStateChanged.add($.proxy(this.onChanged, this));
    },

    set: function(key, value) {
      this.state[key] = value;
      gapi.hangout.data.setValue(key, value);
    },

    get: function(key) {
      return this.state[key];
    },

    clear: function(key) {
      delete this.state[key];
      gapi.hangout.data.clearValue(key);
    },

    keys: function() {
      return gapi.hangout.data.getKeys();
    },

    sync: function(addedKeys, removedKeys) {
      for (var i = 0; i < addedKeys.length; i++) {
        var key = addedKeys[i];
        this.set(key.key, key.value)
      }

      for (var i = 0; i < removedKeys.length; i++) {
        var key = removedKeys[i];
        this.clear(key);
      }
    },

    /**
     * Callback when the state of this extension has changed
     */
    onChanged: function(event) {
      this.sync(event.addedKeys, event.removedKeys);

      var keys = event.addedKeys;
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i].key;
        var participantId = key.match(/^([^\/]+)\//)[1];
        var participant = gapi.hangout.getParticipantById(participantId);

        if (participant && participant.id != app.participant.id) {
          if (key.match(/\/avatar/)) {
            // Avatar updated
            app.participants.updateAvatar(participant);
          } else if (key.match(/\/participants/)) {
            var participantIds = this.get(key).split(',');
            if ($.inArray(app.participant.id, participantIds) >= 0) {
              // Participant joined in hangout with this user
              app.participants.join(participant, false);
            } else {
              // Participant joined in hangout with another user
              app.participants.inConversation(participant);
            }
          }
        }
      }

      var keys = event.removedKeys;
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var participantId = key.match(/^([^\/]+)\//)[1];
        var participant = gapi.hangout.getParticipantById(participantId);

        if (participant && participant.id != app.participant.id) {
          if (key.match(/\/participants/)) {
            var participantIds = this.get(app.participant.id + '/participants');
            participantIds = participantIds ? participantIds.split(',') : [];
            if ($.inArray(participant.id, participantIds) >= 0) {
              // Participant left a hangout with this user
              app.participants.leave(participant);
            } else {
              // Participant is no longer in a hangout
              app.participants.outOfConversation(participant);
            }
          } else {
            // TODO: Anything here?
          }
        }
      }
    },
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
      this.id = gapi.hangout.getLocalParticipant().id;
      this.resetData();
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
    },

    /**
     * Resets all data associated with this participant
     */
    resetData: function() {
      var keys = app.data.keys();
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.indexOf(this.id) == 0) {
          app.data.clear(key);
        }
      }
    }
  },

  // Represents all participants in the hangout
  participants: {
    init: function() {
      this.muteAll();
      this.updateAllAvatars();

      gapi.hangout.onParticipantsAdded.add($.proxy(this.onAdded, this));
      gapi.hangout.onParticipantsRemoved.add($.proxy(this.onRemoved, this));
    },

    /**
     * Generates an HTML-safe identifier for the given participant
     */
    safeId: function(participant) {
      return participant.id.replace(/[^a-zA-Z0-9]/g, '');
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
    },

    /**
     * Adds the given participant to the hangout
     */
    add: function(participant) {
      this.mute(participant);
      this.updateAvatar(participant);
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
    },

    /**
     * Removes the given participant from the hangout
     */
    remove: function(participant) {
      var keys = app.data.keys();
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.indexOf(participant) >= 0) {
          app.data.clear(key);
        }
      }

      this.removeAvatar(participant);

      // Remove them from the conversation
      if (app.participants.isJoined(participant)) {
        app.participants.leave(participant);
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

      gapi.hangout.av.setParticipantAudible(participant.id, !muted);
      gapi.hangout.av.setParticipantVisible(participant.id, !muted);
    },

    /**
     * Refreshes avatars for the current participants
     */
    updateAllAvatars: function() {
      var participants = gapi.hangout.getParticipants();
      for (var i = 0; i < participants.length; i++) {
        var participant = participants[0];
        this.updateAvatar(participant);
      }
    },

    /**
     * Updates the avatar for the given participant
     */
    updateAvatar: function(participant) {
      if (participant.id != app.participant.id) {
        var url = participant.person.image.url;

        var data = app.data.get(participant.id + '/avatar');
        if (data) {
          // Build the image data url
          var avatarId = data.split(',')[0];
          var partsCount = parseInt(data.split(',')[1]);

          var dataUrl = '';
          for (var i = 0; i < partsCount; i++) {
            var part = app.data.get(participant.id + '/avatars/' + avatarId + '/parts/' + i);
            if (!part) {
              dataUrl = null;
              break;
            }
            dataUrl += part;
          }

          if (dataUrl) {
            url = dataUrl;
          }
        }

        var $participants = $('.participants');
        var $participant = $('#' + this.safeId(participant));
        if ($participant.length) {
          // Fade in the new avatar
          var $previousAvatar = $participant.find('img').css({zIndex: 0});
          var $newAvatar = $('<img />')
            .attr({src: url})
            .css({zIndex: 1, opacity: 0.0})
            .addClass('img-thumbnail')
            .prependTo($participant.find('a'))
            .animate({opacity: 1.0}, {duration: 500, complete: $.proxy($previousAvatar.remove, $previousAvatar)});
        } else if (!this.isJoined(participant)) {
          // Add a new avatar to the list
          var $link = $('<a />')
            .attr({href: '#'})
            .addClass('thumbnail')
            .append(
              $('<img />').attr({src: url}).addClass('img-thumbnail'),
              $('<div />').addClass('action').append(
                $('<span />').addClass('glyphicon glyphicon-facetime-video'),
                $('<span />').text('Join Conversation')
              ),
              $('<span />').addClass('caption').text(participant.person.displayName)
            )
            .click($.proxy(this.onJoinRequest, this));

          // Create the new list item
          var $item = $('<li />')
            .data({id: participant.id})
            .attr({id: this.safeId(participant)})
            .addClass('list-group-item')
            .append($link);

          // Mark as already in a conversation if this is the case
          var participantIds = app.data.get(participant.id + '/participants');
          participantIds = participantIds ? participantIds.split(',') : [];
          if (participantIds.length) {
            $item.addClass('joined');
          }

          // Sort the new list of names
          var $items = $('.participants .list-group-item');
          var names = $items.map(function() {
            var participantId = $(this).data('id');
            var participant = gapi.hangout.getParticipantById(participantId);
            return participant.person.displayName;
          });
          names.push(participant.person.displayName);
          names.sort();

          // Add in the right position
          var position = $.inArray(participant.person.displayName, names);
          if (position == 0) {
            $item.prependTo($participants);
          } else if (position == names.length - 1) {
            $item.appendTo($participants);
          } else {
            $item.insertBefore($items.eq(position));
          }
        }
      }
    },

    /**
     * Removes the given user's avatar from the participants list
     */
    removeAvatar: function(participant) {
      $('#' + this.safeId(participant)).remove();
    },

    /**
     * Callback when the local participant has requested to join another participant
     */
    onJoinRequest: function(event) {
      var $participant = $(event.currentTarget).parent('.list-group-item');
      var participantId = $participant.data('id');
      var participant = gapi.hangout.getParticipantById(participantId);

      this.join(participant, true);
    },

    /**
     * Adds the given participant to the conversation
     */
    join: function(participant, initiatedLocally) {
      var newConversation = false;

      // Update the current participant's list of joined participants
      var key = app.participant.id + '/participants';
      var participantIds = app.data.get(key);
      participantIds = participantIds ? participantIds.split(',') : [];
      var newConversation = participantIds.length == 0;
      if ($.inArray(participant.id, participantIds) == -1) {
        otherIds = app.data.get(participant.id + '/participants');
        otherIds = otherIds ? otherIds.split(',') : [];
        participantIds = $.grep($.unique(participantIds.concat(otherIds).concat([participant.id])), function(id) {
          return id != app.participant.id;
        });
        app.data.set(key, participantIds.join(','));
      }

      // Unmute local and remote participant
      app.participant.mute(false);
      this.mute(participant, false);

      // Remove the remote participant from the list
      this.removeAvatar(participant);

      // Add a escape hatch
      app.hangout.showLeaveAction();

      // Play a sound to let the user know they're in a new conversation
      if (newConversation) {
        if (initiatedLocally) {
          if (participantIds.length == 1) {
            // Set the video to the selected participant
            gapi.hangout.layout.getVideoCanvas().getVideoFeed().setDisplayedParticipant(participant.id);
          }
        } else {
          var chime = new Audio('//hangjoy-799317505.us-west-2.elb.amazonaws.com/assets/audio/chime.ogg');
          chime.play();
        }
      }
    },

    /**
     * Marks the given participant as currently in a conversation
     */
    inConversation: function(participant) {
      $('#' + this.safeId(participant)).addClass('joined');
    },

    /**
     * Marks the given participant as no longer part of a conversation
     */
    outOfConversation: function(participant) {
      $('#' + this.safeId(participant)).removeClass('joined');
    },

    /**
     * Determines whether the given participant is joined into a conversation
     * with the current user
     */
    isJoined: function(participant) {
      var participantIds = app.data.get(app.participant.id + '/participants');
      return participantIds && participantIds.indexOf(participant.id) >= 0;
    },

    /**
     * Removes the given participant from the conversation
     */
    leave: function(participant) {
      // Update the current participant's list of joined participants
      var participantIds = app.data.get(app.participant.id + '/participants').split(',');
      var index = $.inArray(participant.id, participantIds);

      if (index >= 0) {
        participantIds.splice(index, 1);
        if (participantIds.length) {
          app.data.set(app.participant.id + '/participants', participantIds.join(','));
        } else {
          app.data.clear(app.participant.id + '/participants');
        }
      }

      // Mute the participant
      this.mute(participant, true);

      // Add the remote participant to the list
      this.updateAvatar(participant);
      if (participantIds.length == 0) {
        // Everyone left; behave as if we left ourselves
        app.hangout.leave();
      }
    }
  },

  hangout: {
    init: function() {
      $('.btn-leave').click($.proxy(this.leave, this));
    },

    /**
     * Shows an action on the screen for leaving the hangout
     */
    showLeaveAction: function() {
      $('.btn-leave').show();
    },

    /**
     * Hides the action for leaving the hangout
     */
    hideLeaveAction: function() {
      $('.btn-leave').hide();
    },

    /**
     * Leaves the current live feed in the hangout
     */
    leave: function() {
      // Clear the current user's list of participants
      app.data.clear(app.participant.id + '/participants');

      this.hideLeaveAction();

      // Mute everyone / reset participant list
      app.participant.mute();
      app.participants.muteAll();
      app.participants.updateAllAvatars();

      // Reset the video feed
      gapi.hangout.layout.getVideoCanvas().getVideoFeed().clearDisplayedParticipant();
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
      // The browser-specific implementation for retrieving a webcam stream
      navigator.getMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

      this.refresh();
      setInterval($.proxy(this.refresh, this), 60 * 1000);
    },

    /**
     * Refreshes the image representing the local participant
     */
    refresh: function() {
      if (this.canRefresh()) {
        navigator.getMedia(
          {video: true},
          $.proxy(this.refreshWithStream, this),
          $.proxy(this.onError, this, null)
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
      var url = window.URL.createObjectURL(stream);
      var video = this.buildVideo(url);
      $(video).on('canplay', $.proxy(function() {
        this.captureImage(video, stream, $.proxy(this.update, this), $.proxy(this.onError, this, stream));
      }, this));
    },

    /**
     * Callback when an error is encountered updating the avatar
     */
    onError: function(stream, error) {
      if (stream) {
        try {
          stream.stop();
        } catch(ex) {
          console.log('Error stopping stream: ', ex);
        }
      }

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
    captureImage: function(video, stream, success, error) {
      try {
        // Draw the video onto our canvas
        var canvas = $('<canvas />').attr({width: this.width, height: this.height})[0];
        var context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, this.width, this.height);

        // Convert to Black & White
        this.convertToBW(canvas, context);

        // Save the image and kill the video
        var url = canvas.toDataURL('image/jpeg', this.quality);
        video.pause();
        stream.stop();

        success(url);
      } catch(e) {
        if (e.name == 'NS_ERROR_NOT_AVAILABLE') {
          setTimeout($.proxy(this.captureImage, this, video, stream, success, error), 1000);
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
    update: function(url) {
      gapi.hangout.av.setAvatar(app.participant.id, url);

      // Clear out old avatar keys
      var oldAvatarKeys = app.data.keys();
      for (var i = 0; i < oldAvatarKeys.length; i++) {
        var key = oldAvatarKeys[i];
        if (key.indexOf(app.participant.id) == 0 && key.indexOf('/avatars') > 0) {
          app.data.clear(key);
        }
      }

      var avatarId = app.now();

      // Send a notification to other participants of the updated image
      for (var i = 0; i < url.length; i += this.partSize) {
        var partId = i / this.partSize;
        var data = url.substr(i, Math.min(url.length - i, this.partSize));
        app.data.set(app.participant.id + '/avatars/' + avatarId + '/parts/' + partId, data);
      }

      var partsCount = Math.ceil(url.length / this.partSize);
      app.data.set(app.participant.id + '/avatar', avatarId + ',' + partsCount);
    }
  },

  settings: {
    init: function() {
      $('#settings .setting-autostart input')
        .prop('checked', gapi.hangout.willAutoLoad())
        .click($.proxy(this.onChangeAutostart, this));
    },

    /**
     * Callback when the user has changed the setting for autostarting the extension
     */
    onChangeAutostart: function(event) {
      var $autostart = $(event.target);
      gapi.hangout.setWillAutoLoad($autostart.is(':checked'));
    }
  }
};

app.init();