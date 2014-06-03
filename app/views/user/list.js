var View = require('../../lib/view.js');
var UserView = require('./show.js');

// Listing of users in a room
var UserListView = View.extend({
  template: require('./list.ractive'),
  components: {
    user: UserView
  },
  data: {
    isJoinable: function(user) {
      return user.isJoinable();
    }
  },
  computed: {
    isEmpty: function() {
      return this.get('users').joinable().length == 0;
    }
  }
});

module.exports = UserListView;