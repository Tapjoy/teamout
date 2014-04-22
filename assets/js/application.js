var app = {
  /**
   * Initializes the state of the application
   */
  init: function() {
    gadgets.util.registerOnLoadHandler($.proxy(this.onLoad, this));
  },

  // The host for the app
  host: 'hangjoy.herokuapp.com',

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
      this.photo.init();
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
     * Syncs up additions / removals of keys.  Only keys added / removed that
     * are associated with other users will actually get synced here.  The
     * assumption is that keys associated with the current user get set
     * directly through calling #set / #remove instead of through a sync.
     */
    sync: function(addedKeys, removedKeys) {
      for (var i = 0; i < addedKeys.length; i++) {
        var key = addedKeys[i];
        if (key.key.indexOf(app.participant.id) != 0) {
          this.state[key.key] = key.value;
          this.onKeyAdded(key.key, key.value);
        }
      }

      for (var i = 0; i < removedKeys.length; i++) {
        var key = removedKeys[i];
        if (key.indexOf(app.participant.id) != 0) {
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

      if (key.match(/\/photo$/) || key.match(/\/photos\//)) {
        // Photo updated
        app.participants.updatePhoto(participant);
      } else if (key.match(/\/requests/)) {
        if (key.indexOf(app.participant.id) > 0) {
          // Participant joined in hangout with this user
          app.participant.hangWith(participant, false);
        }
      } else if (key.match(/\/hanging_with/)) {
        // Participant joined in hangout with another user
        app.participants.inConversation(participant);
      }
    },

    /**
     * Callback when a key has been removed from the shared data
     */
    onKeyRemoved: function(key) {
      var participant = app.participants.fromKey(key);

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

      if (gapi.hangout.getParticipants().length == 1) {
        $('.participants-empty').show();
      }
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
      $('.btn-leave').addClass('btn-danger').removeClass('disabled');
    },

    /**
     * Hides the action for leaving the hangout
     */
    hideLeaveAction: function() {
      $('.btn-leave').removeClass('btn-danger').addClass('disabled');
    },

    /**
     * Gets the list of display names currently shown in the UI
     */
    displayedParticipantNames: function() {
      var $items = $('.participants > .list-group-item');
      var names = $items.map(function() {
        var participantId = $(this).data('id');
        var participant = gapi.hangout.getParticipantById(participantId);
        return participant.person.displayName;
      });

      return names;
    },

    /**
     * Adds the given participant to the UI displaying the participants the user
     * is currently hanging with
     */
    addHangingWith: function(participant) {
      // Make sure the list is visible
      var $hangingWith = $('.hanging_with');
      if (!$hangingWith.is(':visible')) {
        $('.hanging_with').clearQueue().slideDown(250);
      }

      var $participants = $hangingWith.find('.participants-hanging > .list-group-item');
      var iconId = app.participants.safeId(participant) + '-hanging-icon';
      if ($participants.length < 7 && !$('#' + iconId).length) {
        // Add the participant to the short list
        $('<li />')
          .data({id: participant.id})
          .attr({id: iconId})
          .addClass('list-group-item')
          .append(
            $('<div />')
              .addClass('thumbnail')
              .attr({title: participant.person.displayName})
              .append($('<img />').attr({src: app.participants.avatarUrl(participant)}).addClass('img-thumbnail'))
          )
          .appendTo($hangingWith.find('.participants-hanging'));
      }

      // Add the participant to the full list
      var nameId = app.participants.safeId(participant) + '-hanging-name';
      if (!$('#' + nameId).length) {
        var $menu = $hangingWith.find('.dropdown-menu');
        var $items = $menu.find('li');
        var $item = $('<li />')
          .data({id: participant.id})
          .attr({id: nameId})
          .text(participant.person.displayName);

        var names = $hangingWith.find('.dropdown-menu li').map(function() { return $(this).text(); });
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
    removeHangingWith: function(participant) {
      var $icon = $('#' + app.participants.safeId(participant) + '-hanging-icon');
      var $name = $('#' + app.participants.safeId(participant) + '-hanging-name');
      $name.remove();

      if ($icon.length) {
        // Remove from short and long list
        $icon.remove();

        // Try adding other participants since there's now room
        var hangingWith = app.participant.hangingWith();
        for (var i = 0; i < hangingWith.length; i++) {
          var participantId = hangingWith[i];
          var participant = app.participants.fromId(participantId);
          this.addHangingWith(participant);
        }
      }
    },

    /**
     * Clears the UI displaying who the user is currently hanging with
     */
    clearHangingWith: function() {
      $('.hanging_with').clearQueue().slideUp(250);
      $('.hanging_with .participants-hanging').empty();
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
        hasPermission = webkitNotifications.checkPermission() == 0;
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

      this.cleanup();
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
     * Adds the given participant to the conversation
     */
    hangWith: function(participant, initiatedLocally) {
      // Clear the request to hang
      if (!initiatedLocally) {
        app.data.clear(participant.id + '/requests/' + app.participant.id);
      }

      var participantIds = this.hangingWith();
      var newConversation = participantIds.length == 0;

      // Update the current participant's list of joined participants
      participantIds.push(participant.id);
      this.updateHangingWith($.unique(participantIds));

      // Unmute local and remote participant
      this.mute(false);
      app.participants.mute(participant, false);

      // Remove the remote participant from the list
      app.participants.removePhoto(participant);

      // Add the remote participant to the active list
      app.layout.addHangingWith(participant);

      // Add a escape hatch
      app.layout.showLeaveAction();

      if (newConversation) {
        this.onNewConversation(participant, initiatedLocally);
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
      app.layout.clearHangingWith();

      // Clear the current user's list of participants
      this.updateHangingWith([]);

      app.layout.hideLeaveAction();

      // Mute everyone / reset participant list
      this.mute();
      app.participants.muteAll();
      app.participants.updateAllPhotos();

      // Reset the video feed
      gapi.hangout.layout.getVideoCanvas().getVideoFeed().clearDisplayedParticipant();

      // Update this user's photo
      app.photo.waitUntilCanRefresh($.proxy(app.photo.refresh, app.photo));
    }
  },

  // Represents all participants in the hangout
  participants: {
    init: function() {
      this.muteAll();
      this.updateAllPhotos();

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
      this.updatePhoto(participant);
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

      this.removePhoto(participant);

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
      var participants = gapi.hangout.getParticipants();
      for (var i = 0; i < participants.length; i++) {
        var participant = participants[i];
        this.updatePhoto(participant);
      }
    },

    /**
     * Updates the photo for the given participant
     */
    updatePhoto: function(participant) {
      if (participant.id != app.participant.id) {
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
        .click($.proxy(this.onJoinRequest, this));

      // Create the new list item
      var $item = $('<li />')
        .data({id: participant.id})
        .attr({id: this.safeId(participant)})
        .addClass('list-group-item')
        .append($link);

      // Sort the new list of names
      var $items = $('.participants > .list-group-item');
      var names = app.layout.displayedParticipantNames();
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
        this.inConversation(participant);
      }

      // Refresh scroll position
      app.layout.initScrollers();
    },

    /**
     * Removes the given user's photo from the participants list
     */
    removePhoto: function(participant) {
      $('#' + this.safeId(participant)).remove();

      if (!$('.participants > li').length) {
        $('.participants-empty').show();
      }

      // Refresh scroll position
      app.layout.initScrollers();
    },

    /**
     * Callback when the local participant has requested to join another participant
     */
    onJoinRequest: function(event) {
      var $participant = $(event.currentTarget).parent('.list-group-item');
      var participantId = $participant.data('id');
      var participant = gapi.hangout.getParticipantById(participantId);
 
      var fromParticipantIds = app.participant.hangingWith();
      fromParticipantIds.push(app.participant.id);

      var toParticipantIds = app.participants.hangingWith(participant);
      toParticipantIds.push(participant.id);

      for (var i = 0; i < toParticipantIds.length; i++) {
        var toParticipantId = toParticipantIds[i];
        var toParticipant = app.participants.fromId(toParticipantId);

        // Hang out with the participant
        app.participant.hangWith(toParticipant, true);

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

      this.updateConversation(participant);
    },

    /**
     * Marks the given participant as no longer part of a conversation
     */
    outOfConversation: function(participant) {
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
      this.updatePhoto(participant);

      // Remove them from the hangout list
      app.layout.removeHangingWith(participant);

      if (!app.participant.isHanging()) {
        app.participant.leave();
      }
    }
  },

  // Represents the current user's photo
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
      // The browser-specific implementation for retrieving a webcam stream
      navigator.getMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

      this.waitUntilCanRefresh($.proxy(this.autorefresh, this));
    },

    /**
     * Waits until the photo is able to be refresh -- at which point the
     * given callback is called.
     */
    waitUntilCanRefresh: function(callback) {
      var runner = setInterval($.proxy(function() {
        if (this.canRefresh()) {
          clearInterval(runner);
          callback();
        }
      }, this), 250);
    },

    /**
     * Starts a timer for automatically refreshing the photo
     */
    autorefresh: function() {
      this.refresh();
      this.updateAutorefresh(parseInt(app.settings.get('photosInterval')));
    },

    /**
     * Updates the autorefresh script to do so every interval minutes
     */
    updateAutorefresh: function(interval) {
      if (this.refresher) {
        clearInterval(this.refresher);
      }

      this.refresher = setInterval($.proxy(this.refresh, this), interval * 60 * 1000);
    },

    /**
     * Refreshes the image representing the local participant
     */
    refresh: function() {
      var enabled = app.settings.get('photosEnabled') == 'true';
      var photoRecentlyTaken = this.lastPhotoAttempted && (app.now() - this.lastPhotoAttempted < 60 * 1000);

      if (enabled && this.canRefresh() && !photoRecentlyTaken) {
        this.lastPhotoAttempted = app.now();

        navigator.getMedia(
          {video: {optional: [{sourceId: app.settings.get('videoSource')}]}},
          $.proxy(this.refreshWithStream, this),
          $.proxy(this.onError, this, null)
        );
      }
    },

    /**
     * Determines whether the photo is capable of being refrehs
     */
    canRefresh: function() {
      return gapi.hangout.av.getCameraMute() == true && gapi.hangout.av.getMicrophoneMute() == true && app.settings.get('videoSource');
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
    videoSources: function(callback) {
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

        // Save the image
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
     * Updates the current participant's photo with the given url
     */
    update: function(url, squareUrl) {
      var id = app.now();
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
    },

    /**
     * Clears out old photo keys
     */
    cleanup: function() {
      var oldPhotoKeys = app.data.keys();
      for (var i = 0; i < oldPhotoKeys.length; i++) {
        var key = oldPhotoKeys[i];
        if (key.indexOf(app.participant.id) == 0 && key.indexOf('/photos') > 0) {
          app.data.clear(key);
        }
      }
    }
  },

  // Represents settings for the extension
  settings: {
    init: function() {
      // Set defaults
      if (this.get('muteSounds') == undefined) {
        this.set('muteSounds', 'true');
      }
      if (this.get('photosEnabled') == undefined) {
        this.set('photosEnabled', 'true');
      }
      if (this.get('photosInterval') == undefined) {
        this.set('photosInterval', '1');
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

      $('#settings .setting-photos_enabled input')
        .prop('checked', this.get('photosEnabled') == 'true')
        .click($.proxy(this.onChangePhotosEnabled, this));

      $('#settings .setting-photos_interval select')
        .change($.proxy(this.onChangePhotosInterval, this));

      var interval = this.get('photosInterval');
      $('#settings .setting-photos_interval select option[value="' + interval + '"]').attr({selected: true});

      // Init video sources
      app.photo.videoSources($.proxy(function(sources) {
        var $setting = $('#settings .setting-video select');
        $setting.change($.proxy(this.onChangeVideoSource, this));

        // Add known sources
        var currentSource = this.get('videoSource');
        for (var i = 0; i < sources.length; i++) {
          var source = sources[i];
          $('<option>')
            .attr({value: source.id, selected: currentSource == source.id})
            .text(source.label || 'Default')
            .appendTo($setting);
        }

        // Set the default if there isn't already one
        var $option = $setting.find('option:selected');
        if ($option.length) {
          this.set('videoSource', $option.val());
        } else {
          this.set('videoSource', '');
        }
      }, this));
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
     * Callback when the user has changed the setting for taking presence photos
     */
    onChangePhotosEnabled: function(event) {
      var $setting = $(event.target);
      this.set('photosEnabled', $setting.is(':checked') + '');
    },

    /**
     * Callback when the user has changed the setting for presence photo intervals
     */
    onChangePhotosInterval: function(event) {
      var $setting = $(event.target);
      var interval = $setting.val();
      this.set('photosInterval', interval);

      app.photo.updateAutorefresh(parseInt(interval));
    },

    /**
     * Callback when the user has changed the setting for the video source to
     * use for photos
     */
    onChangeVideoSource: function(event) {
      var $setting = $(event.target);
      var sourceId = $setting.val();
      this.set('videoSource', sourceId);
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