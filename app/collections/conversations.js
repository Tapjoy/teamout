var Collection = require('../lib/collection.js');
var Conversation = require('../models/conversation.js');

// A collection of Conversation models
var Conversations = Collection.extend({
  url: '/conversations',
  model: Conversation
});

module.exports = Conversations;