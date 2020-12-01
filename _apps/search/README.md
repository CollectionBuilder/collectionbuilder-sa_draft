# Elasticsearch Search Application

This application provides a UI for searching across one or more Elasticsearch indices.

## Concepts

### Web Components

This application is built using native Web Components as opposed to a third-party component framework like React, Vue, etc.

From [MDN](https://developer.mozilla.org/en-US/docs/Web/Web_Components):
> Web Components is a suite of different technologies allowing you to create reusable custom elements — with their functionality encapsulated away from the rest of your code — and utilize them in your web apps.

### Building (i.e. linting, transpiling, and minifying)

Since this application is implemented using native Web Components, any modern browser can render it as is,
requiring nothing more than a skeletal HTML file that imports the `src/components/Search.js` module and includes a `<search-app>` element.
See [index.html](https://github.com/CollectionBuilder/collectionbuilder-sa_draft/blob/bundle-search-app/_apps/search/index.html) for an example of how we do this for local development.

Serving the stock application in this way is great for local development, but is undesirable in production for the following reasons:
  - Inefficiencies
    - The browser makes a separate HTTP request to the server to retrieve each Javascript file
    - The Javascript files have not been minified (i.e. compressed)
  - Incompatibilites
    - Only browsers that support the HTML / Javascript features used in the application code will be able to render the application

In order to create a more compact and compatible version of our application, we need to build it.

The build process comprises the following:
  1. Linting
  - This step (performed by [es-lint](https://eslint.org/)) checks the code against a set of style rules and target browsers
  (specified by the [browserslist](https://github.com/browserslist/browserslist) property in `package.json`) and emits a warning or error for each
  inconsistency that it finds.
  
  2. Transpile
  - This step (performed by [Babel](https://babeljs.io/), sourcing polyfills from [core-js](https://github.com/zloirock/core-js)) injects polyfills
  into any module that uses features not natively supported by your target browsers (specified by the [browserslist](https://github.com/browserslist/browserslist) property in `package.json`), thus facilitating browser backward-compatibility.
  
  3. Minifying
  - This step (performed by [Webpack](https://webpack.js.org/)) concatenates and compresses the multiple transpiled modules into a single file.
  

## Prerequisites

You'll need `node` (v13.8.0 or compatible) and `npm` (v6.13.6 or compatible) installed.

I recommend using [nvm](https://github.com/nvm-sh/nvm/blob/master/README.md) (node version manager) to install and manage your `node`/`npm` versions: [Installing and Updating](https://github.com/nvm-sh/nvm/blob/master/README.md#installing-and-updating) 


## Install the Dependencies

Using a terminal, in the root directory of this application, execute:

```
npm install
```


## Start the Development Server

```
npm run dev
```

Point your browser at the displayed URL, probably: http://localhost:5000


## Build the Application

### Build the "modern" application

The "modern" application will be compatible with the list of browsers defined [here](https://github.com/CollectionBuilder/collectionbuilder-sa_draft/blob/bundle-search-app/_apps/search/package.json#L7).
```
npm run build:modern
```

### Build the "legacy" application

The "legacy" application will be compatible with the list of browsers defined [here](https://github.com/CollectionBuilder/collectionbuilder-sa_draft/blob/bundle-search-app/_apps/search/package.json#L14).
```
npm run build:legacy
```

_Note that both `build:modern` and `build:legacy` scripts conclude with a `copy` step that copies the build output to the `../../assets/js/`
Collection Builder directory. If this ever becomes a standalone repo, we should remove that._



