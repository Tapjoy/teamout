var $ = require('jquery');
var _ = require('underscore');

var Model = require('../lib/model.js');
var Photo = require('./photo.js');

navigator.getMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

// The user's webcam
var Camera = Model.extend({
  defaults: {
    enabled: false,
    interval: 1,
    source: null,
    timestamp: null
  },

  /**
   * Provides a helper for building URLs from streams
   */
  buildURL: window.webkitURL || window.URL,

  /**
   * Gets the interval, in ms, to snap photos
   */
  interval: function() {
    return parseFloat(this.get('interval')) * 60 * 1000;
  },

  /**
   * Gets the available video sources and invokes the callback with those that
   * are found.
   */
  sources: function(callback) {
    if (Camera.supported && MediaStreamTrack.getSources) {
      MediaStreamTrack.getSources(function(sources) {
        var videoSources = [];
        for (var i = 0; i < sources.length; i++) {
          var source = sources[i];

          if (source.kind == 'video') {
            videoSources.push(source);
          }
        }

        callback(videoSources);
      });
    } else {
      callback([]);
    }
  },

  /**
   * Takes a new photo, triggering the "newphoto" event if successful
   */
  takePhoto: function() {
    if (!Camera.supported) {
      return;
    }

    // Constrain the video source
    var constraints;
    var source = this.get('source');
    if (source) {
      constraints = {optional: [{sourceId: source}]}
    } else {
      constraints = true;
    }

    this.notifier = setTimeout(function() {
      app.get('user').notify('camera', 'Please select Allow above to enable presence detection')
    }, 3000);

    navigator.getMedia(
      {video: constraints},
      _.bind(this._onAvailable, this),
      _.bind(this._onError, this)
    );
  },

  /**
   * Periodically takes a new photo based on the interval configured for the
   * camera
   */
  timeLapse: function() {
    if (!Camera.supported) {
      return;
    }

    var timeRemaining;
    if (_.result(this.attributes, 'enabled')) {
      timeRemaining = this.get('timestamp') ? this.get('timestamp') + this.interval() - _.now() : 0;

      if (timeRemaining <= 0) {
        this.set({timestamp: _.now()});
        timeRemaining = this.interval();

        this.takePhoto();
      }
    } else {
      timeRemaining = 1000;
    }

    // Restart timer
    clearTimeout(this._timer);
    this._timer = setTimeout(_.bind(this.timeLapse, this), timeRemaining);
  },

  /**
   * Stops running the time lapse mechanism
   */
  stopTimeLapse: function() {
    if (this._timer) {
      clearTimeout(this._timer);
    }
  },

  /**
   * Callback when a stream for the camera is available
   */
  _onAvailable: function(stream) {
    clearTimeout(this.notifier);

    var url = window.URL.createObjectURL(stream);
    var video = $('<video />').attr({
      width: Photo.prototype.defaults.width,
      height: Photo.prototype.defaults.height
    })[0];
    video.src = url;
    video.play();

    // Wait about a second after the stream is ready to take a picture to allow
    // the video stream to adjust to light in the room
    var onReady = _.bind(this._capture, this, video, stream);
    $(video).on('canplay', function() { setTimeout(onReady, 1000); });
  },

  /**
   * Captures the image 
   */
  _capture: function(video, stream) {
    try {
      // Calculate width / height of image based on video aspect ratio
      var width = Photo.prototype.defaults.width;
      var height = Photo.prototype.defaults.height;
      var videoRatio = video.videoWidth / video.videoHeight;
      var photoRatio = width / height;
      if (photoRatio < videoRatio) {
        height = parseInt(width / videoRatio);
      } else if (photoRatio > videoRatio) {
        width = parseInt(height * videoRatio);
      }

      // Draw the video onto our canvas
      var canvas = $('<canvas />').attr({width: width, height: height})[0];
      var context = canvas.getContext('2d');
      context.fillStyle = '#000000';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);

      // Stop the stream
      video.pause();
      stream.stop();

      this.trigger('newphoto', {photo: new Photo({canvas: canvas})});
    } catch(e) {
      if (e.name == 'NS_ERROR_NOT_AVAILABLE') {
        setTimeout(_.bind(this._capture, this, video, stream), 1000);
      } else {
        try {
          stream.stop();
        } catch(e) {
        }

        this.trigger('error', {error: e});
      }
    }
  },

  /**
   * Callback when an error is encountered snapping a photo
   */
  _onError: function(error) {
    app.get('user').notify('camera', 'Unable to take a picture. Please check your webcam settings.')
    console.log('Error updating photo: ', error);
  }
}, {
  /**
   * Whether camera access is supported in this browser
   */
  supported: navigator.getMedia != undefined
});

module.exports = Camera;