var _ = require('underscore');

var View = require('../../lib/view.js');

// Pop-up modal dialog
var DialogView = View.extend({
  el: 'body',
  append: true,
  template: require('./dialog.ractive'),
  data: {
    id: 'dialog'
  },

  init: function() {
    var $modal = this.$('#' + this.get('id'));
    $modal.modal('show');
    $modal.on('hidden.bs.modal', _.bind(function() {
      // Has to occur after the event has completed to avoid exceptions
      setTimeout(_.bind(this.teardown, this), 0);
    }, this));
  }
});

module.exports = DialogView;