var _ = require('underscore');
var Backbone = require('backbone');
var jsSHA = require('jssha');

// Provides a communication layer to the Google Hangouts API
var Platform = {
  initialize: function() {
    if (this.isReady()) {
      this._onReady();
    } else {
      gapi.hangout.onApiReady.add(_.bind(this._onReady, this));
    }
  },

  // Data
  isReady: function() {
    return gapi.hangout.isApiReady();
  },

  /**
   * The amount of time difference between client and server
   */
  timeOffset: 0,

  /**
   * Gets the current time on the server
   */
  getTime: function() {
    return _.now() + this.timeOffset;
  },

  /**
   * Gets the data seeding this app
   */
  getSeedData: function() {
    var data = {};

    var parts = gapi.hangout.getHangoutUrl().match(/[^\/]+$/)[0].split('-');
    data.id = parts[0];
    data.roomId = parts[1];

    return data;
  },

  /**
   * Gets the current logged in user
   */
  getCurrentUser: function() {
    return this._buildUser(gapi.hangout.getLocalParticipant());
  },

  /**
   * Translates a google participant to a user within the app
   */
  _buildUser: function(participant) {
    return {
      id: participant.person.id,
      sessionId: participant.id,
      name: participant.person.displayName
    }
  },

  // The current key/value shared data
  _state: {},

  // The state changes that originated from this app
  _stateChanges: {updates: {}, removes: {}},

  /**
   * Gets a key-value mapping of all the state in the hanogut
   */
  getState: function() {
    return this._stitchState(this._state);
  },

  /**
   * Stiches together data that was split up due to Google's limit on
   * the size of values in state
   */
  _stitchState: function(state) {
    var stitchedState = {};

    for (var subkey in state) {
      var match = subkey.match(/^(.+)\/_\/(.+)\//) || [];
      var key = match[1] || subkey;
      var latestVersion = this._state[key];
      var version = match[2] || latestVersion;

      if (!stitchedState[key] && version == latestVersion) {
        // Stitch together the parts for this version
        var value = '';
        var partId = 0;
        var partValue = '';
        while (true) {
          var partKey = key + '/_/' + version + '/' + partId;
          var partValue = this._state[partKey];
          if (partValue) {
            value += partValue;
            partId += 1;
          } else {
            break;
          }
        }

        try {
          result = JSON.parse(value);
          stitchedState[key] = result;
        } catch(ex) {
          // Not all of the data is available yet; we'll have to wait until
          // more state is provided
        }
      }
    }

    return stitchedState;
  },

  /**
   * Syncs up the given updated / removed keys with the rest of the users in
   * the hangout.  This will handle taking apart / stitching together values
   * that exceeded the maximum length allowed by Google.
   */
  syncState: function(options) {
    // Process updates
    var updates = {};
    for (var key in options.updates) {
      var value = JSON.stringify(options.updates[key]);
      var version = (new jsSHA(value, 'TEXT')).getHash('SHA-1', 'HEX');

      // Mark the key for update
      updates[key] = version;

      // Calculate the maximum size of a given part's value
      var delta = {updates: {}};
      delta.updates[key + '/_/' + version + '/100'] = '';
      var partSize = this._maxDeltaSize - this._deltaSize(delta);

      // Add parts
      for (var i = 0; i < value.length; i += partSize) {
        var partId = i / partSize;
        var partValue = value.substr(i, Math.min(value.length - i, partSize));
        updates[key + '/_/' + version + '/' + partId] = partValue;
      }
    }

    // Process removes
    var removes = options.removes || [];
    var modifiedKeys = removes.concat(_.keys(options.updates));
    for (var i = 0; i < modifiedKeys.length; i++) {
      var key = modifiedKeys[i];

      // Look for subkeys
      for (var existingKey in this._state) {
        if (existingKey.indexOf(key + '/_/') == 0 && !updates[existingKey]) {
          removes.push(existingKey);
        }
      }
    }

    // Build deltas - updates
    var delta = {updates: {}, removes: []};
    var deltas = [delta];
    for (var key in updates) {
      var value = updates[key];
      delta.updates[key] = value;

      if (this._deltaSize(delta) > this._maxDeltaSize) {
        delete delta.updates[key];
        delta = {updates: {}, removes: []}
        delta.updates[key] = value;
        deltas.push(delta);
      }
    }

    // Build deltas - removes
    for (var i = 0; i < removes.length; i++) {
      var key = removes[i];
      delta.removes.push(key);

      if (this._deltaSize(delta) > this._maxDeltaSize) {
        delta.removes.pop();
        delta = {removes: [key]};
        deltas.push(delta);
      }
    }

    // Save deltas
    for (var i = 0; i < deltas.length; i++) {
      var delta = deltas[i];

      // Persist locally
      for (var j = 0; j < delta.removes.length; j++) {
        var key = delta.removes[j];
        delete this._state[key];
        this._stateChanges.removes[key] = true;
      }
      for (var key in delta.updates) {
        var value = delta.updates[key];
        this._state[key] = value;
        this._stateChanges.updates[key] = value;
      }

      // Persist remotely
      gapi.hangout.data.submitDelta(delta.updates, delta.removes);
    }
  },


  // The maximum size data values can be stored in
  _maxDeltaSize: 10000,

  /**
   * Determines the size of the given delta (updates and removes)
   */
  _deltaSize: function(delta) {
    var size = 500;
    if (delta.updates) {
      for (var key in delta.updates) {
        var value = delta.updates[key];
        size += key.length + value.length + 100;
      }
    }

    if (delta.removes) {
      for (var i = 0; i < delta.removes.length; i++) {
        size += delta.removes[i].length + 100;
      }
    }

    return size;
  },

  /**
   * Gets a list of all of the current users in the room.  The current user
   * will *not* be included in this list.
   */
  getUsers: function() {
    var ids = {};
    var users = [];
    var currentUserId = gapi.hangout.getLocalParticipantId();

    var participants = gapi.hangout.getParticipants();
    for (var i = 0; i < participants.length; i++) {
      var participant = participants[i];
      var id = participant.id;

      if (id != currentUserId && !ids[id]) {
        ids[id] = true;
        users.push(this._buildUser(participant));
      }
    }

    return users;
  },

  /**
   * Generates a url for the given room.  Rooms are scoped by app id.
   */
  getRoomUrl: function(room, appId) {
    var startData = appId + ',' + room.id;
    var hangoutId = appId + '-' + room.id;

    return 'https://talkgadget.google.com/hangouts/_/widget/' + hangoutId + '?gid=' + this._gadgetId();
  },

  /**
   * Looks up the Google id for this gadget
   */
  _gadgetId: function() {
    return decodeURIComponent(document.location.search).match(/url=app:\/\/([^/]+)\/hangout/)[1];
  },

  // UI
  /**
   * Sets the user's avatar in the room to the given url
   */
  setAvatar: function(user, url) {
    try {
      gapi.hangout.av.setAvatar(user.get('sessionId'), url);
    } catch(e) {}
  },

  /**
   * Resets the avatar for the given user
   */
  resetAvatar: function(user) {
    try {
      gapi.hangout.av.clearAvatar(user.get('sessionId'));
    } catch(e) {}
  },

  /**
   * Focuses the video feed on the given user
   */
  setDisplayedUser: function(user) {
    gapi.hangout.layout.getDefaultVideoFeed().setDisplayedParticipant(user.get('sessionId'));
  },

  /**
   * Resets the video feed to auto-focus on users
   */
  resetDisplayedUser: function() {
    gapi.hangout.layout.getDefaultVideoFeed().clearDisplayedParticipant();
  },

  /**
   * Mutes / unmutes the video feed for the given user
   */
  muteVideo: function(user, muted) {
    if (user.get('sessionId') == gapi.hangout.getLocalParticipantId()) {
      gapi.hangout.av.setCameraMute(muted);
    } else {
      try {
        gapi.hangout.av.setParticipantVisible(user.get('sessionId'), !muted);
      } catch(e) {}
    }
  },

  /**
   * Whether the video feed is muted for the given user
   */
  isVideoMuted: function(user) {
    var result;
    if (user.get('sessionId') == gapi.hangout.getLocalParticipantId()) {
      result = gapi.hangout.av.getCameraMute();
    } else {
      try {
        result = gapi.hangout.av.isParticipantVisible(user.get('sessionId'));
      } catch(e) {
        result = true;
      }
    }

    return result;
  },

  /**
   * Whether the video feed is mirrored on the local user's screen
   */
  mirrorVideo: function(mirrored) {
    gapi.hangout.av.setLocalParticipantVideoMirrored(mirrored);
  },

  /**
   * Mutes / unmutes the microphone for the given user
   */
  muteMicrophone: function(user, muted) {
    if (user.get('sessionId') == gapi.hangout.getLocalParticipantId()) {
      gapi.hangout.av.setMicrophoneMute(muted);
    } else {
      try {
        gapi.hangout.av.setParticipantAudible(user.get('sessionId'), !muted);
      } catch(e) {}
    }
  },

  /**
   * Whether the microphone is muted for the given user
   */
  isMicrophoneMuted: function(user) {
    var result;
    if (user.get('sessionId') == gapi.hangout.getLocalParticipantId()) {
      result = gapi.hangout.av.getMicrophoneMute();
    } else {
      try {
        result = gapi.hangout.av.isParticipantAudible(user.get('sessionId'));
      } catch(e) {
        result = true;
      }
    }

    return result;
  },

  /**
   * Displays the given message in the room UI
   */
  displayNotice: function(message) {
    gapi.hangout.layout.displayNotice(message);
  },

  // Events

  /**
   * Callback when the Hangouts API is ready
   */
  _onReady: function(event) {
    // Set up data
    this._state = gapi.hangout.data.getState();

    // Set up audio / video / text feeds
    gapi.hangout.av.setLocalAudioNotificationsMute(true);
    gapi.hangout.av.setLocalParticipantVideoMirrored(false);
    gapi.hangout.layout.setChatPaneVisible(false);

    // Set up events
    gapi.hangout.layout.getDefaultVideoFeed().onDisplayedParticipantChanged.add(_.bind(this._onDisplayedUserChanged, this));
    gapi.hangout.av.onCameraMute.add(_.bind(this._onVideoMute, this));
    gapi.hangout.av.onMicrophoneMute.add(_.bind(this._onMicrophoneMute, this));
    gapi.hangout.onParticipantsAdded.add(_.bind(this._onUsersAdded, this));
    gapi.hangout.onParticipantsRemoved.add(_.bind(this._onUsersRemoved, this));
    gapi.hangout.data.onStateChanged.add(_.bind(this._onStateChanged, this));

    this.trigger('ready');
  },

  /**
   * Callback when the user displayed in the video feed has changed
   */
  _onDisplayedUserChanged: function(event) {
    var participant;
    if (event.displayedParticipant == gapi.hangout.getLocalParticipantId()) {
      participant = gapi.hangout.getLocalParticipant();
    } else {
      participant = gapi.hangout.getParticipantById(event.displayedParticipant);
    }

    var user = this._buildUser(participant);
    this.trigger('displayeduserchanged', {user: user});
  },

  /**
   * Callback when the user has changed the mute setting for their video
   */
  _onVideoMute: function(event) {
    this.trigger('videomute', {muted: event.isCameraMute});
  },

  /**
   * Callback when the user changed the mute setting for their microphone
   */
  _onMicrophoneMute: function(event) {
    this.trigger('microphonemute', {muted: event.isMicrophoneMute});
  },

  /**
   * Callback when the state of the hangout has changed
   */
  _onStateChanged: function(event) {
    this._state = gapi.hangout.data.getState();

    // Process updates
    var updates = _.reduce(event.addedKeys, function(data, entry) {
      var key = entry.key;
      var value = entry.value;

      if (this._stateChanges.updates[key]) {
        // Update was triggered locally: ignore
        delete this._stateChanges.updates[key];
      } else {
        data[key] = value;
      }

      return data;
    }, {}, this);
    updates = this._stitchState(updates);

    // Process removes
    var removes = _.filter(event.removedKeys, function(key) {
      if (this._stateChanges.removes[key]) {
        // Remove was triggered locally: ignore
        delete this._stateChanges.removes[key];
        return false;
      } else {
        return !key.match(/\/_\//);
      }
    }, this);

    // Update time offset; network latency is assumed to be 50ms on average
    // between when the key was updated and when it got delivered to the client
    if (event.addedKeys.length) {
      var mostRecentKey = _.max(event.addedKeys, function(entry) { return entry.timestamp });
      this.timeOffset = mostRecentKey.timestamp + 50 - _.now();
    }

    this.trigger('statechanged', {updates: updates, removes: removes});
  },

  /**
   * Callback when one or more new users have been added to the room
   */
  _onUsersAdded: function(event) {
    _.each(event.addedParticipants, function(participant) {
      var user = this._buildUser(participant);
      this.trigger('useradded', {user: user});
    }, this);
  },

  /**
   * Callback when one or more new users have been removed from the room
   */
  _onUsersRemoved: function(event) {
    _.each(event.removedParticipants, function(participant) {
      var user = this._buildUser(participant);
      this.trigger('userremoved', {user: user});
    }, this);
  }
};
_.extend(Platform, Backbone.Events);

module.exports = Platform;