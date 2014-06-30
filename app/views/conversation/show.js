var View = require('../../lib/view.js');

var ConversationView = View.extend({
  template: require('./show.ractive'),
  eventNames: ['leave'],
  data: {
    firstName: function(user) {
      return user.getFirstName();
    },
    isLast: function(users, index) {
      return index == users.length - 1;
    }
  },

  /**
   * Leave the current conversation
   */
  leave: function(event) {
    app.get('user').leave();
  }
});

module.exports = ConversationView;