var View = require('../../lib/view.js');

var ConversationView = View.extend({
  template: require('./show.ractive'),
  eventNames: ['leave', 'toggleLock'],
  data: {
    isLast: function(users, index) {
      return index == users.length - 1 || index == users.length - 2 && users.at(users.length - 1).get('authorized');
    }
  },

  /**
   * Leave the current conversation
   */
  leave: function(event) {
    app.get('user').leave();
  },

  /**
   * Locks the conversation, preventing other users from joining
   */
  toggleLock: function(event) {
    var conversation = this.get('user').get('conversation');
    conversation.set({locked: !conversation.get('locked')});
    conversation.save();
  }
});

module.exports = ConversationView;