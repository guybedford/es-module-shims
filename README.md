# ES Module Shims

[Release Notes](CHANGELOG.md)

[93% of users](https://caniuse.com/#feat=es6-module) are now running browsers with baseline support for ES modules. At the same time Chromium ships modern native module features and import maps support to [67% of users](https://caniuse.com/import-maps).

_It turns out that we can actually polyfill import maps and other new modules features on top of these baseline implementations in a performant 12KB shim._

This includes support for:

* [Import Maps](#import-maps) support.
* Dynamic `import()` shimming when necessary in eg older Firefox versions.
* `import.meta` and `import.meta.url`.
* [JSON](#json-modules) and [CSS modules](#css-modules) with import assertions.
* [`<link rel="modulepreload">` polyfill](#modulepreload) in non Chromium browsers for both shimmed and unshimmed preloading scenarios.
* Comprehensive [CSP support](#csp-support) using nonces, no `unsafe-eval` or `blob:` policy being necessary.

In addition custom [resolve](#resolve-hook) and [fetch](#fetch-hook) hooks can be implemented allowing for streaming in-browser transform workflows to support custom module types.

Because we are still using the native module loader the edge cases work out comprehensively, including:

* Live bindings in ES modules
* Dynamic import expressions (`import('src/' + varname')`)
* Circular references, with the execption that live bindings are disabled for the first unexecuted circular parent.

Due to the use of a tiny [JS tokenizer for ES module syntax only](https://github.com/guybedford/es-module-lexer), with very simple rewriting rules, transformation is very fast.

## Usage

Include ES Module Shims with a `async` attribute on the script:

For example, from CDN:

```html
<!-- UNPKG -->
<script async src="https://unpkg.com/es-module-shims@1.3.0/dist/es-module-shims.js"></script>

<!-- JSPM.IO -->
<script async src="https://ga.jspm.io/npm:es-module-shims@1.3.0/dist/es-module-shims.js"></script>
```

Then there are two ways to use ES Module Shims: Polyfill Mode and [Shim Mode](#shim-mode).

### Benchmarks

ES Module Shims is designed for production performance. A [comprehensive benchmark suite](bench/README.md) tracks multiple loading scenarios for the project.

Benchmark summary:

* [ES Module Shims Chrome Passthrough](bench/README.md#chrome-passthrough-performance) (for [70% of users](https://caniuse.com/import-maps)) results in ~5ms extra initialization time over native for ES Module Shims fetching, execution and initialization, and on a slow connection the additional non-blocking bandwidth cost of its 10KB compressed download as expected.
* [ES Module Shims Polyfilling](bench/README.md#native-v-polyfill-performance) (for the remaining [30% of users](https://caniuse.com/import-maps)) is on average 1.4x - 1.5x slower than native module loading, and up to 1.8x slower on slow networks (most likely due to the browser preloader), both for cached and uncached loads, and this result scales linearly up to 10MB and 20k modules loaded executing on the fastest connection in just over 2 seconds in Firefox.
* [Very large import maps](bench/README.md#large-import-maps-performance) (100s of entries) cost only a few extra milliseconds upfront for the additional loading cost.

### Polyfill Mode

Write your HTML modules like you would in the latest Chrome:

```html
<script type="importmap">
{
  "imports": {
    "app": "./src/app.js"
  }
}
</script>
<script type="module">import 'app'</script>
```

and ES Module Shims will make it work in [all browsers with any ES Module Support](#browser-support).

> `<script type="importmap">` should always be placed before any `<script type="module">` as per native support in browsers.

You will see a console error in browsers without import maps support like:

```
Uncaught TypeError: Failed to resolve module specifier "app". Relative references must start with either "/", "./", or "../".
  at <anonymous>:1:15
```

This execution failure is a feature - it avoids the polyfill causing double execution. The first import being a bare specifier in the pattern above is important to ensure this.

This is because the polyfill cannot disable the native loader - instead it will only execute modules that would otherwise fail resolving or parsing to avoid duplicate fetches or executions that would cause performance and reliability issues.

If using CSS modules or JSON modules, since these features are relatively new, they require manually enabling using the initialization option:

```html
<script>
window.esmsInitOptions = { enable: ['css-modules', 'json-modules'] }
</script>
```

To verify when the polyfill is actively engaging as opposed to relying on the native loader, [a `polyfill` hook](#polyfill-hook) is provided.

See the [Polyfill Mode Details](#polyfill-mode-details) section for more information about how the polyfill works and what options are available.

### Shim Mode

Shim mode is an alternative to polyfill mode and doesn't rely on native modules erroring - instead it is triggered by the existence of any `<script type="importmap-shim">` or `<script type="module-shim">`, or when explicitly setting the [`shimMode` init option](#shim-mode-option).

In shim mode, normal module scripts and import maps are entirely ignored and only the above shim tags will be parsed and executed by ES Module Shims instead.

Shim mode also provides some additional features that aren't yet natively supported such as supporting multiple import maps, [external import maps](#external-import-maps) with a `"src"` attribute, [dynamically injecting import maps](#dynamic-import-maps), and [reading current import map state](#reading-current-import-map-state), which can be useful in certain applications.

## Features

### Browser Support

Works in all browsers with [baseline ES module support](https://caniuse.com/#feat=es6-module).

#### Browser Compatibility with ES Module Shims:

| ES Modules Features                | Chrome (61+)                         | Firefox (60+)                        | Safari (10.1+)                       | Edge (17+)                           |
| ---------------------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| Executes Modules in Correct Order  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:<sup>1</sup>       |
| [Dynamic Import](#dynamic-import)  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [import.meta.url](#importmetaurl)  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [Module Workers](#module-workers)  | :heavy_check_mark: ~68+              | :x:<sup>2</sup>                      | :x:<sup>2</sup>                      | :x:<sup>2</sup>                      |
| [modulepreload](#modulepreload)    | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [Import Maps](#import-maps)        | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [JSON Modules](#json-modules)      | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [CSS Modules](#css-modules)        | :heavy_check_mark:<sup>3</sup>       | :heavy_check_mark:<sup>3</sup>       | :heavy_check_mark:<sup>3</sup>       | :heavy_check_mark:<sup>3</sup>       |
| [import.meta.resolve](#resolve)    | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [Top-Level Await](#tla)            | :heavy_check_mark: 89+               | :heavy_check_mark: 89+               | :x:<sup>4</sup>                      | :x:<sup>4</sup>                       |

* 1: _The Edge parallel execution ordering bug is corrected by ES Module Shims with an execution chain inlining approach._
* 2: _Module worker support cannot be implemented without dynamic import support in web workers._
* 3: _CSS module support requires a separate [Constructable Stylesheets polyfill](https://github.com/calebdwilliams/construct-style-sheets#readme)._
* 4: _Top-level await support is possible for ES Module Shims to implement, with the feature request tracking in https://github.com/guybedford/es-module-shims/issues/5._

#### Current browser compatibility of modules features without ES module shims:

| ES Modules Features                | Chrome (61+)                         | Firefox (60+)                        | Safari (10.1+)                       | Edge (17+)                           |
| ---------------------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| Executes Modules in Correct Order  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :x:<sup>1</sup>                      |
| [Dynamic Import](#dynamic-import)  | :heavy_check_mark: 63+               | :heavy_check_mark: 67+               | :heavy_check_mark: 11.1+             | :x:                                  |
| [import.meta.url](#importmetaurl)  | :heavy_check_mark: ~76+              | :heavy_check_mark: ~67+              | :heavy_check_mark: ~12+ ❕<sup>1</sup>| :x:                                  |
| [Module Workers](#module-workers)  | :heavy_check_mark: ~68+              | :x:                                  | :x:                                  | :x:                                  |
| [modulepreload](#modulepreload)    | :heavy_check_mark: 66+               | :x:                                  | :x:                                  | :x:                                  |
| [Import Maps](#import-maps)        | :heavy_check_mark: 89+               | :x:                                  | :x:                                  | :x:                                  |
| [JSON Modules](#json-modules)      | :heavy_check_mark: 91+               | :x:                                  | :x:                                  | :x:                                  |
| [CSS Modules](#css-modules)        | :heavy_check_mark: 95+               | :x:                                  | :x:                                  | :x:                                  |
| [import.meta.resolve](#resolve)    | :x:                                  | :x:                                  | :x:                                  | :x:                                  |
| [Top-Level Await](#tla)            | :heavy_check_mark: 89+               | :heavy_check_mark: 89+               | :x:                                  | :x:                                  |

* 1: _Edge executes parallel dependencies in non-deterministic order. ([ChakraCore bug](https://github.com/microsoft/ChakraCore/issues/6261))._
* ~: _Indicates the exact first version support has not yet been determined (PR's welcome!)._
* ❕<sup>1</sup>: On module redirects, Safari returns the request URL in `import.meta.url` instead of the response URL as per the spec.

### Import Maps

> Stability: WhatWG Standard, Single Browser Implementer

Import maps allow for importing "bare specifiers" in JavaScript modules, which prior to import maps throw in all browsers with native modules support.

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
const importMap = importShim.getImportMap()

// importMap will be an object in the same shape as the json in a importmap script
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

Unlike the browser specification, the modulepreload polyfill does not request dependency modules by default, in order to avoid unnecessary
code analysis in the polyfill scenarios. **It is recommended to preload deep imports anyway so that this feature shouldn't be necessary.**

### CSP Support

By default ES Module Shims provides full support for CSP by using the asm.js ES Module Lexer build. This is absolutely identical in performance to the Wasm version in Firefox and Chrome, while in Safari the asm.js version is actually faster than Wasm making this build preferable.

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
<script async src="https://unpkg.com/construct-style-sheets-polyfill@3.0.0/dist/adoptedStyleSheets.js"></script>
```

For more information see the [web.dev article](https://web.dev/css-module-scripts/).

In addition CSS modules need to be served with a valid CSS content type.

Checks for assertion failures are not currently included.

### Resolve

> Stability: No current browser standard

`import.meta.resolve` provides a contextual resolver within modules. It is asynchronous, like the Node.js implementation, to support waiting on any in-flight
import map loads when import maps are [loaded dynamically](#dynamic-import-map-updates).

The second argument to `import.meta.resolve` permits a custom parent URL scope for the resolution, which defaults to `import.meta.url`.

```js
// resolve a relative path to a module
var resolvedUrl = await import.meta.resolve('./relative.js');
// resolve a dependency from a module
var resolvedUrl = await import.meta.resolve('dep');
// resolve a path
var resolvedUrlPath = await import.meta.resolve('dep/');
// resolve with a custom parent scope
var resolvedUrl = await import.meta.resolve('dep', 'https://site.com/another/scope');
```

This implementation is as provided experimentally in Node.js - https://nodejs.org/dist/latest-v14.x/docs/api/esm.html#esm_no_require_resolve.

## Polyfill Mode Details

In polyfill mode, feature detections are performed for ES modules features. In browsers with full feature support no further processing is done.

In browsers with variable feature support, sources are analyzed with module specifiers rewritten using the very fast Wasm / asm.js lexer while sharing the source network fetch cache with the native loader.

#### Polyfill Features

The current default native baseline for the ES module shims polyfill mode is browsers supporting import maps.

If using more modern features like CSS Modules or JSON Modules, these need to be manually enabled via the [`polyfillEnable` init option](#polyfill-enable-option) to raise the native baseline to only browsers supporting these features.

#### Polyfill Edge Case: Dynamic Import

The guarantee of the polyfill is that any module graph that would have failed will be reexecuted through the shim layer. This leaves any edge case where execution succeeds but not as expected. For example when using dynamic imports:

```html
<script type="module">
  console.log('Executing');
  const dynamic = 'bare-specifier';
  import(dynamic).then(x => {
    console.log('Ok');
  }, err => {
    console.log('Fail');
  });
</script>
```

The native browser loader without import maps support will execute the above module fine, but fail on the lazy dynamic import.

ES Module Shims will not reexecute the above in browsers without import maps support though because it will see that the execution did complete successfully therefore it will not attempt reexecution and as a result, `"Ok"` is never logged.

Other examples include dynamically injecting import maps, or using import maps with a `"src"` attribute, which aren't supported in native Chrome.

This is why it is advisable to always ensure modules use syntax that will fail early to avoid non-execution.

#### Polyfill Edge Case: Instance Sharing

When running in polyfill mode, it can be thought of that are effectively two loaders running on the page - the ES Module Shims polyfill loader, and the native loader.

Note that instances are not shared between these loaders for consistency and performance.

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

In the above, on browsers without import maps support, the `/dep.js` instance will be loaded natively by the first module, then the second import will fail.

ES Module Shims will pick up on the second import and reexecute `/dep.js`. As a result, `/dep.js` will be executed twice on the page.

For this reason it is important to always ensure all modules hit the polyfill path, either by having all graphs use import maps at the top-level, or via `importShim` directly.

#### Skip Polyfill

Adding the `"noshim"` attribute to the script tag will also ensure that ES Module Shims skips processing this script entirely:

```html
<script type="module" noshim>
  // ...
</script>
```

## Init Options

Provide a `esmsInitOptions` on the global scope before `es-module-shims` is loaded to configure various aspects of the module loading process:

```html
<script>
window.esmsInitOptions = {
  shimMode: true, // default false
  polyfillEnable: ['css-modules', 'json-modules'], // default empty
  nonce: 'n0nce', // default null
  noLoadEventRetriggers: true, // default false
  skip: /^https:\/\/cdn\.com/, // defaults to null
  onerror: (e) => { /*...*/ }, // default noop
  onpolyfill: () => {},
  resolve: (id, parentUrl, resolve) => resolve(id, parentUrl), // default is spec resolution
  fetch: (url, options) => fetch(url, options), // default is native
  revokeBlobURLs: true, // default false
}
</script>
<script async src="es-module-shims.js"></script>
```

If only setting JSON-compatible options, the `<script type="esms-options">` can be used instead:

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

This can be convenient when using a CSP policy.

Function strings correspond to global function names.

See below for a detailed description of each of these options.

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

### Skip Processing

When loading modules that you know will only use baseline modules features, it is possible to set a rule to explicitly opt-out modules from rewriting. This improves performance because those modules then do not need to be processed or transformed at all, so that only local application code is handled and not library code.

This can be configured by providing a URL regular expression for the `skip` option:

```js
<script type="esms-options">
{
  "skip": "/^https?:\/\/(cdn\.skypack\.dev|jspm\.dev)\//`
}
</script>
<script async src="es-module-shims.js"></script>
```

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

In the above, running in latest Chromium browsers, nothing will be logged, while running in an older browser that does not support newer features
like import maps the console log will be output.

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

#### Resolve Hook

The resolve hook is supported for shim mode only and allows full customization of the resolver, while still having access to the original resolve function.

```js
<script>
  window.esmsInitOptions = {
    shimMode: true,
    resolve: async function (id, parentUrl, defaultResolve) {
      if (id === 'custom' && parentUrl.startsWith('https://custom.com/'))
        return 'https://custom.com/custom.js';

      // Default resolve will handle the typical URL and import map resolution
      return defaultResolve(id, parentUrl);
    }
  }
</script>
```

### Fetch Hook

The fetch hook is supported for shim mode only.

The ES Module Shims fetch hook can be used to implement transform plugins.

For example:

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
        controller.enqueue(new TextEncoder.encode('export default '));
        while (({ done, value } = await reader.read()) && !done) {
          controller.enqueue(value);
        }
        controller.close();
      }
    }), { headers });
  }
}
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

## Implementation Details

### Import Rewriting

* Sources are fetched, import specifiers are rewritten to reference exact URLs, and then executed as BlobURLs through the whole module graph.
* The [lexer](https://github.com/guybedford/es-module-lexer) handles the full language grammar including nested template strings, comments, regexes and division operator ambiguity based on backtracking.
* When executing a circular reference A -> B -> A, a shell module technique is used to "shim" the circular reference into an acyclic graph. As a result, live bindings for the circular parent A are not supported, and instead the bindings are captured immediately after the execution of A.

## Inspiration

Huge thanks to Rich Harris for inspiring this approach with [Shimport](https://github.com/rich-harris/shimport).

## License

MIT
