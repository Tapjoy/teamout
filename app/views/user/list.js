var View = require('../../lib/view.js');
var UserView = require('./show.js');

// Listing of users in a room
var UserListView = View.extend({
  template: require('./list.ractive'),
  components: {
    user: UserView
  },
  computed: {
    joinableUsers: function() {
      return this.get('users').joinable();
    }
  },

  init: function() {
    View.prototype.init.apply(this, arguments);

    this.get('users').on('change', this._onUserChanged, this);
  },

  /**
   * Callback when the data associated with a user has changed
   */
  _onUserChanged: function(user) {
    this.update('joinableUsers');
  }
});

module.exports = UserListView;