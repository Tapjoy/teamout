// Represents all participants in the hangout
app.participants = {
  init: function() {
    this.muteAll();
    this.updateAllAvatars();
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
    var googleIds = {};
    var all = [];

    var participants = gapi.hangout.getParticipants();
    for (var i = 0; i < participants.length; i++) {
      var participant = participants[i];
      var googleId = participant.person.id;

      if (googleId != app.participant.googleId && !googleIds[googleId]) {
        googleIds[googleId] = true;
        all.push(participant);
      }
    }

    return all;
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
    this.updateAvatar(participant);
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
    var firstName = participant.person.displayName.split(' ')[0];

    var canvas = $('<canvas />').attr({width: app.avatar.size, height: app.avatar.size})[0];
    var context = canvas.getContext('2d');

    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.font = '48px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';
    context.fillText(firstName, canvas.width / 2, canvas.height / 2);

    return canvas.toDataURL();
  },

  /**
   * Refreshes avatars for the current participants
   */
  updateAllAvatars: function() {
    var participants = this.all();
    for (var i = 0; i < participants.length; i++) {
      var participant = participants[i];
      this.updateAvatar(participant);
    }
  },

  /**
   * Updates the avatar for the given participant
   */
  updateAvatar: function(participant) {
    if (this.isPresent(participant)) {
      gapi.hangout.av.setAvatar(participant.id, this.avatarUrl(participant));
    }
  },

  /**
   * Removes the custom avatar for the given participant
   */
  removeAvatar: function(participant) {
    gapi.hangout.av.clearAvatar(participant.id);
  },

  /**
   * Gets the url for the photo representing the given user
   */
  photoUrl: function(participant) {
    var url;
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

    if (!url) {
      url = app.photo.defaultUrl();
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

      this.updateTimestamp(participant);
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
        $('<div />').addClass('caption').append(
          $('<span />').addClass('glyphicon glyphicon-certificate'),
          $('<span />').addClass('glyphicon glyphicon-ok-sign'),
          $('<span />').addClass('caption-name').text(participant.person.displayName),
          $('<span />').addClass('caption-timestamp')
        ),
        $('<div />').addClass('action').append(
          $('<ul />').addClass('hanging_with list-group'),
          $('<span />').addClass('glyphicon glyphicon-facetime-video'),
          $('<span />').addClass('action-start').text('Start Conversation')
        )
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

    this.updateAvailability(participant);
    this.updatePresence(participant);
    this.updateTimestamp(participant);

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
  },

  /**
   * Updates the availability indicator of a participant
   */
  updateAvailability: function(participant) {
    var available = app.data.get(participant.id + '/available') != 'false';

    var $participant = $('#' + this.safeId(participant));
    if (available) {
      $participant.find('.action .glyphicon-exclamation-sign').addClass('glyphicon-facetime-video').removeClass('glyphicon-exclamation-sign');
      $participant.find('.caption .glyphicon-exclamation-sign').addClass('glyphicon-ok-sign').removeClass('glyphicon-exclamation-sign');
      $participant.addClass('available').removeClass('busy');
    } else {
      $participant.find('.action .glyphicon-facetime-video').removeClass('glyphicon-facetime-video').addClass('glyphicon-exclamation-sign');
      $participant.find('.caption .glyphicon-ok-sign').removeClass('glyphicon-ok-sign').addClass('glyphicon-exclamation-sign');
      $participant.removeClass('available').addClass('busy');
    }
  },

  /**
   * Updates the presence indicator of a participant
   */
  updatePresence: function(participant) {
    var present = app.data.get(participant.id + '/present') != 'false';

    var $participant = $('#' + this.safeId(participant));
    if (present) {
      $participant.addClass('present').removeClass('missing');
    } else {
      $participant.removeClass('present').addClass('missing');
    }
  },

  /**
   * Updates the indicator for the timestamp when the participant's photo was
   * last updated
   */
  updateTimestamp: function(participant) {
    var $participant = $('#' + this.safeId(participant));
    var $timestamp = $participant.find('.caption-timestamp');

    var timestamp = (app.data.get(participant.id + '/photo') || '').split(',')[0];
    if (timestamp) {
      timestamp = new Date(parseInt(timestamp));
      $timestamp.text(strftime('%l:%M %p', timestamp).trim())
    } else {
      $timestamp.text('');
    }
  }
};