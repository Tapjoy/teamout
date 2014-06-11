var webpack = require("webpack");
var root = __dirname + "/..";

module.exports = {
  context: root + "/app",
  entry: {
    main: "./main.js",
    hangout: "../test/app/hangout.js"
  },
  output: {
    path: __dirname + "/../public/assets/js",
    filename: "[name].js",
    chunkFilename: "[id].js"  
  },
  resolve: {
    modulesDirectories: ["vendor"],
    alias: {
      bootstrap$: "bootstrap/dist/js/bootstrap.js",
      nanoscroller$: "nanoscroller/bin/javascripts/jquery.nanoscroller.js"
    }
  },
  recordsPath: __dirname + "/webpack-records.json",
  plugins: [
    new webpack.ResolverPlugin([
      new webpack.ResolverPlugin.DirectoryDescriptionFilePlugin("bower.json", ["main"])
    ]),
    new webpack.ResolverPlugin([
      new webpack.ResolverPlugin.DirectoryDescriptionFilePlugin(".bower.json", ["main"])
    ])
  ],
  module: {
    noParse: /vendor\/(ccv|face|jquery|jssha|node\-uuid|ractive|StackBlur|strftime|underscore|webfont)\//,
    loaders: [
      {test: /\.ractive$/, loader: "ractive"},
      {test: /\/bootstrap\//, loader: "imports?jQuery=jquery"},
      {test: /\/ccv\//, loader: "exports?ccv"},
      {test: /\/face\//, loader: "exports?cascade"},
      {test: /\/nanoscroller\//, loader: "imports?jQuery=jquery"},
      {test: /\/StackBlur\//, loader: "exports?stackBlurImage&stackBlurCanvasRGB&stackBlurCanvasRGBA"},
      {test: /\/webfont\//, loader: "exports?window.WebFont"}
    ]
  }
};