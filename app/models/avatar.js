var $ = require('jquery');
var _ = require('underscore');

var Model = require('../lib/model.js');
var Platform = require('../lib/platform.js');

// Represents the avatar for the user
var Avatar = Model.extend({
  defaults: {
    includeName: true,
    size: 300
  },

  initialize: function() {
    // Generate the url
    if (this.get('includeName')) {
      this.set({imageUrl: this._urlWithName()});
    } else {
      this.set({imageUrl: this._urlWithoutName()});
    }
  },

  /** 
   * Generates an avatar URL without the user's name displayed
   */
  _urlWithoutName: function() {
    var canvas = $('<canvas />').attr({width: this.get('size'), height: this.get('size')})[0];
    var context = canvas.getContext('2d');
    context.fillStyle = '#181818';
    context.fillRect(0, 0, canvas.width, canvas.height);

    return canvas.toDataURL();
  },

  /**
   * Generates an avatar URL with the user's name displayed
   */
  _urlWithName: function() {
    var firstName = this.get('user').getFirstName();

    var canvas = $('<canvas />').attr({width: this.get('size'), height: this.get('size')})[0];
    var context = canvas.getContext('2d');

    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.font = '48px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';
    context.fillText(firstName, canvas.width / 2, canvas.height / 2);

    return canvas.toDataURL();
  },

  /**
   * Shows the latest photo as the user's current avatar
   */
  show: function() {
    Platform.setAvatar(this.get('user'), this.get('imageUrl'));
  },

  /**
   * Resets the avatar for the current user to the default
   */
  reset: function() {
    Platform.resetAvatar(this.get('user'));
  }
});

module.exports = Avatar;