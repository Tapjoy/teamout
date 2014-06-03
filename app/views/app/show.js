var $ = require('jquery');
require('nanoscroller');

var Platform = require('../../lib/platform.js');
var Camera = require('../../models/camera.js');
var View = require('../../lib/view.js');
var ConversationView = require('../conversation/show.js');
var SettingListView = require('../setting/list.js');
var UserListView = require('../user/list.js');

var AppView = View.extend({
  template: require('./show.ractive'),
  components: {
    conversation: ConversationView,
    users: UserListView,
    settings: SettingListView
  },

  init: function() {
    View.prototype.init.apply(this, arguments);

    this.findComponent('users').observe('users.*', this.updateScrollbar);
    this.updateScrollbar();

    if (!Camera.supported) {
      this.get('app').get('user').notify('camera', 'Photos are not supported in your browser. Photos only work on Google Chrome, Firefox, and Opera.');
    }

    Platform.on('displayeduserchanged', this._onDisplayedUserChanged, this);
    Platform.setDisplayedUser(app.get('user'));
    this.observe('app.user.conversation', this._onConversationChanged, {context: this});
  },

  /**
   * Updates scroll panes on the page
   */
  updateScrollbar: function() {
    setTimeout(function() {
      $('.nano:visible').nanoScroller({alwaysVisible: true});
    }, 0);
  },

  /**
   * Callback when the the currently displayed user in the video feed has
   * changed
   */
  _onDisplayedUserChanged: function() {
    var app = this.get('app');
    if (!app.get('user').has('conversation')) {
      Platform.setDisplayedUser(app.get('user'));
    }
  },

  /**
   * Callback when the current user has changed conversation
   */
  _onConversationChanged: function(newValue) {
    if (newValue) {
      Platform.resetDisplayedUser();
    } else {
      Platform.setDisplayedUser(app.get('user'));
    }
  }
});

module.exports = AppView;