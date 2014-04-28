var app = {
  /**
   * Initializes the state of the application
   */
  init: function() {
    gadgets.util.registerOnLoadHandler($.proxy(this.onLoad, this));
  },

  // The host for the app
  host: 's3.amazonaws.com/hangjoy',

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
      this.support.init();
      this.data.init();
      this.layout.init();

      // Participant data
      this.participant.init();
      this.participants.init();
      this.settings.init();
      this.photo.init();
      this.conversation.init();
    }
  },

  support: {
    init: function() {
      navigator.getMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
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
  },

  layout: {
    init: function() {
      gapi.hangout.layout.setChatPaneVisible(false);
      this.updateScrollbar();
    },

    /**
     * Updates scroll panes on the page
     */
    updateScrollbar: function() {
      setTimeout(function() {
        $('.nano:visible').nanoScroller({alwaysVisible: true});
      }, 0);
    }
  },

  notification: {
    /**
     * The amount of time to allow to pass before the notification is
     * automatically hidden
     */
    timeout: 5000,

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
        hasPermission = webkitNotifications.checkPermission() == 0;
      } else if (window.Notification) {
        hasPermission = Notification.permission == 'granted';
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
        var notification;

        if (window.webkitNotifications) {
          notification = webkitNotifications.createNotification(icon, title, message);
          notification.show();
          setTimeout($.proxy(notification.cancel, notification), this.timeout);
        } else {
          notification = new Notification(title, {icon: icon, body: message});
          setTimeout($.proxy(notification.close, notification), this.timeout);
        }
      } else {
        gapi.hangout.layout.displayNotice(message);
      }
    }
  },

  // Represents the current, local participant
  participant: {
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
  },

  // Represents all participants in the hangout
  participants: {
    init: function() {
      this.muteAll();
      this.updateAllPhotos();

      gapi.hangout.onParticipantsAdded.add($.proxy(this.onAdded, this));
      gapi.hangout.onParticipantsRemoved.add($.proxy(this.onRemoved, this));

      if (!this.available().length) {
        $('.participants-empty').show();
      }
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
     * Gets a list of all participant ids in the hangout (excluding the current user)
     */
    ids: function() {
      return $.map(this.all(), function(participant) { return participant.id; });
    },

    /**
     * Gets a list of all participants in the hangout (excluding the current user)
     */
    all: function() {
      return $.grep(gapi.hangout.getParticipants(), function(participant) { return participant.id != app.participant.id; });
    },

    /**
     * Gets a list of participants available to join a conversation with
     */
    available: function() {
      return $.grep(this.all(), function(participant) {
        return !app.participant.isHangingWith(participant);
      });
    },

    /**
     * Determines whether the given participant is present in the hangout
     */
    isPresent: function(participant) {
      return $.inArray(participant.id, this.ids()) != -1;
    },

    /**
     * Cleans up any data left behind for the given participant
     */
    cleanup: function(participant) {
      var keys = app.data.keys();
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.indexOf(participant.id) >= 0) {
          app.data.clear(key);
        }
      }
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
      this.updatePhoto(participant);

      // Make sure we're autorefreshing
      app.photo.refresh();
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
      // Remove them from the conversation
      if (app.participant.isHangingWith(participant)) {
        app.conversation.remove(participant);
      }

      this.cleanup(participant);
      this.removePhoto(participant);
    },

    /**
     * Gets the list of display names currently shown in the UI
     */
    displayedParticipantNames: function() {
      var $items = $('.participants > .list-group-item');
      var names = $items.map(function() {
        var participantId = $(this).data('id');
        var participant = app.participants.fromId(participantId);
        return participant.person.displayName;
      });

      return names;
    },

    /**
     * Mutes all remote participants
     */
    muteAll: function() {
      var participants = this.all();
      for (var i = 0; i < participants.length; i++) {
        var participant = participants[i];
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
     * Gets the Google avatar url for the given user
     */
    avatarUrl: function(participant) {
      return participant.person.image.url;
    },

    /**
     * Gets the url for the photo representing the given user
     */
    photoUrl: function(participant) {
      var url = this.avatarUrl(participant);

      var data = app.data.get(participant.id + '/photo');
      if (data) {
        // Build the image data url
        var photoId = data.split(',')[0];
        var partsCount = parseInt(data.split(',')[1]);

        var dataUrl = '';
        for (var i = 0; i < partsCount; i++) {
          var part = app.data.get(participant.id + '/photos/' + photoId + '/parts/' + i);
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
     * Refreshes photos for the current participants
     */
    updateAllPhotos: function() {
      var participants = this.all();
      for (var i = 0; i < participants.length; i++) {
        var participant = participants[i];
        this.updatePhoto(participant);
      }
    },

    /**
     * Updates the photo for the given participant
     */
    updatePhoto: function(participant) {
      if (this.isPresent(participant)) {
        var $participant = $('#' + this.safeId(participant));

        if ($participant.length) {
          this.replacePhoto(participant);
        } else if (!app.participant.isHangingWith(participant)) {
          this.addPhoto(participant);
        }
      }
    },

    /**
     * Replaces the photo currently shown for the participant with the one at
     * the given url
     */
    replacePhoto: function(participant, url) {
      var $participant = $('#' + this.safeId(participant));
      var url = this.photoUrl(participant);

      if ($participant.length) {
        // Fade in the new photo
        var $previousPhoto = $participant.find('img').css({zIndex: 0});
        var $newPhoto = $('<img />')
          .attr({src: url})
          .css({zIndex: 1, opacity: 0.0})
          .addClass('img-thumbnail')
          .prependTo($participant.find('a'))
          .animate({opacity: 1.0}, {duration: 500, complete: $.proxy($previousPhoto.remove, $previousPhoto)});
      }
    },

    /**
     * Adds a new photo for the participant tied to the given url
     */
    addPhoto: function(participant, url) {
      var $participants = $('.participants');
      var url = this.photoUrl(participant);

      // Add a new photo to the list
      var $link = $('<a />')
        .attr({href: '#'})
        .addClass('thumbnail')
        .append(
          $('<img />').attr({src: url}).addClass('img-thumbnail'),
          $('<div />').addClass('action').append(
            $('<ul />').addClass('hanging_with list-group'),
            $('<span />').addClass('glyphicon glyphicon-facetime-video'),
            $('<span />').addClass('action-start').text('Start Conversation')
          ),
          $('<span />').addClass('caption').text(participant.person.displayName)
        )
        .click($.proxy(this.onClick, this));

      // Create the new list item
      var $item = $('<li />')
        .data({id: participant.id})
        .attr({id: this.safeId(participant)})
        .addClass('list-group-item')
        .append($link);

      // Sort the new list of names
      var $items = $('.participants > .list-group-item');
      var names = this.displayedParticipantNames();
      names.push(participant.person.displayName);
      names.sort();

      $('.participants-empty').hide();

      // Add in the right position
      var position = $.inArray(participant.person.displayName, names);
      if (position == 0) {
        $item.prependTo($participants);
      } else if (position == names.length - 1) {
        $item.appendTo($participants);
      } else {
        $item.insertBefore($items.eq(position));
      }

      // Mark as already in a conversation if this is the case
      if (this.isHanging(participant)) {
        this.addConversation(participant);
      }

      // Refresh scroll position
      app.layout.updateScrollbar();
    },

    /**
     * Removes the given user's photo from the participants list
     */
    removePhoto: function(participant) {
      $('#' + this.safeId(participant)).remove();

      if (!this.available().length) {
        $('.participants-empty').show();
      }

      // Refresh scroll position
      app.layout.updateScrollbar();
    },

    /**
     * Callback when the local participant has requested to join another participant
     */
    onClick: function(event) {
      var $participant = $(event.currentTarget).parent('.list-group-item');
      var participantId = $participant.data('id');
      var participant = this.fromId(participantId);

      app.conversation.join(participant);
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
    addConversation: function(participant) {
      var $participant = $('#' + this.safeId(participant));
      $participant.addClass('hanging');
      $participant.find('.action-start').text('Join Conversation');

      this.updateConversation(participant);
    },

    /**
     * Marks the given participant as no longer part of a conversation
     */
    removeConversation: function(participant) {
      var $participant = $('#' + this.safeId(participant));
      $participant.removeClass('hanging');
      $participant.find('.action-start').text('Start Conversation');

      this.updateConversation(participant);
    },

    /**
     * Updates the list of participants in a conversation
     */
    updateConversation: function(participant) {
      var $participant = $('#' + this.safeId(participant));
      var $hangingWith = $participant.find('.hanging_with');
      $hangingWith.empty();

      // Update the list of people in conversations
      var hangingWith = this.hangingWith(participant).slice(0, 7);
      for (var i = 0; i < hangingWith.length; i++) {
        var otherParticipant = this.fromId(hangingWith[i]);

        $('<li />')
          .addClass('list-group-item')
          .append(
            $('<div />')
              .addClass('thumbnail')
              .attr({title: otherParticipant.person.displayName})
              .append($('<img />').attr({src: this.avatarUrl(otherParticipant)}).addClass('img-thumbnail'))
          )
          .appendTo($hangingWith);
      }
    }
  },

  conversation: {
    init: function() {
      $('.btn-leave').click($.proxy(this.onClickLeave, this));
    },

    /**
     * Callback when a new conversation has been started
     */
    onStart: function(initiatedLocally) {
      // Get the first participant
      var participantId = app.participant.hangingWith()[0];
      var participant = app.participants.fromId(participantId);

      if (initiatedLocally) {
        if (app.participant.hangingWith().length == 1) {
          // Set the video to the selected participant since they're the only one
          gapi.hangout.layout.getVideoCanvas().getVideoFeed().setDisplayedParticipant(participant.id);
        }
      } else {
        if (app.settings.get('playSounds') == 'true') {
          // Play a sound to let the user know they're in a new conversation
          var chime = new Audio('//' + app.host + '/assets/audio/chime.ogg');
          chime.play();
        }

        // Display a notice in the hangout
        app.notification.show('A new conversation has started with ' + participant.person.displayName);
      }
    },

    /**
     * Requests to join with the given participant's conversation
     */
    join: function(participant) {
      var fromParticipantIds = app.participant.hangingWith();
      fromParticipantIds.push(app.participant.id);

      var toParticipantIds = app.participants.hangingWith(participant);
      toParticipantIds.push(participant.id);

      for (var i = 0; i < toParticipantIds.length; i++) {
        var toParticipantId = toParticipantIds[i];
        var toParticipant = app.participants.fromId(toParticipantId);

        // Add to conversation
        this.add(toParticipant, true);

        // Create join requests for others
        for (var j = 0; j < fromParticipantIds.length; j++) {
          var fromParticipantId = fromParticipantIds[j];

          if (fromParticipantId != toParticipantId) {
            app.data.set(fromParticipantId + '/requests/' + toParticipantId, '1');

            if (fromParticipantId != app.participant.id) {
              app.data.set(toParticipantId + '/requests/' + fromParticipantId, '1');
            }
          }
        }
      }
    },

    /**
     * Adds the given participant to the conversation
     */
    add: function(participant, initiatedLocally) {
      // Clear the request to hang
      if (!initiatedLocally) {
        app.data.clear(participant.id + '/requests/' + app.participant.id);
      }

      var participantIds = app.participant.hangingWith();
      var newConversation = participantIds.length == 0;

      // Update the current participant's list of joined participants
      participantIds.push(participant.id);
      app.participant.updateHangingWith($.unique(participantIds));

      // Unmute local and remote participant
      app.participant.mute(false);
      app.participants.mute(participant, false);

      // Remove the remote participant from the list
      app.participants.removePhoto(participant);

      // Add the remote participant to the active list
      this.showPhoto(participant);

      // Add a escape hatch
      this.showLeaveAction();

      if (newConversation) {
        this.onStart(initiatedLocally);
      }
    },

    /**
     * Removes the given participant from the conversation
     */
    remove: function(participant) {
      if (app.participant.isHangingWith(participant)) {
        // Update the current participant's list of joined participants
        var participantIds = app.participant.hangingWith();
        participantIds.splice($.inArray(participant.id, participantIds), 1);
        app.participant.updateHangingWith(participantIds);
      }

      if (app.participants.isPresent(participant)) {
        // Mute the participant
        app.participants.mute(participant, true);

        // Add the participant back to the available list
        app.participants.updatePhoto(participant);
      }

      // Remove photo from this conversation
      this.hidePhoto(participant);

      if (!app.participant.isHanging()) {
        this.leave();
      }
    },

    /**
     * Shows an action on the screen for leaving the conversation
     */
    showLeaveAction: function() {
      $('.btn-leave').addClass('btn-danger active').removeClass('disabled');
    },

    /**
     * Hides the action for leaving the conversation
     */
    hideLeaveAction: function() {
      $('.btn-leave').removeClass('btn-danger active').addClass('disabled');
    },

    /**
     * Callback when the user has clicked on the leave action
     */
    onClickLeave: function(event) {
      event.stopPropagation();
      this.leave();
    },

    /**
     * Leaves the current conversation
     */
    leave: function() {
      this.hideLeaveAction();
      this.clearPhotos();

      // Clear the current user's list of participants
      app.participant.updateHangingWith([]);

      // Mute everyone / reset participant list
      app.participant.mute();
      app.participants.muteAll();
      app.participants.updateAllPhotos();

      // Reset the video feed
      gapi.hangout.layout.getVideoCanvas().getVideoFeed().clearDisplayedParticipant();

      // Update this user's photo
      app.photo.refresh();
    },

    /**
     * Adds the given participant to the UI displaying the participants the user
     * is currently hanging with
     */
    showPhoto: function(participant) {
      // Make sure the conversation UI is visible
      var $conversation = $('.conversation');
      if (!$conversation.is(':visible')) {
        $conversation.clearQueue().slideDown(250);
      }

      // Add the avatar (if there's room)
      var $avatars = $conversation.find('.hanging_with > .list-group-item');
      var avatarId = app.participants.safeId(participant) + '-hanging-avatar';
      if ($avatars.length < 7 && !$('#' + avatarId).length) {
        // Add the participant to the short list
        $('<li />')
          .data({id: participant.id})
          .attr({id: avatarId})
          .addClass('list-group-item')
          .append(
            $('<div />')
              .addClass('thumbnail')
              .attr({title: participant.person.displayName})
              .append($('<img />').attr({src: app.participants.avatarUrl(participant)}).addClass('img-thumbnail'))
          )
          .appendTo($conversation.find('.hanging_with'));
      }

      // Add the participant to the full list
      var nameId = app.participants.safeId(participant) + '-hanging-name';
      if (!$('#' + nameId).length) {
        var $menu = $conversation.find('.dropdown-menu');
        var $items = $menu.find('li');
        var $item = $('<li />')
          .data({id: participant.id})
          .attr({id: nameId})
          .text(participant.person.displayName);

        var names = $conversation.find('.dropdown-menu li').map(function() { return $(this).text(); });
        names.push(participant.person.displayName);
        names.sort();

        // Add in the right position
        var position = $.inArray(participant.person.displayName, names);
        if (position == 0) {
          $item.prependTo($menu);
        } else if (position == names.length - 1) {
          $item.appendTo($menu);
        } else {
          $item.insertBefore($items.eq(position));
        }
      }
    },

    /**
     * Removes the given participant from the list the user is currently hanging
     * with
     */
    hidePhoto: function(participant) {
      var $avatar = $('#' + app.participants.safeId(participant) + '-hanging-avatar');
      var $name = $('#' + app.participants.safeId(participant) + '-hanging-name');
      $name.remove();

      if ($avatar.length) {
        // Remove from short and long list
        $avatar.remove();

        // Try adding other participants since there's now room
        var hangingWith = app.participant.hangingWith();
        for (var i = 0; i < hangingWith.length; i++) {
          var participantId = hangingWith[i];
          var participant = app.participants.fromId(participantId);
          this.showPhoto(participant);
        }
      }
    },

    /**
     * Clears the UI displaying who the user is currently hanging with
     */
    clearPhotos: function() {
      $('.conversation').clearQueue().slideUp(250);
      $('.conversation .hanging_with').empty();
      $('.conversation .conversation-names').empty();
    }
  },

  photo: {
    // Dimensions of photos
    width: 300,
    height: 225,
    quality: 0.7,

    // The maximum size photo parts can be stored in
    partSize: 8192,

    // Provides a helper for building URLs from streams
    buildURL: window.webkitURL || window.URL,

    init: function() {
      // Kick off the initial refresh
      this.refresh();
    },

    /**
     * Clears out old photo keys
     */
    cleanup: function() {
      var keys = app.data.keys();
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var participantId = app.participants.idFromKey(key);

        if (participantId == app.participant.id && key.indexOf('/photos') > 0) {
          app.data.clear(key);
        }
      }
    },

    /**
     * Whether photos are supported in this browser
     */
    isSupported: function() {
      return navigator.getMedia != undefined;
    },

    /**
     * Waits until the photo is able to be refresh -- at which point the
     * given callback is called.
     */
    waitUntilCanRefresh: function(callback) {
      clearInterval(this.waiter);

      this.waiter = setInterval($.proxy(function() {
        if (this.canRefresh()) {
          clearInterval(this.waiter);
          callback();
        }
      }, this), 1000);
    },

    /**
     * Gets the interval, in ms, to refresh photos
     */
    refreshInterval: function() {
      return parseFloat(app.settings.get('photoInterval')) * 60 * 1000;
    },

    /**
     * Refreshes the image representing the local participant
     */
    refresh: function() {
      if (app.settings.get('photoEnabled') == 'true') {
        if (this.canRefresh()) {
          var timeRemaining = this.lastRefresh ? this.lastRefresh + this.refreshInterval() - $.now() : 0;

          if (timeRemaining <= 0) {
            this.lastRefresh = $.now();
            timeRemaining = this.refreshInterval();

            // Constrain the video source based on existing settings
            var constraints;
            var photoSource = app.settings.get('photoSource');
            if (photoSource) {
              constraints = {optional: [{sourceId: photoSource}]}
            } else {
              constraints = true;
            }

            navigator.getMedia(
              {video: constraints},
              $.proxy(this.refreshWithStream, this),
              $.proxy(this.onError, this, null)
            );
          }

          // Restart timer
          clearTimeout(this.refresher);
          this.refresher = setTimeout($.proxy(this.refresh, this), timeRemaining);
        } else {
          this.waitUntilCanRefresh($.proxy(this.refresh, this));
        }
      }
    },

    /**
     * Determines whether the photo is capable of being refreshed
     */
    canRefresh: function() {
      return gapi.hangout.av.getCameraMute() == true &&
        gapi.hangout.av.getMicrophoneMute() == true &&
        !app.participant.isHanging() &&
        app.participants.all().length;
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
     * Callback when an error is encountered updating the photo
     */
    onError: function(stream, error) {
      if (stream) {
        try {
          stream.stop();
        } catch(ex) {
          console.log('Error stopping stream: ', ex);
        }
      }

      gapi.hangout.layout.displayNotice('Unable to take a picture. Please check your webcam settings.');
      console.log('Error updating photo: ', error);
    },

    /**
     * Gets the available video sources and invokes the callback with those that
     * are found.
     */
    sources: function(callback) {
      if (MediaStreamTrack.getSources) {
        MediaStreamTrack.getSources(function(sources) {
          var videoSources = [];
          for (var i = 0; i < sources.length; i++) {
            var source = sources[i];

            if (source.kind == 'video') {
              videoSources.push(source);
            }
          }

          callback(videoSources);
        });
      } else {
        callback([]);
      }
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

        // Save the image
        this.filter(canvas);
        var url = canvas.toDataURL('image/jpeg', this.quality);
        var squareUrl = this.squareImageUrl(canvas);

        // Stop the stream
        video.pause();
        stream.stop();

        success(url, squareUrl);
      } catch(e) {
        if (e.name == 'NS_ERROR_NOT_AVAILABLE') {
          setTimeout($.proxy(this.captureImage, this, video, stream, success, error), 1000);
        } else {
          error(e);
        }
      }
    },

    /**
     * Runs image processing filters on the given canvas
     */
    filter: function(canvas) {
      this.filters.desaturate(canvas);

      switch(app.settings.get('photoPrivacy')) {
        case 'blur':
          this.filters.blur(canvas, 3);
          break;
        case 'pixelate':
          this.filters.pixelate(canvas, 6);
          break;
        case 'silhouette':
          this.filters.silhouette(canvas);
          break;
      }
    },

    filters: {
      /**
       * Desaturates the given canvas, converting all colors to grayscale
       */
      desaturate: function(canvas) {
        var context = canvas.getContext('2d');
        var data = context.getImageData(0, 0, canvas.width, canvas.height);
        var pixels = data.data;
        var pixelCount = pixels.length;

        for (var i = 0; i < pixelCount; i += 4) {
          var grayscale = pixels[i] * 0.3 + pixels[i + 1] * 0.59 + pixels[i + 2] * 0.11;
          pixels[i] = grayscale;
          pixels[i + 1] = grayscale;
          pixels[i + 2] = grayscale;
        }

        context.putImageData(data, 0, 0);
      },

      /**
       * Performs a stack blur on the given canvas.  The radius determines the
       * extent to which the image is blurred.
       */
      blur: function(canvas, radius) {
        stackBlurCanvasRGB(canvas, 0, 0, canvas.width, canvas.height, radius);
      },

      /**
       * Pixelates the given canvas using hexagons.  The radius determines the
       * radius of the hexagons.
       */
      pixelate: function(canvas, radius) {
        this.blur(canvas, 3);

        var context = canvas.getContext('2d');
        var data = context.getImageData(0, 0, canvas.width, canvas.height);
        var pixels = data.data;

        // Polygon configuration
        var numberOfSides = 6;
        var angle = 2 * Math.PI / numberOfSides;
        var width = radius * 2;
        var height = Math.round(radius * Math.sin(angle) * 2) - 1;

        for (var x = 0; x < canvas.width; x += Math.round(width * 1.5)) {
          for (var y = 0; y < canvas.height; y += height) {
            var points = [[x, y], [x + Math.round(radius * 1.5), y + Math.round(height / 2)]];

            for (var i = 0; i < points.length; i++) {
              var point = points[i];
              var offsetX = point[0];
              var offsetY = point[1];

              // Draw an outline of the shape
              context.beginPath();
              context.moveTo(offsetX + radius, offsetY);
              for (var side = 1; side <= numberOfSides; side += 1) {
                context.lineTo(
                  offsetX + Math.round(radius * Math.cos(side * angle)),
                  offsetY + Math.round(radius * Math.sin(side * angle))
                );
              }

              // Grab color at center of the shape
              var colorX = offsetX > canvas.width ? canvas.width - 1 : offsetX;
              var colorY = offsetY > canvas.height ? canvas.height - 1 : offsetY;
              var index = (colorY * canvas.width + colorX) * 4;
              var red = pixels[index];
              var green = pixels[index + 1];
              var blue = pixels[index + 2];
              var alpha = pixels[index + 3];

              // Fill in the shape
              context.fillStyle = 'rgba(' + red + ',' + green + ',' + blue + ',' + alpha + ')';
              context.closePath();
              context.fill();
            }
          }
        }
      },

      /**
       * Detects the presence of faces in the photo and draws a silhouette
       */
      silhouette: function(canvas) {
        var faces = ccv.detect_objects({canvas: ccv.pre(canvas), cascade: cascade, interval: 5, min_neighbors: 1});

        var context = canvas.getContext('2d');
        context.rect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#cccccc';
        context.fill();

        context.font = '200px Glyphicons Halflings';
        context.textBaseline = 'bottom';
        context.fillStyle = faces.length ? '#53a93f' : '#000000';
        context.fillText("\uE008", 49, 275);
      }
    },

    /**
     * Resizes the given canvas to a square image and generates a url for that
     * image
     */
    squareImageUrl: function(sourceCanvas) {
      var size = Math.min(sourceCanvas.width, sourceCanvas.height);
      var canvas = $('<canvas />').attr({width: size, height: size})[0];
      var context = canvas.getContext('2d');
      var x = parseInt((sourceCanvas.width - size) / 2);
      var y = parseInt((sourceCanvas.height - size) / 2);
      context.drawImage(sourceCanvas, x, y, size, size, 0, 0, size, size);

      var url = canvas.toDataURL('image/jpeg', this.quality);

      return url;
    },

    /**
     * Updates the current participant's photo with the given url
     */
    update: function(url, squareUrl) {
      var id = $.now();
      gapi.hangout.av.setAvatar(app.participant.id, squareUrl);

      // Clean up old, outdated photos
      this.cleanup();

      // Send a notification to other participants of the updated image.
      // Images need to be sent in parts because of key-value limits in
      // Hangout's data transmission protocol
      for (var i = 0; i < url.length; i += this.partSize) {
        var partId = i / this.partSize;
        var data = url.substr(i, Math.min(url.length - i, this.partSize));
        app.data.set(app.participant.id + '/photos/' + id + '/parts/' + partId, data);
      }

      // Update the reference for the photo
      var partsCount = Math.ceil(url.length / this.partSize);
      app.data.set(app.participant.id + '/photo', id + ',' + partsCount);
    }
  },

  // Represents settings for the extension
  settings: {
    // Represents the local version of the settings
    state: {
      available: 'true',
      playSounds: 'true',
      useDesktopNotifications: 'false',
      photoEnabled: 'true',
      photoInterval: '1',
      photoPrivacy: 'none',
      photoSource: '',
    },

    init: function(callback) {
      var storedState = JSON.parse(localStorage[app.participant.googleId] || '{}');
      $.extend(this.state, storedState);

      // Control dropdowns
      $('.menubar .btn-dropdown-container').click(function(event) {
        $(this).toggleClass('open');
        event.preventDefault();
        event.stopPropagation();
      })
      $('.menubar .dropdown-menu').click(function(event) {
        event.stopPropagation();
      });
      $(document).click(function() {
        $('.menubar .open > .dropdown-toggle').each(function() {
          $(this).parent().removeClass('open');
        });
      });

      // Setting: photos
      if (!app.photo.isSupported()) {
        this.set('photoEnabled', 'false');
        $('.menubar .btn-photo').addClass('disabled');
        $('.menubar .btn-photo-dropdown').addClass('disabled');

        gapi.hangout.layout.displayNotice('Photos are not supported in your browser. Please consider upgrading to a newer version.');
      }
      if (this.get('photoEnabled') == 'false') {
        $('.menubar .btn-photo').button('toggle');
      }
      $('.menubar .btn-photo input').change($.proxy(this.onChangePhotoEnabled, this));

      // Setting: photo privacy
      $('.menubar .setting-photo_privacy select').change($.proxy(this.onChangePhotoPrivacy, this));
      var photoPrivacy = this.get('photoPrivacy');
      $('.menubar .setting-photo_privacy select option[value="' + photoPrivacy + '"]').attr({selected: true});

      // Setting: photo interval
      $('.menubar .setting-photo_interval select').change($.proxy(this.onChangePhotoInterval, this));
      var photoInterval = this.get('photoInterval');
      $('.menubar .setting-photo_interval select option[value="' + photoInterval + '"]').attr({selected: true});

      // Setting: photo source
      app.photo.sources($.proxy(function(sources) {
        var $setting = $('.menubar .setting-photo_source select');
        $setting.change($.proxy(this.onChangePhotoSource, this));

        // Add known sources
        var photoSource = this.get('photoSource');
        for (var i = 0; i < sources.length; i++) {
          var source = sources[i];
          $('<option>')
            .attr({value: source.id, selected: photoSource == source.id})
            .text(source.label || 'Default')
            .appendTo($setting);
        }

        // Set the default if there isn't already one
        var $option = $setting.find('option:selected');
        if ($option.length) {
          this.set('photoSource', $option.val());
        } else {
          $setting.hide();
          this.set('photoSource', '');
        }
      }, this));

      // Setting: availability
      if (this.get('available') == 'false') {
        $('.menubar .btn-available').button('toggle');
      }
      $('.menubar .btn-available input').change($.proxy(this.onChangeBusy, this));

      // Setting: sound
      if (this.get('playSounds') == 'false') {
        $('.menubar .btn-sounds').button('toggle');
      }
      $('.menubar .btn-sounds input').change($.proxy(this.onChangeSounds, this));

      // Setting: desktop notifications
      if (this.get('useDesktopNotifications') == 'false') {
        $('.menubar .btn-notifications').button('toggle');
      }
      $('.menubar .btn-notifications input').change($.proxy(this.onChangeNotifications, this));

      // Setting: autoload
      if (!gapi.hangout.willAutoLoad()) {
        $('.menubar .btn-autostart').button('toggle');
      }
      $('.menubar .btn-autostart input').change($.proxy(this.onChangeAutostart, this));

      // Tooltips
      $('.menubar > .btn')
        .tooltip({placement: 'bottom', animation: false, title: this.title})
        .change($.proxy(this.onChangeButton, this));
    },

    /**
     * Callback when one of the main buttons has changed state
     */
    onChangeButton: function(event) {
      var $setting = $(event.target);
      $setting.parent('.btn').tooltip('show');
    },

    /**
     * Gets the title for the given button
     */
    title: function() {
      var $btn = $(this);
      var title = $btn.find('> input').prop('checked') ? $btn.data('title-on') : $btn.data('title-off');
      return title || $btn.attr('title');
    },

    /**
     * Callback when the user has changed the setting for "busy" mode
     */
    onChangeBusy: function(event) {
      var $setting = $(event.target);
      var enabled = !$setting.is(':checked');
      this.set('available', enabled + '');

      // Communicate to everyone in the hangout so that they get the right messaging
      app.data.set(app.participant.id + '/available', enabled + '')
    },

    /**
     * Callback when the user has changed the setting for playing sounds
     */
    onChangeSounds: function(event) {
      var $setting = $(event.target);
      this.set('playSounds', !$setting.is(':checked') + '');
    },

    /**
     * Callback when the user has changed the setting for using desktop notifications
     */
    onChangeNotifications: function(event) {
      var $setting = $(event.target);
      var enabled = !$setting.is(':checked');

      if (enabled) {
        app.notification.requestPermission(
          $.proxy(function() {
            // Received permission
            this.set('useDesktopNotifications', 'true');
          }, this),
          $.proxy(function() {
            // Did not receive permission; toggle off
            $('.menubar .btn-notifications').button('toggle');
          }, this)
        );
      } else {
        this.set('useDesktopNotifications', 'false');
      }
    },

    /**
     * Callback when the user has changed the setting for autostarting the extension
     */
    onChangeAutostart: function(event) {
      var $setting = $(event.target);
      var enabled = !$setting.is(':checked');
      gapi.hangout.setWillAutoLoad(enabled);
    },

    /**
     * Callback when the user has changed the setting for taking presence photos
     */
    onChangePhotoEnabled: function(event) {
      var $setting = $(event.target);
      var enabled = !$setting.is(':checked');
      this.set('photoEnabled', enabled + '');

      app.photo.refresh();
    },

    /**
     * Callback when the user has changed the setting for photo privacy mode
     */
    onChangePhotoPrivacy: function(event) {
      var $setting = $(event.target);
      var privacy = $setting.val();
      this.set('photoPrivacy', privacy);
    },

    /**
     * Callback when the user has changed the setting for presence photo intervals
     */
    onChangePhotoInterval: function(event) {
      var $setting = $(event.target);
      var interval = $setting.val();
      this.set('photoInterval', interval);

      app.photo.refresh();
    },

    /**
     * Callback when the user has changed the setting for the video source to
     * use for photos
     */
    onChangePhotoSource: function(event) {
      var $setting = $(event.target);
      var sourceId = $setting.val();
      this.set('photoSource', sourceId);
    },

    /**
     * Sets the given setting for the current user that will persist across sessions
     */
    set: function(key, value) {
      this.state[key] = value;
      localStorage.setItem(app.participant.googleId, JSON.stringify(this.state));
    },

    /**
     * Gets the setting for the given key
     */
    get: function(key) {
      return this.state[key];
    }
  }
};

app.init();