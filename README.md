# ES Module Shims

Polyfills import maps and other ES Modules features on top of the baseline native ESM support in browsers.

With import maps now supported by all major browsers, ES Module Shims entirely bypasses processing for the [94% of users](https://caniuse.com/import-maps) with native import maps support.

For the remaining ~4% of users, the highly performant (see [benchmarks](#benchmarks)) production and [CSP-compatible](#csp-support) shim kicks in to rewrite module specifiers driven by the [Web Assembly ES Module Lexer](https://github.com/guybedford/es-module-lexer).

The following modules features are polyfilled:

* [Import Maps](#import-maps) polyfill.
* [JSON](#json-modules) and [CSS modules](#css-modules) with import assertions when enabled.
* [Wasm modules](#wasm-modules) with support for Source Phase Imports when enabled.
* [TypeScript](#typescript-type-stripping) type stripping when enabled.

When running in shim mode, module rewriting is applied for all users and custom [resolve](#resolve-hook) and [fetch](#fetch-hook) hooks can be implemented allowing for custom resolution and streaming in-browser transform workflows.

Because we are still using the native module loader the edge cases work out comprehensively, including:

* Live bindings in ES modules
* Dynamic import expressions (`import('src/' + varname')`)
* Circular references, with the execption that live bindings are disabled for the first unexecuted circular parent.

> [Built with](https://github.com/guybedford/es-module-shims/blob/main/chompfile.toml) [Chomp](https://chompbuild.com/)

## Usage

Include ES Module Shims with a `async` attribute on the script, then include an import map and module scripts normally:

```html
<script async src="https://ga.jspm.io/npm:es-module-shims@2.0.10/dist/es-module-shims.js"></script>

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

The ES Module Shims polyfill will analyze the browser to check its fine-grained support for various import maps and modules features.
If it is deeemed to support a baseline set of features, and multiple import maps are not in use, the polyfill will do no further work. Otherwise, it
will analyze all module scripts on the page to see if any of them have static module syntax that would fail. If found, that graph will then be reexecuted through ES Module Shims using its internal rewriting of import statements to polyfill features.

When the polyfill kicks in another console log message is output(which can be disabled or customized via the [polyfill hook](#polyfill-hook)):

```
^^ Module error above is polyfilled and can be ignored ^^
```

The fetch options used by the polyfill are carefully followed per the spec. In older Firefox and Safari this fetch network cache is
not fully shared with the polyfill so separate entries can be seen in the network tab, network-level cache coalescing is still seen at the very least.

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

Whenever possible, the polyfill loader will share native modules that can be correctly executed, with one exception per the previous section - modules which use dynamic import, which are imported as dependencies of modules which require polyfill features.

For example consider two shimmed modules, both of which use import maps:

`shim-a.js`
```js
import 'mapped-dep-a';
```

`shim-b.js`
```js
import 'mapped-dep-b';
```

where `mapped-dep-a` resolves to `/dep-a.js` and `mapped-dep-b` resolves to `/dep-b.js`, respectively containing:

`/dep-a.js`
```js
console.log('dep a');
```

`/dep-b.js`
```js
console.log('dep b');
import(expr);
```

While the shim modules are always loaded in the shim loader, the `dep-a.js` module is loaded from the native loader since it does not require any polyfilling.

On th other hand, `dep-b.js` is loaded from the shim loader as well _because it was loaded by a polyfilled parent graph and uses dynamic import_. Within the polyfill loader, the `import(expr)` is replaced with `importShim(expr)` to support import maps. This is in contrast to top-level native graphs which do not get shimmed per the previous section.

As a result, `import('/dep-a.js')` in the native loader is the same instance as the `dep-a.js` loaded by `shim-a.js`, but `dep-b` would be executed twice if passed into `import('/dep-b.js')` - the shim loader and native loader instances are separate, and `dep b` would be logged twice.

Note that this is the ONLY scenario in which instance sharing will not otherwise occur in the polyfill loader.

A workaround to this instance sharing case is to use the [`skip` option](#skip) to list modules which should always be loaded via the native loader (which also saves on analysis work time for performance):

```html
<script type="esms-options">
{
  "skip": ["/dep-b.js"]
}
</script>
```

The above would then fully cause dependency module instance of dep-b to be shared between ES Module Shims and the native loader, with the polyfill then logging `"dep b"` only once.

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
window.esmsInitOptions = { polyfillEnable: ['css-modules', 'json-modules', 'wasm-modules', 'typescript'] }
</script>
```

The above polyfill options correspond to `polyfillEnable: 'all'`.

Alternatively options can be set via the `esms-options` script type:

```html
<script type="esms-options">
{
  "polyfillEnable": "all"
}
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

* [ES Module Shims Chrome Passthrough](bench/README.md#chrome-passthrough-performance) (for [94% of users](https://caniuse.com/import-maps)) results in ~5ms extra initialization time over native for ES Module Shims fetching, execution and initialization, and on a slow connection the additional non-blocking bandwidth cost of its 10KB compressed download as expected.
* [ES Module Shims Polyfilling](bench/README.md#native-v-polyfill-performance) (for the remaining [3% of users](https://caniuse.com/import-maps)) is on average 1.4x - 1.5x slower than native module loading, and up to 1.8x slower on slow networks (most likely due to the browser preloader), both for cached and uncached loads, and this result scales linearly up to 10MB and 20k modules loaded executing on the fastest connection in just over 2 seconds in Firefox.
* [Very large import maps](bench/README.md#large-import-maps-performance) (100s of entries) cost only a few extra milliseconds upfront for the additional loading cost.

## Features

### Browser Support

Works in all browsers with [baseline ES module support](https://caniuse.com/#feat=es6-module).

Browser Compatibility on baseline ES modules support **with** ES Module Shims:

| ES Modules Features                             | Chrome (63+)                         | Firefox (67+)                        | Safari (11.1+)                       |
| ----------------------------------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| [modulepreload](#modulepreload)                 | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [Import Maps](#import-maps)                     | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [Import Map Integrity](#import-map-integrity)   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [Multiple Import Maps](#multiple-import-maps)   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [JSON Modules](#json-modules)                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [CSS Modules](#css-modules)                     | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [Wasm Modules](#wasm-modules)                   | 89+                                  | 89+                                  | 15+                                  |

Browser compatibility **without** ES Module Shims:

| ES Modules Features                           | Chrome             | Firefox            | Safari             |
| --------------------------------------------- | ------------------ | ------------------ | ------------------ |
| [modulepreload](#modulepreload)               | 66+                | 115+               | 17.5+              |
| [import.meta.url](#importmetaurl)             | ~76+               | ~67+               | ~12+               |
| [Import Maps](#import-maps)                   | 89+                | 108+               | 16.4+              |
| [Import Map Integrity](#import-map-integrity) | 127+               | :x:                | :x:                |
| [Multiple Import Maps](#multiple-import-maps) | Pending            | :x:                | :x:                |
| [JSON Modules](#json-modules)                 | 123+               | :x:                | 17.2+              |
| [CSS Modules](#css-modules)                   | 123+               | :x:                | :x:                |
| [Wasm Modules](#wasm-modules)                 | :x:                | :x:                | :x:                |
| import.meta.resolve                           | 105+               | 106+               | 16.4+              |
| [Module Workers](#module-workers)             | ~68+               | ~113+              | 15+                |
| Top-Level Await                               | 89+                | 89+                | 15+                |

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
  },
  "integrity": {
    "/test.js": "sha386-..."
  }
}
</script>
<script type="module-shim">
  import test from "test";
  console.log(test);
</script>
```

All modules are still loaded with the native browser module loader, but with their specifiers rewritten then executed as Blob URLs, so there is a relatively minimal overhead to using a polyfill approach like this.

#### External Import Maps

External import maps (using a `"src"` attribute) are not currently supported in any native implementation.

In polyfill mode, external import maps are therefore not supported.

In shim mode, external import maps are fully supported.

### Multiple Import Maps

Multiple import maps have been recently implemented in Chromium in https://bugs.chromium.org/p/chromium/issues/detail?id=927119, including supporting dynamically loading import maps even after modules have been loaded.

In polyfill mode, multiple import maps are supported.

Support for dynamically injecting import maps with JavaScript via e.g.:

```js
document.head.appendChild(Object.assign(document.createElement('script'), {
  type: 'importmap',
  innerHTML: JSON.stringify({ imports: { x: './y.js' } }),
}));
```

is also provided using mutation observers. Note, only `document.head` appending of scripts, importmaps and preloads is supported - we do not observe body mutations to `document.body` for performance reasons.

The caveat for multiple import map support polyfill support in browsers that only support a single import map is per the usual "polyfill rule" for es-module-shims - only those top-level graphs with static import feailures can be polyfilled.

Therefore, imports that would otherwise be supported fine by the first map can't be polyfilled, for example:

```html
<script type="importmap">
{
  "imports": {
    "a": "/a.js"
  }
}
</script>
<script type="importmap">
{
  "scopes": {
    "/": {
      "a": "/b.js"
    }
  }
}
</script>
<script type="module">
import 'a';
</script>
```

In the above, browsers with single import maps support will resolve `/a.js` and the polyfill will not apply, while browsers without any import maps support will be polyfilled to resolve `/b.js`.

Instead, following the usual advice, make sure to design the app to either have static failures or not on all polyfill environments to get well-defined polyfill behaviour:

```html
<script type="importmap">
{
  "imports": {
    "a": "/a.js"
  }
}
</script>
<script type="importmap">
{
  "imports": {
    "b": "/b.js"
  }
}
</script>
<script type="module">
import 'a';
</script>
<script type="module">
import 'b';
</script>
```

The above will then correctly execute both `a` and `b`, with only the `b` importer being polyfilled.

Note that shimmed graphs will always support correct mappings - the above rules only apply to the initial polyfill engagement.

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

### Shim Import

Dynamic `import(...)` within any modules loaded will be rewritten as `importShim(...)` automatically providing full support for all es-module-shims features through dynamic import.

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
  "imports": {
    "pkg": "/pkg.js"
  }
}
</script>
<script type="module" nonce="n0nce">
import pkg from 'pkg';
</script>
```

#### Wasm Build

To use the Web Assembly / non-CSP build of ES Module Shims, this is available as a self-contained single file at `es-module-shims/wasm` or `es-module-shims/dist/es-module-shims.wasm.js` in the package folder.

#### Import Map Integrity

The `"integrity"` field for import maps is supported when possible, throwing an error in es-module-shims when the integrity does not match the expected value:

```html
<script type="importmap">
{
  "imports": {
    "pkg": "/pkg.js"
  },
  "integrity": {
    "/pkg.js": "sha384-..."
  }
}
</script>
<script>
import "/pkg.js";
</script>
```

Note integrity can only be validated when in shim mode or when the polyfill is definitely engaging.

### JSON Modules

> Stability: WhatWG Standard, Single Browser Implementer

In shim mode, JSON modules are always supported. In polyfill mode, JSON modules require the `polyfillEnable: ['json-modules']` [init option](#polyfill-enable-option).

JSON Modules are currently supported in Chrome when using them via an import assertion:

```html
<script type="module">
import json from 'https://site.com/data.json' with { type: 'json' };
</script>
```

In addition JSON modules need to be served with a valid JSON content type.

### CSS Modules

> Stability: WhatWG Standard, Single Browser Implementer

In shim mode, CSS modules are always supported. In polyfill mode, CSS modules require the `polyfillEnable: ['css-modules']` [init option](#polyfill-enable-option).

CSS Modules are currently supported in Chrome when using them via an import assertion:

```html
<script type="module">
import sheet from 'https://site.com/sheet.css' with { type: 'css' };
</script>
```

In addition CSS modules need to be served with a valid CSS content type.

### Wasm Modules

> Stability: WebAssembly Standard, Unimplemented

Implements the [WebAssembly ESM Integration](https://github.com/WebAssembly/esm-integration) spec, including support for source phase imports.

In shim mode, Wasm modules are always supported. In polyfill mode, Wasm modules require the `polyfillEnable: ['wasm-modules']` [init option](#polyfill-enable-option).

WebAssembly module exports are made available as module exports and WebAssembly module imports will be resolved using the browser module loader.

When using the source phase import form, this must be enabled separately via the `polyfillEnable: ['wasm-modules', 'source-phase']` [init option](#polyfill-enable-option) to support source imports to WebAssembly modules.

When enabling `'source-phase'`, `WebAssembly.Module` is also polyfilled to extend from `AbstractModuleSource` per the source phase proposal.

WebAssembly modules require native top-level await support to be polyfilled, see the [compatibility table](#browser-support) above.

```html
<script type="module">
import { fn } from './app.wasm';
</script>
```

And for the source phase:

```html
<script type="module">
import source mod from './app.wasm';
const instance = await WebAssembly.instantiate(mod, { /* ...imports */ });
</script>
```

If using CSP, make sure to add `'unsafe-wasm-eval'` to `script-src` which is needed when the shim or polyfill engages, note this policy is much much safer than eval due to the Wasm secure sandbox. See https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src#unsafe_webassembly_execution.

### TypeScript Type Stripping

Node.js recently [added support for automatically executing TypeScript with type stripping](https://nodejs.org/api/typescript.html). We support the exact same approach in ES Module Shims.

Once enabled, the separate `es-module-shims-typescript.js` extension must be available as a sibling asset to `es-module-shims.js` and will then be loaded on demand when a `.ts`, `.mts` file is loaded or when a file is served with the `application/typescript` MIME type.

Example:

```html
<script async src="https://ga.jspm.io/npm:es-module-shims@2.0.10/dist/es-module-shims.js"></script>
<script type="esms-options">
{
  "polyfillEnable": "all"
}
</script>
<script type="module" src="test.ts"></script>
```

Note that runtime TypeScript features such as enums are not supported, and type only imports should be used where possible, per the Node.js guidance for TypeScript.

### Module Workers

ES Module Shims can be used in module workers in browsers that provide dynamic import in worker environments, which at the moment are Chrome(80+), Edge(80+), Firefox(~113+) and Safari(15+).

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
* [globalLoadEventRetrigger](#global-load-event-retrigger)
* [nonce](#nonce)
* [onerror](#error-hook)
* [onpolyfill](#polyfill-hook)
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
  // Don't retrigger load events on module scripts (DOMContentLoaded, domready, window 'onload')
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

This options supports `"css-modules"`, `"json-modules"`, `"wasm-modules"`, `"source-phase"`.

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

While integrity is always verified and validated when available, when enabled, `enforceIntegrity` will ensure that **all modules must have integrity defined** when loaded through ES Module Shims either on a `<link rel="modulepreload" integrity="...">`, a `<link rel="modulepreload-shim" integrity="...">` preload tag in shim mode, or the `"integrity"` field in the import map. Modules without integrity will throw at fetch time.

For example in the following, only the listed `app.js`, `dep.js` and `another.js` modules will be able to execute with the provided integrity:

```html
<script type="importmap">
{
  "integrity": {
    "/another.js": "sha384-..."
  }
}
</script>
<script type="esms-options">{ "enforceIntegrity": true }</script>
<link rel="modulepreload-shim" href="/app.js" integrity="sha384-..." />\
<link rel="modulepreload-shim" href="/dep.js" integrity="sha384-..." />
<script type="module-shim">
  import '/app.js';
  import '/another.js';
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

Because of the extra processing done by ES Module Shims it is possible for static module scripts to execute after the `DOMContentLoaded`, `readystatechange` or window `load` events they expect, which can cause missed attachment.

In addition, script elements will also have their load events refired when polyfilled.

In order to ensure libraries that rely on these event still behave correctly, ES Module Shims will always double trigger these events that would normally have executed before the document ready state transition to completion, once all the static module scripts in the page have been completely executed through ES module shims.

In such a case, this double event firing can be disabled with the `noLoadEventRetriggers` option:

```js
<script type="esms-options">
{
  // do not re-trigger DOM events (onreadystatechange, DOMContentLoaded, window 'onload')
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
