const path = require('path');

module.exports = {
  entry: {
    'Search': './src/components/Search.js',
  },
  output: {
    path: path.join(__dirname, "build/dist"),
    filename: "[name].js",
    "libraryTarget": "var",
    "library": "[name]"
  }
};
