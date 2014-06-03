var View = require('../../lib/view.js');

var ConversationView = View.extend({
  template: require('./show.ractive')
});

module.exports = ConversationView;