app.photo = {
  // Dimensions of photos
  width: 300,
  height: 225,
  quality: 0.7,

  // The maximum size photo parts can be stored in
  partSize: 8192,

  // Provides a helper for building URLs from streams
  buildURL: window.webkitURL || window.URL,

  init: function() {
    // Kick off the initial refresh
    this.refresh();
  },

  /**
   * Clears out old photo keys
   */
  cleanup: function() {
    var keys = app.data.keys();
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var participantId = app.participants.idFromKey(key);

      if (participantId == app.participant.id && key.indexOf('/photos') > 0) {
        app.data.clear(key);
      }
    }
  },

  /**
   * Whether photos are supported in this browser
   */
  isSupported: function() {
    return navigator.getMedia != undefined;
  },

  /**
   * Waits until the photo is able to be refresh -- at which point the
   * given callback is called.
   */
  waitUntilCanRefresh: function(callback) {
    clearInterval(this.waiter);

    this.waiter = setInterval($.proxy(function() {
      if (this.canRefresh()) {
        clearInterval(this.waiter);
        callback();
      }
    }, this), 1000);
  },

  /**
   * Gets the interval, in ms, to refresh photos
   */
  refreshInterval: function() {
    return parseFloat(app.settings.get('photoInterval')) * 60 * 1000;
  },

  /**
   * Refreshes the image representing the local participant
   */
  refresh: function() {
    if (app.settings.get('photoEnabled') == 'true') {
      if (this.canRefresh()) {
        var timeRemaining = this.lastRefresh ? this.lastRefresh + this.refreshInterval() - $.now() : 0;

        if (timeRemaining <= 0) {
          this.lastRefresh = $.now();
          timeRemaining = this.refreshInterval();

          // Constrain the video source based on existing settings
          var constraints;
          var photoSource = app.settings.get('photoSource');
          if (photoSource) {
            constraints = {optional: [{sourceId: photoSource}]}
          } else {
            constraints = true;
          }

          // Show a notification to the user to make sure they see to authorize
          // access to media
          if (app.settings.get('initialPhoto') == 'true') {
            app.settings.set('initialPhoto', 'false');
            app.notification.show("Please select Allow above to enable presence detection");
          }

          navigator.getMedia(
            {video: constraints},
            $.proxy(this.refreshWithStream, this),
            $.proxy(this.onError, this, null)
          );
        }

        // Restart timer
        clearTimeout(this.refresher);
        this.refresher = setTimeout($.proxy(this.refresh, this), timeRemaining);
      } else {
        this.waitUntilCanRefresh($.proxy(this.refresh, this));
      }
    }
  },

  /**
   * Determines whether the photo is capable of being refreshed
   */
  canRefresh: function() {
    return gapi.hangout.av.getCameraMute() == true &&
      gapi.hangout.av.getMicrophoneMute() == true &&
      !app.participant.isHanging() &&
      app.participants.all().length;
  },

  /**
   * Callback when the system is ready to refresh
   */
  refreshWithStream: function(stream) {
    var url = window.URL.createObjectURL(stream);
    var video = this.buildVideo(url);
    $(video).on('canplay', $.proxy(function() {
      this.captureImage(video, stream, $.proxy(this.update, this), $.proxy(this.onError, this, stream));
    }, this));
  },

  /**
   * Callback when an error is encountered updating the photo
   */
  onError: function(stream, error) {
    if (stream) {
      try {
        stream.stop();
      } catch(ex) {
        console.log('Error stopping stream: ', ex);
      }
    }

    app.notification.show('Unable to take a picture. Please check your webcam settings.');
    console.log('Error updating photo: ', error);
  },

  /**
   * Gets the available video sources and invokes the callback with those that
   * are found.
   */
  sources: function(callback) {
    if (MediaStreamTrack.getSources) {
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
   * Loads a video feed for the given url, capturing the first image available
   */
  buildVideo: function(url) {
    var video = $('<video />').attr({width: this.width, height: this.height})[0];
    video.src = url;
    video.play();
    return video;
  },

  /**
   * Captures the image 
   */
  captureImage: function(video, stream, success, error) {
    try {
      // Draw the video onto our canvas
      var canvas = $('<canvas />').attr({width: this.width, height: this.height})[0];
      var context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, this.width, this.height);

      // Save the image
      this.filter(canvas);
      var url = canvas.toDataURL('image/jpeg', this.quality);
      var squareUrl = this.squareImageUrl(canvas);

      // Stop the stream
      video.pause();
      stream.stop();

      success(url, squareUrl);
    } catch(e) {
      if (e.name == 'NS_ERROR_NOT_AVAILABLE') {
        setTimeout($.proxy(this.captureImage, this, video, stream, success, error), 1000);
      } else {
        error(e);
      }
    }
  },

  /**
   * Runs image processing filters on the given canvas
   */
  filter: function(canvas) {
    this.filters.desaturate(canvas);

    switch(app.settings.get('photoPrivacy')) {
      case 'blur':
        this.filters.blur(canvas, 3);
        break;
      case 'pixelate':
        this.filters.pixelate(canvas, 6);
        break;
      case 'silhouette':
        this.filters.silhouette(canvas);
        break;
    }
  },

  filters: {
    /**
     * Desaturates the given canvas, converting all colors to grayscale
     */
    desaturate: function(canvas) {
      var context = canvas.getContext('2d');
      var data = context.getImageData(0, 0, canvas.width, canvas.height);
      var pixels = data.data;
      var pixelCount = pixels.length;

      for (var i = 0; i < pixelCount; i += 4) {
        var grayscale = pixels[i] * 0.3 + pixels[i + 1] * 0.59 + pixels[i + 2] * 0.11;
        pixels[i] = grayscale;
        pixels[i + 1] = grayscale;
        pixels[i + 2] = grayscale;
      }

      context.putImageData(data, 0, 0);
    },

    /**
     * Performs a stack blur on the given canvas.  The radius determines the
     * extent to which the image is blurred.
     */
    blur: function(canvas, radius) {
      stackBlurCanvasRGB(canvas, 0, 0, canvas.width, canvas.height, radius);
    },

    /**
     * Pixelates the given canvas using hexagons.  The radius determines the
     * radius of the hexagons.
     */
    pixelate: function(canvas, radius) {
      this.blur(canvas, 3);

      var context = canvas.getContext('2d');
      var data = context.getImageData(0, 0, canvas.width, canvas.height);
      var pixels = data.data;

      // Polygon configuration
      var numberOfSides = 6;
      var angle = 2 * Math.PI / numberOfSides;
      var width = radius * 2;
      var height = Math.round(radius * Math.sin(angle) * 2) - 1;

      for (var x = 0; x < canvas.width; x += Math.round(width * 1.5)) {
        for (var y = 0; y < canvas.height; y += height) {
          var points = [[x, y], [x + Math.round(radius * 1.5), y + Math.round(height / 2)]];

          for (var i = 0; i < points.length; i++) {
            var point = points[i];
            var offsetX = point[0];
            var offsetY = point[1];

            // Draw an outline of the shape
            context.beginPath();
            context.moveTo(offsetX + radius, offsetY);
            for (var side = 1; side <= numberOfSides; side += 1) {
              context.lineTo(
                offsetX + Math.round(radius * Math.cos(side * angle)),
                offsetY + Math.round(radius * Math.sin(side * angle))
              );
            }

            // Grab color at center of the shape
            var colorX = offsetX > canvas.width ? canvas.width - 1 : offsetX;
            var colorY = offsetY > canvas.height ? canvas.height - 1 : offsetY;
            var index = (colorY * canvas.width + colorX) * 4;
            var red = pixels[index];
            var green = pixels[index + 1];
            var blue = pixels[index + 2];
            var alpha = pixels[index + 3];

            // Fill in the shape
            context.fillStyle = 'rgba(' + red + ',' + green + ',' + blue + ',' + alpha + ')';
            context.closePath();
            context.fill();
          }
        }
      }
    },

    /**
     * Detects the presence of faces in the photo and draws a silhouette
     */
    silhouette: function(canvas) {
      var faces = ccv.detect_objects({canvas: ccv.pre(canvas), cascade: cascade, interval: 5, min_neighbors: 1});

      var context = canvas.getContext('2d');
      context.rect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#cccccc';
      context.fill();

      context.font = '200px Glyphicons Halflings';
      context.textBaseline = 'bottom';
      context.fillStyle = faces.length ? '#53a93f' : '#000000';
      context.fillText("\uE008", 49, 275);
    }
  },

  /**
   * Resizes the given canvas to a square image and generates a url for that
   * image
   */
  squareImageUrl: function(sourceCanvas) {
    var size = Math.min(sourceCanvas.width, sourceCanvas.height);
    var canvas = $('<canvas />').attr({width: size, height: size})[0];
    var context = canvas.getContext('2d');
    var x = parseInt((sourceCanvas.width - size) / 2);
    var y = parseInt((sourceCanvas.height - size) / 2);
    context.drawImage(sourceCanvas, x, y, size, size, 0, 0, size, size);

    var url = canvas.toDataURL('image/jpeg', this.quality);

    return url;
  },

  /**
   * Updates the current participant's photo with the given url
   */
  update: function(url, squareUrl) {
    var id = $.now();
    gapi.hangout.av.setAvatar(app.participant.id, squareUrl);

    // Clean up old, outdated photos
    this.cleanup();

    // Send a notification to other participants of the updated image.
    // Images need to be sent in parts because of key-value limits in
    // Hangout's data transmission protocol
    for (var i = 0; i < url.length; i += this.partSize) {
      var partId = i / this.partSize;
      var data = url.substr(i, Math.min(url.length - i, this.partSize));
      app.data.set(app.participant.id + '/photos/' + id + '/parts/' + partId, data);
    }

    // Update the reference for the photo
    var partsCount = Math.ceil(url.length / this.partSize);
    app.data.set(app.participant.id + '/photo', id + ',' + partsCount);
  }
};