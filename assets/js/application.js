var app = {
  /**
   * Initializes the state of the application
   */
  init: function() {
    gadgets.util.registerOnLoadHandler($.proxy(this.onLoad, this));
  },

  // The host for the app
  host: 'hangjoy-799317505.us-west-2.elb.amazonaws.com',

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
      this.layout.init();

      // Participant data
      this.participant.init();
      this.avatar.init();
      this.participants.init();

      this.settings.init();
    }
  },

  data: {
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
      var participantIds = $.map(gapi.hangout.getParticipants(), function(participant) { return participant.id; });
      var keys = this.keys();
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var participantId = app.participants.idFromKey(key);

        if (participantId != 'settings' && $.inArray(participantId, participantIds) == -1) {
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
     * Syncs up additions / removals of keys
     */
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
        var key = keys[i];
        this.onKeyAdded(key.key, key.value);
      }

      var keys = event.removedKeys;
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        this.onKeyRemoved(key);
      }
    },

    /**
     * Callback when a key has been added to the shared data
     */
    onKeyAdded: function(key, value) {
      var participant = app.participants.fromKey(key);

      if (participant && participant.id != app.participant.id) {
        if (key.match(/\/avatar/)) {
          // Avatar updated
          app.participants.updateAvatar(participant);
        } else if (key.match(/\/hanging_with/)) {
          if (app.participant.isHangingWith(participant)) {
            // Participant joined in hangout with this user
            app.participant.hangWith(participant, false);
          } else {
            // Participant joined in hangout with another user
            app.participants.inConversation(participant);
          }
        }
      }
    },

    /**
     * Callback when a key has been removed from the shared data
     */
    onKeyRemoved: function(key) {
      var participant = app.participants.fromKey(key);

      if (participant && participant.id != app.participant.id) {
        if (key.match(/\/hanging_with/)) {
          if (app.participant.isHangingWith(participant)) {
            // Participant left a hangout with this user
            app.participants.leave(participant);
          } else {
            // Participant is no longer in a hangout
            app.participants.outOfConversation(participant);
          }
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

      // Scrollers
      $('.menubar > li > a').click($.proxy(this.initScrollers, this));
      this.initScrollers();

      // Hangout actions
      $('.btn-leave').click($.proxy(app.participant.leave, app.participant));
    },

    /**
     * Initializes scroll panes on the page
     */
    initScrollers: function() {
      setTimeout(function() {
        $('.nano:visible').nanoScroller({alwaysVisible: true});
      }, 0);
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
     * Gets the list of display names currently shown in the UI
     */
    displayedParticipantNames: function() {
      var $items = $('.participants .list-group-item');
      var names = $items.map(function() {
        var participantId = $(this).data('id');
        var participant = gapi.hangout.getParticipantById(participantId);
        return participant.person.displayName;
      });

      return names;
    }
  },

  notification: {
    /**
     * Requests permission to show desktop notifications
     */
    requestPermission: function(onSuccess, onError) {
      if (window.webkitNotifications) {
        webkitNotifications.requestPermission(function() {
          if (webkitNotifications.checkPermission() == 0) {
            onSuccess();
          } else {
            onError();
          }
        });
      } else if (window.Notification) {
        Notification.requestPermission(function(permission){
          if (permission == 'granted') {
            onSuccess();
          } else {
            onError();
          }
        });
      }
    },

    /**
     * Determines whether the app currently has permission to generate desktop
     * notifications
     */
    hasDesktopPermission: function() {
      var hasPermission = false;
      if (window.webkitNotifications) {
        hasPermission = webkitNotifications.checkPermission();
      } else if (window.Notification) {
        hasPermission = Notification.permission == 'granted'
      }

      return hasPermission;
    },

    /**
     * Determines whether the app show be display messages as desktop notifications
     */
    useDesktopNotifications: function() {
      return this.hasDesktopPermission() && app.settings.get('useDesktopNotifications') == 'true';
    },

    /**
     * Shows a notification with the given message
     */
    show: function(message) {
      if (this.useDesktopNotifications()) {
        var title = 'Google Hangouts';
        var icon = 'http://' + app.host + '/assets/images/google-hangouts-icon.png';

        if (window.webkitNotifications) {
          var notification = webkitNotifications.createNotification(icon, title, message);
          notification.show();
        } else {
          var notification = new Notification(title, {icon: icon, body: message});
        }
      } else {
        gapi.hangout.layout.displayNotice(message);
      }
    }
  },

  // Represents the current, local participant
  participant: {
    init: function() {
      this.id = gapi.hangout.getLocalParticipant().id;
      this.googleId = gapi.hangout.getLocalParticipant().person.id;

      this.resetData();
      this.mute();
      gapi.hangout.av.setLocalAudioNotificationsMute(true);
      gapi.hangout.av.setLocalParticipantVideoMirrored(false);

      gapi.hangout.av.onCameraMute.add($.proxy(this.onCameraMute, this));
      gapi.hangout.av.onMicrophoneMute.add($.proxy(this.onMicrophoneMute, this));
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
      return $.inArray(participant.id, this.hangingWith()) >= 0 || $.inArray(this.id, app.participants.hangingWith(participant)) >= 0;
    },

    /**3
     * Gets the list of participants this user is currently hanging with
     */
    hangingWith: function() {
      return app.participants.hangingWith(gapi.hangout.getLocalParticipant());
    },

    /**
     * Adds the given participant to the conversation
     */
    hangWith: function(participant, initiatedLocally) {
      var participantIds = this.hangingWith();
      var newConversation = participantIds.length == 0;

      // Update the current participant's list of joined participants
      var newParticipantIds = app.participants.hangingWith(participant.id);
      newParticipantIds.push(participant.id);
      newParticipantIds = $.grep(newParticipantIds, function(id) {
        return id != app.participant.id && $.inArray(id, participantIds) == -1;
      });
      this.updateHangingWith(participantIds.concat(newParticipantIds));

      // Unmute local and remote participant
      this.mute(false);
      app.participants.mute(participant, false);

      // Remove the remote participant from the list
      app.participants.removeAvatar(participant);

      // Add a escape hatch
      app.layout.showLeaveAction();

      if (newConversation) {
        this.onNewConversation(participant, initiatedLocally);
      }

      // Hang with all of the new ids (in case we're joining a group already in session)
      for (var i = 0; i < newParticipantIds.length; i++) {
        var participantId = newParticipantIds[i];
        if (participantId != participant.id) {
          this.hangWth(participant, initiatedLocally);
        }
      }
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
    },

    /**
     * Callback when a new conversation has been started
     */
    onNewConversation: function(participant, initiatedLocally) {
      if (initiatedLocally) {
        if (this.hangingWith().length == 1) {
          // Set the video to the selected participant since they're the only one
          gapi.hangout.layout.getVideoCanvas().getVideoFeed().setDisplayedParticipant(participant.id);
        }
      } else {
        if (app.settings.get('muteSounds') == 'true') {
          // Play a sound to let the user know they're in a new conversation
          var chime = new Audio('//' + app.host + '/assets/audio/chime.ogg');
          chime.play();
        }

        // Display a notice in the hangout
        app.notification.show('A new conversation has started with ' + participant.person.displayName);
      }
    },

    /**
     * Leaves the current live feed in the hangout
     */
    leave: function() {
      // Clear the current user's list of participants
      this.updateHangingWith([]);

      app.layout.hideLeaveAction();

      // Mute everyone / reset participant list
      this.mute();
      app.participants.muteAll();
      app.participants.updateAllAvatars();

      // Reset the video feed
      gapi.hangout.layout.getVideoCanvas().getVideoFeed().clearDisplayedParticipant();
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
     * Finds the participant id with the given data key
     */
    idFromKey: function(key) {
      return key.match(/^([^\/]+)\//)[1];
    },

    /**
     * Finds the participant associated with the given key
     */
    fromKey: function(key) {
      var id = this.idFromKey(key);
      return this.fromId(id);
    },

    /**
     * Finds the participant associated with the given id
     */
    fromId: function(id) {
      return gapi.hangout.getParticipantById(id);
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
      if (app.participant.isHangingWith(participant)) {
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
     * Gets the url for the avatar representing the given user
     */
    avatarUrl: function(participant) {
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

      return url;
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
        var $participant = $('#' + this.safeId(participant));

        if ($participant.length) {
          this.replaceAvatar(participant);
        } else if (!app.participant.isHangingWith(participant)) {
          this.addAvatar(participant);
        }
      }
    },

    /**
     * Replaces the avatar currently shown for the participant with the one at
     * the given url
     */
    replaceAvatar: function(participant, url) {
      var $participant = $('#' + this.safeId(participant));
      var url = this.avatarUrl(participant);

      if ($participant.length) {
        // Fade in the new avatar
        var $previousAvatar = $participant.find('img').css({zIndex: 0});
        var $newAvatar = $('<img />')
          .attr({src: url})
          .css({zIndex: 1, opacity: 0.0})
          .addClass('img-thumbnail')
          .prependTo($participant.find('a'))
          .animate({opacity: 1.0}, {duration: 500, complete: $.proxy($previousAvatar.remove, $previousAvatar)});
      }
    },

    /**
     * Adds a new avatar for the participant tied to the given url
     */
    addAvatar: function(participant, url) {
      var $participants = $('.participants');
      var url = this.avatarUrl(participant);

      // Add a new avatar to the list
      var $link = $('<a />')
        .attr({href: '#'})
        .addClass('thumbnail')
        .append(
          $('<img />').attr({src: url}).addClass('img-thumbnail'),
          $('<div />').addClass('action').append(
            $('<span />').addClass('glyphicon glyphicon-facetime-video'),
            $('<span />').addClass('action-start').text('Start Conversation')
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
      if (this.isHanging(participant)) {
        $item.addClass('hanging');
      }

      // Sort the new list of names
      var $items = $('.participants .list-group-item');
      var names = app.layout.displayedParticipantNames();
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
      app.participant.hangWith(participant, true);
    },

    /**
     * Gets the ids of participants the given participant is hanging with
     */
    hangingWith: function(participant) {
      var ids = app.data.get(participant.id + '/hanging_with');
      return ids ? ids.split(',') : [];
    },

    /**
     * Determines whether the given participant is currently hanging with other users
     */
    isHanging: function(participant) {
      return this.hangingWith(participant).length > 0;
    },

    /**
     * Marks the given participant as currently in a conversation
     */
    inConversation: function(participant) {
      var $participant = $('#' + this.safeId(participant));
      $participant.addClass('hanging');
      $participant.find('.action-start').text('Join Conversation');
    },

    /**
     * Marks the given participant as no longer part of a conversation
     */
    outOfConversation: function(participant) {
      var $participant = $('#' + this.safeId(participant));
      $participant.removeClass('hanging');
      $participant.find('.action-start').text('Start Conversation');
    },

    /**
     * Removes the given participant from the conversation
     */
    leave: function(participant) {
      if (app.participant.isHangingWith(participant)) {
        // Update the current participant's list of joined participants
        var participantIds = app.participant.hangingWith();
        participantIds.splice($.inArray(participant.id, participantIds), 1);
        app.participant.updateHangingWith(participantIds);
      }

      // Mute the participant
      this.mute(participant, true);

      // Add the remote participant back to the pool
      this.updateAvatar(participant);

      if (!app.participant.isHanging()) {
        app.participant.leave();
      }
    }
  },

  // Represents the current user's avatar
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
      var id = app.now();
      gapi.hangout.av.setAvatar(app.participant.id, url);

      // Clean up old, outdated avatars
      this.cleanup();

      // Send a notification to other participants of the updated image.
      // Images need to be sent in parts because of key-value limits in
      // Hangout's data transmission protocol
      for (var i = 0; i < url.length; i += this.partSize) {
        var partId = i / this.partSize;
        var data = url.substr(i, Math.min(url.length - i, this.partSize));
        app.data.set(app.participant.id + '/avatars/' + id + '/parts/' + partId, data);
      }

      // Update the reference for the avatar
      var partsCount = Math.ceil(url.length / this.partSize);
      app.data.set(app.participant.id + '/avatar', id + ',' + partsCount);
    },

    /**
     * Clears out old avatar keys
     */
    cleanup: function() {
      var oldAvatarKeys = app.data.keys();
      for (var i = 0; i < oldAvatarKeys.length; i++) {
        var key = oldAvatarKeys[i];
        if (key.indexOf(app.participant.id) == 0 && key.indexOf('/avatars') > 0) {
          app.data.clear(key);
        }
      }
    }
  },

  // Represents settings for the extension
  settings: {
    init: function() {
      // Set defaults
      if (!this.get('muteSounds')) {
        this.set('muteSounds', 'true');
      }

      $('#settings .setting-autostart input')
        .prop('checked', gapi.hangout.willAutoLoad())
        .click($.proxy(this.onChangeAutostart, this));

      $('#settings .setting-sounds input')
        .prop('checked', this.get('muteSounds') == 'true')
        .click($.proxy(this.onChangeSounds, this));

      $('#settings .setting-notifications input')
        .prop('checked', this.get('useDesktopNotifications') == 'true')
        .click($.proxy(this.onChangeNotifications, this));
    },

    /**
     * Callback when the user has changed the setting for autostarting the extension
     */
    onChangeAutostart: function(event) {
      var $setting = $(event.target);
      gapi.hangout.setWillAutoLoad($setting.is(':checked'));
    },

    /**
     * Callback when the user has changed the setting for playing sounds
     */
    onChangeSounds: function(event) {
      var $setting = $(event.target);
      this.set('muteSounds', $setting.is(':checked') + '');
    },

    /**
     * Callback when the user has changed the setting for using desktop notifications
     */
    onChangeNotifications: function(event) {
      var $setting = $(event.target);

      if ($setting.is(':checked')) {
        app.notification.requestPermission(
          $.proxy(function() {
            // Received permission
            this.set('useDesktopNotifications', 'true');
          }, this),
          $.proxy(function() {
            // Did not receive permission
            $('#settings .setting-notifications input').prop('checked', false)
            this.set('useDesktopNotifications', 'false');
          }, this)
        );
      } else {
        this.set('useDesktopNotifications', 'false');
      }
    },

    /**
     * Sets the given setting for the current user that will persist across sessions
     */
    set: function(key, value) {
      app.data.set(this.idFor(key), value);
    },

    /**
     * Gets the setting for the given key
     */
    get: function(key) {
      return app.data.get(this.idFor(key));
    },

    /**
     * Generates the setting id for the given key
     */
    idFor: function(key) {
      return 'settings/' + app.participant.googleId + '/' + key;
    }
  }
};

app.init();