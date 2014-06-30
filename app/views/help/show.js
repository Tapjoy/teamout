var View = require('../../lib/view.js');

// The help guide
var HelpShowView = View.extend({
  template: require('./show.ractive')
});

module.exports = HelpShowView;