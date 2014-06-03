require('bootstrap');
var $ = require('jquery');

$(function() {
  var App = require('./models/app.js');
  var AppView = require('./views/app/show.js');

  var app = new App();
  app.on('ready', function() {
    new AppView({el: 'container', data: {app: app}});
  });

  window.app = app;
});