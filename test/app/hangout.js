var _ = require('underscore');
var Backbone = require('backbone');
var Ractive = require('ractive');
require('ractive-adaptors-backbone');

var Participant = Backbone.Model.extend({
  defaults: {
    id: null,
    googleId: null,
    name: null,
    avatar: null,
    visible: true,
    audible: true,
    authorized: false
  },

  toJSON: function() {
    return {
      id: this.id,
      person: {
        id: this.get('googleId'),
        displayName: this.get('name')
      }
    }
  }
});
var Participants = Backbone.Collection.extend({
  model: Participant
});

var Hangout = Backbone.Model.extend({
  defaults: {
    state: {},
    participants: new Participants(),
    displayedParticipant: null,
    cameraMute: false,
    microphoneMute: false,
    apiReady: true,
    localParticipantVideoMirrored: true,
    localAudioNotificationsMuted: false,
    chatPaneVisible: true
  },

  initialize: function() {
    // Add default participant
    this.get('participants').add({id: 'session-default', googleId: 'default', name: 'Ben Zelano', authorized: true});

    // Hook up events
    this.on('change:apiready', function(self, value) {
      if (value) {
        this.trigger('apiready');
      }
    }, this);
    this.on('change:cameraMute', function(self, value) {
      setTimeout(_.bind(function() {
        this.trigger('cameramute', {isCameraMute: value});
      }, this), 0);
    }, this);
    this.on('change:microphoneMute', function(self, value) {
      setTimeout(_.bind(function() {
        this.trigger('microphonemute', {isMicrophoneMute: value});
      }, this), 0);
    }, this);
    this.on('change:displayedParticipant', function(self, value) {
      if (value) {
        setTimeout(_.bind(function() {
          this.trigger('displayedparticipantchanged', {displayedParticipant: value});
        }, this), 0);
      }
    }, this);
    this.get('participants').on('add', function(participant) {
      setTimeout(_.bind(function() {
        this.trigger('participantsadded', {addedParticipants: [participant.toJSON()]});
      }, this), 0);
    }, this);
    this.get('participants').on('remove', function(participant) {
      setTimeout(_.bind(function() {
        this.trigger('participantsremoved', {removedParticipants: [participant.toJSON()]});
      }, this), 0);
    }, this);

    // Bind functions to this object
    var bind = _.bind(function(root, parent, property) {
      if (_.isFunction(parent[property])) {
        parent[property] = _.bind(parent[property], root);
      } else {
        for (var key in parent[property]) {
          bind(root, parent[property], key);
        }
      }
    }, this);
    var toBind = ['onApiReady', 'onParticipantsAdded', 'onParticipantsRemoved', 'data', 'av', 'layout'];
    for (var i = 0; i < toBind.length; i++) {
      bind(this, this, toBind[i]);
    }
  },

  isApiReady: function() {
    return this.get('apiReady');
  },
  getHangoutUrl: function() {
    return location.href.replace('?', '/');
  },
  getLocalParticipant: function() {
    return this.getParticipantById('session-default');
  },
  getLocalParticipantId: function() {
    return this.getLocalParticipant().id;
  },
  getParticipants: function() {
    return this.get('participants').toJSON();
  },
  getParticipantById: function(sessionId) {
    return this.get('participants').get(sessionId).toJSON();
  },
  onApiReady: {
    add: function(callback) {
      this.on('apiready', callback);
    }
  },
  onParticipantsAdded: {
    add: function(callback) {
      this.on('participantsadded', callback);
    }
  },
  onParticipantsRemoved: {
    add: function(callback) {
      this.on('participantsremoved', callback);
    }
  },

  data: {
    getState: function() {
      return JSON.parse(JSON.stringify(this.get('state')));
    },
    submitDelta: function(updates, removes) {
      var removedKeys = removes;
      for (var i = 0; i < removes.length; i++) {
        delete this.get('state')[removes[i]];
      }

      var addedKeys = [];
      for (var key in updates) {
        this.get('state')[key] = updates[key];
        addedKeys.push({key: key, value: updates[key], timestamp: _.now()});
      }

      setTimeout(_.bind(function() {
        this.trigger('statechanged', {addedKeys: addedKeys, removedKeys: removedKeys})
      }, this), 0);
    },
    onStateChanged: {
      add: function(callback) {
        this.on('statechanged', callback);
      }
    }
  },

  av: {
    setAvatar: function(sessionId, url) {
      this.get('participants').get(sessionId).set('avatar', url);
    },
    clearAvatar: function(sessionId) {
      this.get('participants').get(sessionId).unset('avatar');
    },
    getCameraMute: function() {
      return this.get('cameraMute');
    },
    setCameraMute: function(muted) {
      this.set('cameraMute', muted);
    },
    getMicrophoneMute: function() {
      return this.get('microphoneMute');
    },
    setMicrophoneMute: function(muted) {
      this.set('microphoneMute', muted);
    },
    isParticipantVisible: function(sessionId) {
      return this.get('participants').get(sessionId).get('visible');
    },
    setParticipantVisible: function(sessionId, visible) {
      this.get('participants').get(sessionId).set('visible', visible);
    },
    isParticipantAudible: function(sessionId) {
      return this.get('participants').get(sessionId).get('audible');
    },
    setParticipantAudible: function(sessionId, audible) {
      this.get('participants').get(sessionId).set('audible', audible);
    },
    setLocalParticipantVideoMirrored: function(mirrored) {
      this.set('localParticipantVideoMirrored', mirrored);
    },
    setLocalAudioNotificationsMute: function(muted) {
      this.set('localAudioNotificationsMuted', muted)
    },
    onCameraMute: {
      add: function(callback) {
        this.on('cameramute', callback);
      }
    },
    onMicrophoneMute: {
      add: function(callback) {
        this.on('microphonemute', callback);
      }
    }
  },

  layout: {
    getDefaultVideoFeed: function() {
      return this.layout._videoFeed;
    },
    _videoFeed: {
      setDisplayedParticipant: function(sessionId) {
        this.set('displayedParticipant', sessionId);
      },
      clearDisplayedParticipant: function() {
        this.unset('displayedParticipant');
      },
      onDisplayedParticipantChanged: {
        add: function(callback) {
          this.on('displayedparticipantchanged', callback);
        }
      }
    },
    setChatPaneVisible: function(visible) {
      this.set('chatPaneVisible', visible);
    },
    displayNotice: function(message) {
      console.log('Notice: ' + message);
    }
  }
});

window.gapi = {
  hangout: new Hangout()
};

var HangoutView = Ractive.extend({
  adapt: ['Backbone'],
  template: require('./hangout.ractive')
});

new HangoutView({el: 'hangout', data: {hangout: window.gapi.hangout}});