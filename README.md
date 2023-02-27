# ES Module Shims

Shims modern ES Modules features like import maps on top of the baseline modules support in browsers supported by [95% of users](https://caniuse.com/#feat=es6-module).

When running in polyfill mode, [the 72% of users](https://caniuse.com/import-maps) with import maps entirely bypass the shim code entirely.

For the remaining 28% of users, the highly performant (see [benchmarks](#benchmarks)) production and [CSP-compatible](#csp-support) shim kicks in to rewrite module specifiers driven by the [Web Assembly ES Module Lexer](https://github.com/guybedford/es-module-lexer).

The following modules features are polyfilled:

* [Import Maps](#import-maps) polyfill.
* Dynamic `import()` shimming when necessary in eg older Firefox versions.
* `import.meta` and `import.meta.url`.
* [JSON](#json-modules) and [CSS modules](#css-modules) with import assertions (when enabled).
* [`<link rel="modulepreload">` polyfill](#modulepreload) in non Chromium browsers for both shimmed and unshimmed preloading scenarios.

When running in shim mode, module rewriting is applied for all users and custom [resolve](#resolve-hook) and [fetch](#fetch-hook) hooks can be implemented allowing for custom resolution and streaming in-browser transform workflows.

Because we are still using the native module loader the edge cases work out comprehensively, including:

* Live bindings in ES modules
* Dynamic import expressions (`import('src/' + varname')`)
* Circular references, with the execption that live bindings are disabled for the first unexecuted circular parent.

> [Built with](https://github.com/guybedford/es-module-shims/blob/main/chompfile.toml) [Chomp](https://chompbuild.com/)

## Usage

Include ES Module Shims with a `async` attribute on the script, then include an import map and module scripts normally:

```html
<script async src="https://ga.jspm.io/npm:es-module-shims@1.7.0/dist/es-module-shims.js"></script>

<!-- https://generator.jspm.io/#U2NhYGBkDM0rySzJSU1hKEpNTC5xMLTQM9Az0C1K1jMAAKFS5w0gAA -->
<script type="importmap">
{
  "imports": {
    "react": "https://ga.jspm.io/npm:react@18.0.0-rc.0/index.js"
  },
  "scopes": {
    "https://ga.jspm.io/npm:react@18.0.0-rc.0/": {
      "object-assign": "https://ga.jspm.io/npm:object-assign@4.1.1/index.js"
    }
  }
}
</script>

<script type="module">
  import react from 'react';
  console.log(react);
</script>
```

## Polyfill Explainer

When running the previous example in a browser without import maps support, the browser will output the following console error:

```
Uncaught TypeError: Failed to resolve module specifier "react". Relative references must start with either "/", "./", or "../".
  at <anonymous>:1:15
```

This error is important - it means that the native browser loader didn't execute any of the code at all because this error happens
at link time, and before execution time. And this is what allows the polyfill to be able to reexecute the modules and their dependencies
without risk of duplicate execution.

The ES Module Shims polyfill will analyze the browser to see if it supports import maps. If it does, it doesn't do anything more,
otherwise it will analyze all module scripts on the page to see if any of them have bare specifier imports that will fail like this.
If one is found, it will then be reexecuted through ES Module Shims using its internal shimming of modules features.

When the polyfill kicks in another console log message is output(which can be disabled or customized via the [polyfill hook](#polyfill-hook)):

```
^^ Module TypeError above is polyfilled and can be ignored ^^
```

### Polyfill Edge Case: Dynamic Import

Only static link-time errors are polyfilled, not runtime errors.

Module feature errors that are not _static errors_ but rather _runtime errors_ will bypass the polyfill detection.

For example:

```html
<script type="module">
  import './supported-relative-import.js';
  console.log('Static Ok');
  import('unsupported-import-map').then(x => {
    console.log('Dynamic Ok');
  }, err => {
    console.log('Dynamic Fail');
  });
</script>
```

In the above, the native browser loader without import maps support will execute the above module, but fail the dynamic import.

See the log output in various scenarios:

* Native with Import Maps: `Static Ok`, `Dynamic Ok`
* Native without Import Maps: `Static Ok`, `Dynamic Fail`
* Native without Import Maps running ES Module Shims: `Static Ok`, `Dynamic Fail`

ES Module Shims **does not polyfill the dynamic import**. The reason for this is that if it did, it would need to reexecute the entire outer module resulting in `Static Ok`, `Dynamic Fail`, `Static Ok`, `Dynamic Ok`. This _double execution_ would be a change of the normal execution in running code twice that would not be deemed suitable for calling it a polyfill.

This is why it is advisable to always ensure modules use a bare specifier early to avoid non-execution.

If a static failure is not possible and dynamic import must be used, one alternative is to use the `importShim` ES Module Shims top-level loader:

```html
<script type="module">
  import './supported-relative-import.js';
  console.log('Static Ok');
  importShim('unsupported-import-map').then(x => {
    console.log('Ok');
  }, err => {
    console.log('Fail');
  });
</script>
```

`importShim` will automatically pass-through to the native dynamic import or polyfill as necessary, just like it does for script tags.

### Polyfill Edge Case: Instance Sharing

When running in polyfill mode, it can be thought of that are effectively two loaders running on the page - the ES Module Shims polyfill loader, and the native loader.

Note that instances are not shared between these loaders for consistency and performance, since some browsers do not properly share the fetch cache and native loader cache resulting in a double fetch which would be inefficient.

As a result, if you have two module graphs - one native and one polyfilled, they will not share the same dependency instance, for example:

```html
<script type="importmap">
{
  "imports": {
    "dep": "/dep.js"
  }
}
</script>
<script type="module">
import '/dep.js';
</script>
<script type="module">
import 'dep';
</script>
```

```dep
console.log('DEP');
```

When polyfilling import maps, ES Module Shims will pick up on the second import failure and reexecute `/dep.js` as a new instance, logging `"DEP"` twice.

For this reason it is important to always ensure all modules hit the polyfill path, either by having all graphs use import maps at the top-level, or via `importShim` directly.

If you really need to support instance sharing with the native loader, a useful workaround is to use the [`skip` option](#skip) to list modules which should always be loaded via the native loader:

```html
<script type="esms-options">
{
  "skip": ["/dep.js"]
}
</script>
```

The above would then fully cause dependency module instance to be shared between ES Module Shims and the native loader, with the polyfill then logging `"DEP"` only once.

#### No Shim Scripts

If the polyfill is analyzing or applying to a module script that doesn't need to or shouldn't be polyfilled, adding the `"noshim"` attribute to the script tag will ensure that ES Module Shims ignores processing this script entirely:

```html
<script type="module" noshim>
  // ...
</script>
```

### Polyfill Features

If using more modern features like CSS Modules or JSON Modules, these need to be manually enabled via the [`polyfillEnable` init option](#polyfill-enable-option) to raise the native baseline from just checking import maps to also checking that browsers support these features:

```html
<script>
window.esmsInitOptions = { polyfillEnable: ['css-modules', 'json-modules'] }
</script>
```

To verify when the polyfill is actively engaging as opposed to relying on the native loader, [a `polyfill` hook](#polyfill-hook) is also provided.

## Shim Mode

Shim mode is an alternative to polyfill mode and doesn't rely on native modules erroring - instead it is triggered by the existence of any `<script type="importmap-shim">` or `<script type="module-shim">`, or when explicitly setting the [`shimMode` init option](#shim-mode-option).

In shim mode, only the above `importmap-shim` and `module-shim` tags will be parsed and executed by ES Module Shims.

Shim mode also provides some additional features that aren't yet natively supported such as supporting multiple import maps, [external import maps](#external-import-maps) with a `"src"` attribute, [dynamically injecting import maps](#dynamic-import-maps), and [reading current import map state](#reading-current-import-map-state), which can be useful in certain applications.

## Benchmarks

ES Module Shims is designed for production performance. A [comprehensive benchmark suite](bench/README.md) tracks multiple loading scenarios for the project.

Benchmark summary:

* [ES Module Shims Chrome Passthrough](bench/README.md#chrome-passthrough-performance) (for [72% of users](https://caniuse.com/import-maps)) results in ~5ms extra initialization time over native for ES Module Shims fetching, execution and initialization, and on a slow connection the additional non-blocking bandwidth cost of its 10KB compressed download as expected.
* [ES Module Shims Polyfilling](bench/README.md#native-v-polyfill-performance) (for the remaining [28% of users](https://caniuse.com/import-maps)) is on average 1.4x - 1.5x slower than native module loading, and up to 1.8x slower on slow networks (most likely due to the browser preloader), both for cached and uncached loads, and this result scales linearly up to 10MB and 20k modules loaded executing on the fastest connection in just over 2 seconds in Firefox.
* [Very large import maps](bench/README.md#large-import-maps-performance) (100s of entries) cost only a few extra milliseconds upfront for the additional loading cost.

## Features

### Browser Support

Works in all browsers with [baseline ES module support](https://caniuse.com/#feat=es6-module).

Browser Compatibility on baseline ES modules support **with** ES Module Shims:

| ES Modules Features                             | Chrome (61+)                         | Firefox (60+)                        | Safari (10.1+)                       |
| ----------------------------------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| [modulepreload](#modulepreload)                 | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [Dynamic Import](#dynamic-import)               | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [import.meta.url](#importmetaurl)               | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [Import Maps](#import-maps)                     | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [JSON Modules](#json-modules)                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [CSS Modules](#css-modules)                     | :heavy_check_mark:<sup>1</sup>       | :heavy_check_mark:<sup>1</sup>       | :heavy_check_mark:<sup>1</sup>       |
| [import.meta.resolve](#resolve)                 | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [Module Workers](#module-workers) (via wrapper) | 63+                                  | :x:<sup>2</sup>                      | 15+                                  |
| Top-Level Await (unpolyfilled<sup>3</sup>)      | 89+                                  | 89+                                  | 15+                                  |

* 1: _CSS module support requires a separate [Constructable Stylesheets polyfill](https://github.com/calebdwilliams/construct-style-sheets#readme)._
* 2: _Module worker support cannot yet be implemented in Firefox due to no dynamic import support in web workers._
* 3: _Top-level await support is not currently polyfilled but is possible for ES Module Shims to implement for intermediate browser versions, with the feature request tracking in https://github.com/guybedford/es-module-shims/issues/5. The compatibility gap with native modules is currently < 5% of users so it may not even be necessary._

Browser compatibility **without** ES Module Shims:

| ES Modules Features                | Chrome             | Firefox            | Safari             |
| ---------------------------------- | ------------------ | ------------------ | ------------------ |
| [modulepreload](#modulepreload)    | 66+                | :x:                | :x:                |
| [Dynamic Import](#dynamic-import)  | 63+                | 67+                | 11.1+              |
| [import.meta.url](#importmetaurl)  | ~76+               | ~67+               | ~12+ ❕<sup>1</sup> |
| [Import Maps](#import-maps)        | 89+                | 108+               | :x:                |
| [JSON Modules](#json-modules)      | 91+                | :x:                | :x:                |
| [CSS Modules](#css-modules)        | 95+                | :x:                | :x:                |
| [import.meta.resolve](#resolve)    | :x:                | :x:                | :x:                |
| [Module Workers](#module-workers)  | ~68+               | :x:                | :x:                |
| Top-Level Await                    | 89+                | 89+                | 15+                |

* ❕<sup>1</sup>: On module redirects, Safari returns the request URL in `import.meta.url` instead of the response URL as per the spec.

### Import Maps

> Stability: WhatWG Standard, implemented in all browsers although only recently in Firefox and Safari

Import maps allow for importing _"bare specifiers"_ in JavaScript modules, which prior to import maps throw in all browsers with native modules support.

Using this polyfill we can write:

```html
<script type="importmap-shim">
{
  "imports": {
    "test": "/test.js"
  },
  "scopes": {
    "/": {
      "test-dep": "/test-dep.js"
    }
  }
}
</script>
<script type="module-shim">
  import test from "test";
  console.log(test);
</script>
```

All modules are still loaded with the native browser module loader, but with their specifiers rewritten then executed as Blob URLs, so there is a relatively minimal overhead to using a polyfill approach like this.

#### Multiple Import Maps

Multiple import maps are not currently supported in any native implementation, Chromium support is currently being tracked in https://bugs.chromium.org/p/chromium/issues/detail?id=927119.

In polyfill mode, multiple import maps are therefore not supported.

In shim mode, support for multiple `importmap-shim` scripts follows the [import map extensions](https://github.com/guybedford/import-maps-extensions) proposal.

#### External Import Maps

External import maps (using a `"src"` attribute) are not currently supported in any native implementation.

In polyfill mode, external import maps are therefore not supported.

In shim mode, external import maps are fully supported.

#### Dynamic Import Maps

Support for dynamically injecting import maps with JavaScript via eg:

```js
document.body.appendChild(Object.assign(document.createElement('script'), {
  type: 'importmap',
  innerHTML: JSON.stringify({ imports: { x: './y.js' } }),
}));
```

is supported in Chromium, provided it is injected before any module loads and there is no other import map yet loaded (multiple import maps are not supported).

Both modes in ES Module Shims support dynamic injection using DOM Mutation Observers.

While in polyfill mode the same restrictions apply that multiple import maps, import maps with a `src` attribute, and import maps loaded after the first module load are not supported, in shim mode all of these behaviours are fully enabled for `"importmap-shim"`.

#### Reading current import map state

To make it easy to keep track of import map state, es-module-shims provides a `importShim.getImportMap` utility function, available only in shim mode.

```js
const importMap = importShim.getImportMap();

// importMap will be an object in the same shape as the json in a importmap script
```

#### Setting current import map state
To make it easy to set the import map state, es-module-shims provides a `importShim.addImportMap` utility function, available only in shim mode.

```js
// importMap will be an object in the same shape as the json in a importmap script
const importMap = { imports: {/*...*/}, scopes: {/*...*/} };

importShim.addImportMap(importMap);
```


### Dynamic Import

> Stability: Stable browser standard

Dynamic `import(...)` within any modules loaded will be rewritten as `importShim(...)` automatically
providing full support for all es-module-shims features through dynamic import.

To load code dynamically (say from the browser console), `importShim` can be called similarly:

```js
importShim('/path/to/module.js').then(x => console.log(x));
```

### import.meta.url

> Stability: Stable browser standard

`import.meta.url` provides the full URL of the current module within the context of the module execution.

### modulepreload

> Stability: WhatWG Standard, Single Browser Implementer

Preloading of modules can be achieved by including a `<link rel="modulepreload" href="/module.js" />` tag in the HTML or injecting it dynamically.

This tag also supports the `"integrity"`, `"crossorigin"` and `"referrerpolicy"` attributes as supported on module scripts.

This tag just initiates a fetch request in the browser and thus works equally as a preload polyfill in both shimmed and unshimmed modes, with integrity validation support.

In browsers that don't support modulepreload, polyfilled preloading behaviour is provided using an early `fetch()` call with the same request options as the module script, resulting in network-level cache sharing.

Unlike the browser specification, the modulepreload polyfill does not request dependency modules by default, in order to avoid unnecessary
code analysis in the polyfill scenarios, _it is always recommended to preload deep imports so that this feature shouldn't be necessary._

#### Preload shim

When in shim mode, `<link rel="modulepreload-shim" href="/module.js" />` must be used to properly cache the preloaded modules.

### CSP Support

By default ES Module Shims provides full support for CSP by using the asm.js ES Module Lexer build. This is absolutely identical in performance to the Wasm version in Firefox and Chrome (in Safari the asm.js version is actually faster than Wasm).

The CSP nonce to use for module scripts will be picked up from the first script on the page or via the [`nonce` init option](#nonce).

A full example of such a CSP workflow is provided below:

```html
<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'nonce-n0nce'" />
<script async src="es-module-shims.js"></script>
<script type="importmap" nonce="n0nce">
{
  "pkg": "/pkg.js"
}
</script>
<script type="module" nonce="n0nce">
import pkg from 'pkg';
</script>
```

#### Wasm Build

To use the Web Assembly / non-CSP build of ES Module Shims, this is available as a self-contained single file at `es-module-shims/wasm` or `es-module-shims/dist/es-module-shims.wasm.js` in the package folder.

### JSON Modules

> Stability: WhatWG Standard, Single Browser Implementer

In shim mode, JSON modules are always supported. In polyfill mode, JSON modules require the `polyfillEnable: ['json-modules']` [init option](#polyfill-enable-option).

JSON Modules are currently supported in Chrome when using them via an import assertion:

```html
<script type="module">
import json from 'https://site.com/data.json' assert { type: 'json' };
</script>
```

In addition JSON modules need to be served with a valid JSON content type.

Checks for assertion failures are not currently included.

### CSS Modules

> Stability: WhatWG Standard, Single Browser Implementer

In shim mode, CSS modules are always supported. In polyfill mode, CSS modules require the `polyfillEnable: ['css-modules']` [init option](#polyfill-enable-option).

CSS Modules are currently supported in Chrome when using them via an import assertion:

```html
<script type="module">
import sheet from 'https://site.com/sheet.css' assert { type: 'css' };
</script>
```

To support the polyfill or shim of this feature, the [Constructable Stylesheets polyfill](https://github.com/calebdwilliams/construct-style-sheets#readme) must be separately included in browsers not supporting [Constructable Stylesheets](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/CSSStyleSheet) eg via:

```html
<script async src="https://unpkg.com/construct-style-sheets-polyfill@3.1.0/dist/adoptedStyleSheets.js"></script>
```

For more information see the [web.dev article](https://web.dev/css-module-scripts/).

In addition CSS modules need to be served with a valid CSS content type.

Checks for assertion failures are not currently included.

### Resolve

> Stability: Draft HTML PR

`import.meta.resolve` provides a contextual resolver within modules. It is synchronous, changed from being formerly asynchronous due to following the [browser specification PR](https://github.com/whatwg/html/pull/5572).

The second argument to `import.meta.resolve` permits a custom parent URL scope for the resolution (not currently in the browser spec), which defaults to `import.meta.url`.

```js
// resolve a relative path to a module
var resolvedUrl = import.meta.resolve('./relative.js');
// resolve a dependency from a module
var resolvedUrl = import.meta.resolve('dep');
// resolve a path
var resolvedUrlPath = import.meta.resolve('dep/');
// resolve with a custom parent scope
var resolvedUrl = import.meta.resolve('dep', 'https://site.com/another/scope');
```

Node.js also implements a similar API, although it's in the process of shifting to a synchronous resolver.

### Module Workers

ES Module Shims can be used in module workers in browsers that provide dynamic import in worker environments, which at the moment are Chrome(80+), Edge(80+) and Safari(15+).

By default, when there is no DOM present, ES Module Shims will switch into shim mode. An example of ES Module Shims usage through shim mode in web workers is provided below:

```js
/**
 * 
 * @param {string} aURL a string representing the URL of the module script the worker will execute.
 * @returns {string} The string representing the URL of the script the worker will execute.
 */
function getWorkerScriptURL(aURL) {
  // baseURL, esModuleShimsURL are considered to be known in advance
  // esModuleShimsURL - must point to the non-CSP build of ES Module Shims, 
  // namely the `es-module-shim.wasm.js` output: es-module-shims/dist/es-module-shims.wasm.js

  return URL.createObjectURL(new Blob(
    [
      `importScripts('${new URL(esModuleShimsURL, baseURL).href}');
      importShim.addImportMap(${JSON.stringify(importShim.getImportMap())});
      importShim('${new URL(aURL, baseURL).href}').catch(e => setTimeout(() => { throw e; }))`
    ],
    { type: 'application/javascript' }))
}

const worker = new Worker(getWorkerScriptURL('myEsModule.js'));
```

> Web workers must use the non-CSP build of ES Module Shims via `es-module-shim.wasm.js` from the `dist/` folder, since the CSP build currently assumes a DOM.

## Init Options

Provide a `esmsInitOptions` on the global scope before `es-module-shims` is loaded to configure various aspects of the module loading process:

* [enforceIntegrity](#enforce-integrity)
* [fetch](#fetch-hook)
* [mapOverrides](#overriding-import-map-entries)
* [modulepreload](#modulepreload)
* [noLoadEventRetriggers](#no-load-event-retriggers)
* [nonce](#nonce)
* [onerror](#error-hook)
* [onpolyfill](#polyfill-hook)
* [polyfillEnable](#polyfill-enable-option)
* [resolve](#resolve-hook)
* [revokeBlobURLs](#revoke-blob-urls)
* [shimMode](#shim-mode-option)
* [skip](#skip)

```html
<script>
window.esmsInitOptions = {
  // Enable Shim Mode
  shimMode: true, // default false
  // Enable newer modules features
  polyfillEnable: ['css-modules', 'json-modules'], // default empty
  // Custom CSP nonce
  nonce: 'n0nce', // default is automatic detection
  // Don't retrigger load events on module scripts
  noLoadEventRetriggers: true, // default false
  // Skip source analysis of certain URLs for full native passthrough
  skip: /^https:\/\/cdn\.com/, // defaults to null
  // Clean up blob URLs after execution
  revokeBlobURLs: true, // default false
  // Secure mode to not support loading modules without integrity
  // (integrity is always verified even when disabled though)
  enforceIntegrity: true, // default false
  // Permit overrides to import maps
  mapOverrides: true, // default false

  // -- Hooks --
  // Module load error
  onerror: (e) => { /*...*/ }, // default noop
  // Called when polyfill mode first engages
  onpolyfill: () => {}, // default logs to the console
  // Hook all module resolutions
  resolve: (id, parentUrl, resolve) => resolve(id, parentUrl), // default is spec resolution
  // Hook source fetch function
  fetch: (url, options) => fetch(url, options), // default is native
  // Hook import.meta construction
  meta: (meta, url) => void // default is noop
  // Hook top-level imports
  onimport: (url, options, parentUrl) => void // default is noop
}
</script>
<script async src="es-module-shims.js"></script>
```

`<script type="esms-options">` can also be used:

```html
<script type="esms-options">
{
  "shimMode": true,
  "polyfillEnable": ["css-modules", "json-modules"],
  "nonce": "n0nce",
  "onpolyfill": "polyfill"
}
</script>
```

This can be convenient when using a CSP policy. Function strings correspond to global function names.

### Shim Mode Option

[Shim Mode](#shim-mode) can be overridden using the `shimMode` option:

```html
<script type="esms-options">
{
  "shimMode": true
}
</script>
```

For example, if lazy loading `<script type="module-shim">` scripts alongside static native module scripts, shim mode would not be enabled at initialization time.

DOM `load` events are fired for all `"module-shim"` scripts both for success and failure just like for native module scripts.

### Pollyfill Enable Option

The `polyfillEnable` option allows enabling polyfill features which are newer and would otherwise result in unnecessary polyfilling in modern browsers that haven't yet updated.

Currently this option supports just `"css-modules"` and `"json-modules"`.

```html
<script type="esms-options">
{
  "polyfillEnable": ["css-modules", "json-modules"]
}
</script>
```

The above is necessary to enable CSS modules and JSON modules.

#### Baseline Support Analysis Opt-Out

The reason the `polyfillEnable` option is needed is because ES Module Shims implements a performance optimization where if a browser supports modern modules features to an expected baseline of import maps support, it will skip all polyfill source analysis resulting in full native passthrough performance.

If the application code then tries to use modern features like CSS modules beyond this baseline it won't support those features. As a result all modules features which are considered newer or beyond the recommended baseline require explicit enabling. This common baseline itself will change to track the common future modules baseline supported by this project for each release cycle.

This option can also be set to `true` to entirely disable the native passthrough system and ensure all sources are fetched and analyzed through ES Module Shims. This will still avoid duplicate execution since module graphs are still only reexecuted when they use unsupported native features, but there is a small extra cost in doing the analysis.

### Enforce Integrity

When enabled, `enforceIntegrity` will ensure that all modules loaded through ES Module Shims must have integrity defined either on a `<link rel="modulepreload" integrity="...">` or on
a `<link rel="modulepreload-shim" integrity="...">` preload tag in shim mode. Modules without integrity will throw at fetch time.

For example in the following, only the listed `app.js` and `dep.js` modules will be able to execute with the provided integrity:

```html
<script type="esms-options">{ "enforceIntegrity": true }</script>
<link rel="modulepreload-shim" href="/app.js" integrity="sha384-..." />\
<link rel="modulepreload-shim" href="/dep.js" integrity="sha384-..." />
<script type="module-shim">
  import '/app.js';
</script>
```

Strong execution guarantees are only possible in shim mode since in polyfill mode it is not possible to stop the native loader from executing code without an integrity.

Future versions of this option may provide support for origin-specific allow lists.

### Nonce

The `nonce` option allows setting a CSP nonce to be used with all script injections for full CSP compatibility supported by the [CSP build](#csp-build) of ES Module Shims.

Alternatively, add a `blob:` URL policy with the CSP build to get CSP compatibility.

```js
<script type="esms-options">
{
  "nonce": "n0nce"
}
</script>
```

### No Load Event Retriggers

Because of the extra processing done by ES Module Shims it is possible for static module scripts to execute after the `DOMContentLoaded` or `readystatechange` events they expect, which can cause missed attachment.

In order to ensure libraries that rely on these event still behave correctly, ES Module Shims will always double trigger these events that would normally have executed before the document ready state transition to completion, once all the static module scripts in the page have been completely executed through ES module shims.

In such a case, this double event firing can be disabled with the `noLoadEventRetriggers` option:

```js
<script type="esms-options">
{
  // do not re-trigger DOM events (onreadystatechange, DOMContentLoaded)
  "noLoadEventRetriggers": true
}
</script>
<script async src="es-module-shims.js"></script>
```

### Skip

When loading modules that you know will only use baseline modules features, it is possible to set a rule to explicitly opt-out modules from being polyfilled to always load and be referenced through the native loader only. This enables instance sharing with the native loader and also improves performance because those modules then do not need to be processed or transformed at all, so that only local application code is handled and not library code.

The `skip` option supports a string regular expression or array of exact module URLs to check:

```js
<script type="esms-options">
{
  "skip": "^https?:\/\/(cdn\.skypack\.dev|jspm\.dev)\/"
}
</script>
<script async src="es-module-shims.js"></script>
```

When passing an array, relative URLs or paths ending in `/` can be provided:

```js
<script type="esms-options">
{
  "skip": ["./app.js", "https://jspm.dev/"]
}
</script>
<script async src="es-module-shims.js"></script>
```

### Revoke Blob URLs

When polyfilling the missing features `es-module-shims` would create in-memory blobs using `URL.createObjectURL()` for each processed module.
In most cases, memory footprint of these blobs is negligible so there is no need to call `URL.revokeObjectURL()`
for them, and we don't do that by default.

That said, in some scenarios, e.g. when evaluating some continuously changing modules without a page reload, like in a web-based code editor,
you might want to reduce the growth of memory usage by revoking those blob URLs after they were already `import`ed.

You can do that by enabling the `revokeBlobURLs` init option:

```js
<script type="esms-options">
{
  "revokeBlobURLs": true
}
</script>
<script type="module" src="es-module-shims.js"></script>
```

NOTE: revoking object URLs is not entirely free, while we are trying to be smart about it and make sure it doesn't
cause janks, we recommend enabling this option only if you have done the measurements and identified that you really need it.

### Overriding import map entries

When [dynamically injecting import maps](#dynamic-import-maps), an error will be thrown in both polyfill and shim modes if the new import map would override existing entries with a different value.

It is possible to disable this behavior in shim mode by setting the `mapOverrides` option:

```js
<script type="esms-options">
{
  "shimMode": true,
  "mapOverrides": true
}
</script>
<script type="importmap-shim">
{
  "imports": {
    "x": "/x.js"
  }
}
</script>
<script>
// No error will be thrown here
document.body.appendChild(Object.assign(document.createElement('script'), {
  type: 'importmap',
  innerHTML: JSON.stringify({ imports: { x: './y.js' } }),
}));
</script>
```

This can be useful for HMR workflows.

### Hooks

#### Polyfill hook

The polyfill hook is called when running in polyfill mode and the polyfill is kicking in instead of passing through to the native loader.

This can be a useful way to verify that the native passthrough is working correctly in latest browsers for performance, while also allowing eg the ability to analyze or get metrics reports of how many users are getting the polyfill actively applying to their browser application loads.

```js
<script>
window.polyfilling = () => console.log('The polyfill is actively applying');
</script>
<script type="esms-options">
{
  "onpolyfill": "polyfilling"
}
</script>
```

The default hook will log a message to the console with `console.info` noting that polyfill mode is enabled and that the native error can be ignored.

Overriding this hook with an empty function will disable the default polyfill log output.

In the above, running in latest Chromium browsers, nothing will be logged, while running in an older browser that does not support newer features like import maps the console log will be output.

#### Error hook

You can provide a function to handle errors during the module loading process by providing an `onerror` option:

```js
<script>
  window.esmsInitOptions = {
    onerror: error => console.log(error) // defaults to `((e) => { throw e; })`
  }
</script>
<script async src="es-module-shims.js"></script>
```

#### Import Hook

The import hook is supported for both shim and polyfill modes and provides an async hook which can ensure any necessary work is done before a top-level module import or dynamic `import()` starts further processing.

```js
<script>
  window.esmsInitOptions = {
    onimport: function (url, options, parentUrl) {
      console.log(`Top-level import for ${url}`);
    }
  }
</script>
```

#### Resolve Hook

The resolve hook is supported for both shim and polyfill modes and allows full customization of the resolver, while still having access to the original resolve function.

Note that in polyfill mode the resolve hook may not be called for all modules when native passthrough is occurring and that it still will not affect
the native passthrough executions.

If the resolve hook should apply for all modules in the entire module graph, make sure to set `polyfillEnable: true` to [disable the baseline support analysis opt-out](#baseline-support-analysis-opt-out).

```js
<script>
  window.esmsInitOptions = {
    shimMode: true,
    resolve: function (id, parentUrl, defaultResolve) {
      if (id === 'custom' && parentUrl.startsWith('https://custom.com/'))
        return 'https://custom.com/custom.js';

      // Default resolve will handle the typical URL and import map resolution
      return defaultResolve(id, parentUrl);
    }
  }
</script>
```

Support for an asynchronous resolve hook has been deprecated as of 1.5.0 and will be removed in the next major.

Instead async work should be done with the import hook.

#### Meta Hook

The meta hook allows customizing the `import.meta` object in each module scope.

The function takes as arguments the `import.meta` object itself (with `import.meta.url` an `import.meta.resolve` already present), and the URL of the module as its second argument.

Example:

```js
<script>
  window.esmsInitOptions = {
    shimMode: true,
    meta: function (metaObj, url) {
      metaObj.custom = `custom value for ${url}`;
    }
  }
</script>
```

Where within the module the following would be supported:

```js
import assert from 'assert';
assert.ok(import.meta.custom.startsWith('custom value'));
```

#### Fetch Hook

The fetch hook is supported for shim mode only.

The ES Module Shims fetch hook can be used to implement transform plugins.

For example TypeScript support:

```js
<script>
  window.esmsInitOptions = {
    shimMode: true,
    fetch: async function (url, options) {
      const res = await fetch(url, options);
      if (!res.ok)
        return res;
      if (res.url.endsWith('.ts')) {
        const source = await res.body();
        const transformed = tsCompile(source);
        return new Response(new Blob([transformed], { type: 'application/javascript' }));
      }
      return res;
    } // defaults to `((url, options) => fetch(url, options))`
  }
</script>
<script async src="es-module-shims.js"></script>
```

Because the dependency analysis applies by ES Module Shims takes care of ensuring all dependencies run through the same fetch hook,
the above is all that is needed to implement custom plugins.

Streaming support is also provided, for example here is a hook with streaming support for JSON:

```js
window.esmsInitOptions = {
  shimMode: true,
  fetch: async function (url, options) {
    const res = await fetch(url, options);
    if (!res.ok || !/^application\/json($|;)/.test(res.headers.get('content-type')))
      return res;
    const reader = res.body.getReader();
    const headers = new Headers(res.headers);
    headers.set('Content-Type', 'application/javascript');
    return new Response(new ReadableStream({
      async start (controller) {
        let done, value;
        controller.enqueue(new TextEncoder().encode('export default '));
        while (({ done, value } = await reader.read()) && !done) {
          controller.enqueue(value);
        }
        controller.close();
      }
    }), { headers });
  }
}
```

## Implementation Details

### Import Rewriting

* Sources are fetched, import specifiers are rewritten to reference exact URLs, and then executed as BlobURLs through the whole module graph.
* The [lexer](https://github.com/guybedford/es-module-lexer) handles the full language grammar including nested template strings, comments, regexes and division operator ambiguity based on backtracking.
* When executing a circular reference A -> B -> A, a shell module technique is used to acyclify into the graph A -> B -> A Shell, with A -> A Shell. The shell module exports an update function which is called by the original once after the last import statement, and again after the last statement of the source file.

## Inspiration

Huge thanks to Rich Harris for inspiring this approach with [Shimport](https://github.com/rich-harris/shimport).

## License

MIT
