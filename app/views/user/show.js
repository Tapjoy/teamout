var _ = require('underscore');

var View = require('../../lib/view.js');
var ConversationView = require('../conversation/show.js');

// An individual user in a room
var UserView = View.extend({
  template: require('./show.ractive'),
  eventNames: ['join'],
  data: {
    photos: []
  },
  components: {
    conversation: ConversationView
  },

  init: function() {
    View.prototype.init.apply(this, arguments);

    this.observe('user.photoUrl', this._onUrlChanged, {context: this});
  },

  /**
   * Callback when requesting to join this user
   */
  join: function(event) {
    app.get('user').join(this.get('user'));
  },

  /**
   * Callback when the url for this user has changed
   */
  _onUrlChanged: function(newValue, oldValue, keypath) {
    var photos = _.clone(this.get('photos'));
    if (photos.length > 1) { photos = _.rest(photos, 1); }
    photos.push(newValue);
    this.merge('photos', photos);
  }
});

module.exports = UserView;