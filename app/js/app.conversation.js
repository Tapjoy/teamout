app.conversation = {
  init: function() {
    this.chime = new Audio('//' + app.host + '/assets/audio/chime.ogg');
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
        gapi.hangout.layout.getDefaultVideoFeed().setDisplayedParticipant(participant.id);
      }
    } else {
      if (app.settings.get('playSounds') == 'true') {
        // Play a sound to let the user know they're in a new conversation
        this.chime.play();
      }

      // Display a notice in the hangout
      app.notification.show('A new conversation has started with ' + participant.person.displayName, {desktop: true});
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
    var busy = app.settings.get('available') == 'false';
    var muteVideo = app.settings.get('unmuteVideo') == 'false';
    app.participant.mute({audio: busy, video: busy || muteVideo});
    app.participants.mute(participant, false);

    // Remove the remote participant from the list
    app.participants.removeAvatar(participant);
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
      app.participants.updateAvatar(participant);
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
    app.participants.updateAllAvatars();
    app.participants.updateAllPhotos();

    // Reset the video feed
    gapi.hangout.layout.getDefaultVideoFeed().setDisplayedParticipant(app.participant.id);

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
};