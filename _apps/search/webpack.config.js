const path = require('path');

module.exports = {
  entry: {
    'SearchApp': './src/components/Search.js',
  },
  output: {
    path: path.join(__dirname, "build/dist"),
    filename: "[name].js",
    "libraryTarget": "var",
    "library": "[name]"
  }
};
