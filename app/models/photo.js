var $ = require('jquery');
var _ = require('underscore');
var ccv = require('ccv');
var cascade = require('face');
var stackBlurCanvasRGB = require('StackBlur').stackBlurCanvasRGB;

var Model = require('../lib/model.js');

// A snapshot taken through a webcam
var Photo = Model.extend({
  defaults: {
    width: 300,
    height: 225,
    quality: 0.7
  },

  initialize: function() {
    var faces = ccv.detect_objects({
      canvas: ccv.pre(this.get('canvas')),
      cascade: cascade,
      interval: 5,
      min_neighbors: 1
    });

    this.set({faces: faces});
  },

  /**
   * Determines whether a user is present in the given photo
   */
  hasFaces: function() {
    return this.get('faces').length > 0;
  },

  /**
   * Generates a data url based on the current state of the photo's canvas
   */
  imageUrl: function() {
    return this.get('canvas').toDataURL('image/jpeg', this.get('quality'));
  },

  /**
   * Runs image processing filters on the given canvas
   */
  filter: function(filterType) {
    switch (filterType) {
      case 'desaturate':
        this._desaturate();
        break;
      case 'blur':
        this._blur(3);
        break;
      case 'pixelate':
        this._pixelate(6);
        break;
    }
  },

  /**
   * Desaturates the photo, converting all colors to grayscale
   */
  _desaturate: function() {
    var canvas = this.get('canvas');
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
   * Performs a stack blur on the photo.  The radius determines the extent to
   * which the image is blurred.
   */
  _blur: function(radius) {
    var canvas = this.get('canvas');
    stackBlurCanvasRGB(canvas, 0, 0, canvas.width, canvas.height, radius);
  },

  /**
   * Pixelates the photo using hexagons.  The radius determines the radius of
   * the hexagons.
   */
  _pixelate: function(radius) {
    this._blur(3);

    var canvas = this.get('canvas');
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
}, {
  /**
   * The default photo url when an actual photo is not available
   */
  defaultUrl: function() {
    if (!this._defaultUrl) {
      var width = this.prototype.defaults.width;
      var height = this.prototype.defaults.height;

      var canvas = $('<canvas />').attr({width: width, height: height})[0];
      var context = canvas.getContext('2d');
      context.rect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#cccccc';
      context.fill();

      context.font = '200px Glyphicons Regular';
      context.textBaseline = 'bottom';
      context.fillStyle = '#000000';
      context.fillText("\uE004", 49, 275);

      this._defaultUrl = canvas.toDataURL('image/jpeg');
    }

    return this._defaultUrl;
  }
});

module.exports = Photo;