## ES Module Shims

[93% of users](https://caniuse.com/#feat=es6-module) are now running browsers with baseline support for ES modules.

But modules features like Import Maps will take a while to be supported in browsers.

_It turns out that we can actually polyfill new modules features on top of these baseline implementations in a performant 7KB shim._

This includes support for:

* [Import Maps](https://github.com/wicg/import-maps) support.
* Dynamic `import()` shimming when necessary in eg older Firefox versions.
* `import.meta` and `import.meta.url`.
* JSON modules with import assertions.
* `<link rel="modulepreload">` polyfill in non Chromium browsers for both shimmed and unshimmed preloading scenarios.

In addition a custom [fetch hook](#fetch-hook) can be implemented allowing for streaming in-browser transform workflows to support custom module types.

Because we are still using the native module loader the edge cases work out comprehensively, including:

* Live bindings in ES modules
* Dynamic import expressions (`import('src/' + varname')`)
* Circular references, with the execption that live bindings are disabled for the first unexecuted circular parent.

Due to the use of a tiny [Web Assembly JS tokenizer for ES module syntax only](https://github.com/guybedford/es-module-lexer), with very simple rewriting rules, transformation is very fast, although in complex cases of hundreds of modules it can be a few hundred milliseconds slower than using SystemJS or native ES modules. See the [SystemJS performance comparison](https://github.com/systemjs/systemjs#performance) for a full performance breakdown in a complex loading scenario.

### Usage

Include ES Module Shims with a `async` attribute on the script:

For example, from CDN:

```html
<!-- UNPKG -->
<script async src="https://unpkg.com/es-module-shims@0.11.1/dist/es-module-shims.js"></script>

<!-- JSPM.IO -->
<script async src="https://ga.jspm.io/npm:es-module-shims@0.11.1/dist/es-module-shims.js"></script>
```

Then there are two ways to use ES Module Shims:

#### Polyfill Mode

Just write your HTML modules like you would in the latest Chrome:

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

NOTE: `script[type="importmap"]` and `script[type="importmap-shim"]` should be placed before
any `script[type="module"]` or `script[type="module-shim"]` in the html. 

Note that you will typically see a console error in browsers without import maps support like:

```
Uncaught TypeError: Failed to resolve module specifier "app". Relative references must start with either "/", "./", or "../".
  at <anonymous>:1:15
```

This execution failure is wanted - it avoids the polyfill causing double execution. The first import being a bare specifier in the pattern above is important to ensure this.

This is because the polyfill cannot disable the native loader - instead it can only execute modules that would otherwise fail instantiation while avoiding duplicate fetches or executions.

#### Shim Mode

Shim mode is triggered by the existence of any `<script type="importmap-shim">` or `<script type="module-shim">`, or when explicitly
setting the [`shimMode` init option](#shim-mode-option).

In shim mode, normal module scripts and import maps are entirely ignored and only the above shim tags will be parsed and executed by ES
Module Shims instead.

This can useful in some [polyfill mode edge cases](#polyfill-edge-cases) where it's not clear whether or not a given module will execute in the native browser loader or not.

### Browser Support

Works in all browsers with [baseline ES module support](https://caniuse.com/#feat=es6-module).

#### Browser Compatibility with ES Module Shims:

| ES Modules Features                | Chrome (61+)                         | Firefox (60+)                        | Safari (10.1+)                       | Edge (16+)                           |
| ---------------------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| Executes Modules in Correct Order  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:<sup>1</sup>       |
| [Dynamic Import](#dynamic-import)  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [import.meta.url](#importmetaurl)  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [Module Workers](#module-workers)  | :heavy_check_mark: ~68+              | :x:<sup>2</sup>                      |
:x:<sup>2</sup>                      | :x:<sup>2</sup>                      |
| [modulepreload](#modulepreload)    | :heavy_check_mark:                   | :heavy_check_mark:                   |
:heavy_check_mark:                   | :heavy_check_mark:                   |
| [Import Maps](#import-maps)        | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [JSON Modules](#json-modules)      | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [import.meta.resolve](#resolve)    | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |

* 1: _The Edge parallel execution ordering bug is corrected by ES Module Shims with an execution chain inlining approach._
* 2: _Module worker support cannot be implemented without dynamic import support in web workers._

#### Current browser compatibility of modules features without ES module shims:

| ES Modules Features                | Chrome (61+)                         | Firefox (60+)                        | Safari (10.1+)                       | Edge (16+)                           |
| ---------------------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| Executes Modules in Correct Order  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :x:<sup>1</sup>                      |
| [Dynamic Import](#dynamic-import)  | :heavy_check_mark: 63+               | :heavy_check_mark: 67+               | :heavy_check_mark: 11.1+             | :x:                                  |
| [import.meta.url](#importmetaurl)  | :heavy_check_mark: ~76+              | :heavy_check_mark: ~67+              | :heavy_check_mark: ~12+ ❕<sup>1</sup>| :x:                                  |
| [Module Workers](#module-workers)  | :heavy_check_mark: ~68+              | :x:                                  | :x:                                  | :x:                                  |
| [modulepreload](#modulepreload)    | :heavy_check_mark: 66+               | :x:                                  | :x:                                  | :x:                                  |
| [Import Maps](#import-maps)        | :heavy_check_mark: 89+               | :x:                                  | :x:                                  | :x:                                  |
| [JSON Modules](#json-modules)      | :heavy_check_mark: 91+               | :x:                                  | :x:                                  | :x:                                  |
| [import.meta.resolve](#resolve)    | :x:                                  | :x:                                  | :x:                                  | :x:                                  |

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

This tag just iniates a fetch request in the browser and thus works equally as a preload polyfill in both shimmed and unshimmed modes.

Unlike the browser specification, the modulepreload polyfill does not request dependency modules by default, in order to avoid unnecessary
code analysis in the polyfill scenarios. **It is recommended to preload deep imports anyway so that this feature shouldn't be necessary.**

### JSON Modules

> Stability: WhatWG Standard, Single Browser Implementer

JSON Modules are currently supported in Chrome when using them via an import assertion:

```html
<script type="module">
import json from 'https://site.com/data.json' assert { type: 'json' };
</script>
```

In addition JSON modules need to be served with a valid JSON content type.

ES Module Shims will fully feature detect and shim or polyfill support as necessary for this feature in other browsers.

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

### Dynamic Import Map Updates

Support is provided for dynamic import map updates via Mutation Observers.

This allows extending the import map via:

```js
document.body.appendChild(Object.assign(document.createElement('script'), {
  type: 'importmap',
  innerHTML: JSON.stringify({ imports: { x: './y.js' } })
}));
```

Dynamic import map extensions after the first module load are not supported by the native module loader so ES Module Shims will carefully polyfill these map cases specifically.

This follows the [dynamic import map specification approach outlined in import map extensions](https://github.com/guybedford/import-maps-extensions).

### Polyfill Edge Cases

In polyfill mode, feature detections are performed for ES modules features. In browsers will full feature support no further processing is done.

In browsers lacking import maps support, all sources are analyzed using the fast Wasm-based lexer. Only those sources known by the analysis
to require syntax features not supported natively in the current browser will then be re-executed, with the rest shared with the native loader directly.

For the most part this will work without issue, including avoiding refetching, ensuring exact instance sharing between the native loader
and shims and avoiding duplicate reexecution in the majority of cases.

There are still some edge cases where this analysis decision gets tricky and can result in duplicate execution / module instances though,
specifically when dealing with import maps and dynamic imports.

Consider the following example:

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

The native browser loader will execute the above module fine, but fail on the lazy dynamic import.

ES Module Shims will still automatically polyfill the module because it can see that it the dynamic import
might need import map support.

As a result, in polyfill mode we get the console output:

```
Executing
Executing
Fail
Ok
```

The double execution being a result of the polyfill approach for this edge case.

This is why it is advisable to always ensure modules use bare specifiers to fail early and avoid double execution.

Adding the `"noshim"` attribute to the script tag will also ensure that ES Module Shims skips processing this script entirely:

```html
<script type="module" noshim>
  // ...
</script>
```

Alternatively [shim mode](#shim-mode) can be used instead.

### Init Options

Provide a `esmsInitOptions` on the global scope before `es-module-shims` is loaded to configure various aspects of the module loading process:

```html
<script>
  globalThis.esmsInitOptions = {
    fetch: (url => fetch(url)),
    skip: /^https?:\/\/(cdn\.pika\.dev|dev\.jspm\.io|jspm\.dev)\//,
    onerror: ((e) => { throw e; }),
    revokeBlobURLs: false,
  }
</script>
<script async src="es-module-shims.js"></script>
```

See below for a detailed description of each of these options.

#### Shim Mode Option

[Shim Mode](#shim-mode) can be overridden using the `shimMode` option:

```js
<script>
  globalThis.esmsInitOptions = {
    shimMode: true
  }
</script>
```

For example, if lazy loading `<script type="module-shim">` scripts shim mode would not be enabled by default.

Conversely, setting `shimMode: false` allows for branching workflows between the native loader and ES module shims:

```js
<script>globalThis.esmsInitOptions = { shimMode: false }</script>
<script type="importmap">
{
  "imports": {
    "app": "data:text/javascript,console.log('running in native loader')",
    "shared": "data:text/javascript,console.log('shared map')"
  }
}
</script>
<script type="importmap-shim">
{
  "imports": {
    "app": "data:text/javascript,console.log('running polyfill')"
  }
}
</script>
<script type="module">
import 'app';
import 'shared';
</script>
```

#### Skip Processing

When loading modules that you know will only use baseline modules features, it is possible to set a rule to explicitly
opt-out modules from rewriting. This improves performance because those modules then do not need to be processed or transformed at all, so that only local application code is handled and not library code.

This can be configured by providing a URL regular expression for the `skip` option:

```js
<script>
  globalThis.esmsInitOptions = {
    skip: /^https:\/\/cdn\.com/ // defaults to `/^https?:\/\/(cdn\.skypack\.dev|jspm\.dev)\//`
  }
</script>
<script async src="es-module-shims.js"></script>
```

By default, this expression supports `jspm.dev`, `dev.jspm.io` and `cdn.pika.dev`.

#### Error hook

You can provide a function to handle errors during the module loading process by providing a `onerror` option:

```js
<script>
  globalThis.esmsInitOptions = {
    onerror: error => console.log(error) // defaults to `((e) => { throw e; })`
  }
</script>
<script async src="es-module-shims.js"></script>
```

#### Fetch Hook

This is provided as a convenience feature since the pipeline handles the same data URL rewriting and circular handling of the module graph that applies when trying to implement any module transform system.

When using the fetch hook, [shim mode](#shim-mode) is enabled by default.

The ES Module Shims fetch hook can be used to implement transform plugins.

For example:

```js
<script>
  globalThis.esmsInitOptions = {
    fetch: async function (url) {
      const response = await fetch(url);
      if (response.url.endsWith('.ts')) {
        const source = await response.body();
        const transformed = tsCompile(source);
        return new Response(new Blob([transformed], { type: 'application/javascript' }));
      }
      return response;
    } // defaults to `(url => fetch(url))`
  }
</script>
<script async src="es-module-shims.js"></script>
```

Because the dependency analysis applies by ES Module Shims takes care of ensuring all dependencies run through the same fetch hook,
the above is all that is needed to implement custom plugins.

Streaming support is also provided, for example here is a hook with streaming support for JSON:

```js
globalThis.esmsInitOptions = {
  fetch: async function (url) {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`${response.status} ${response.statusText} ${response.url}`);
    const contentType = response.headers.get('content-type');
    if (!/^application\/json($|;)/.test(contentType))
      return response;
    const reader = response.body.getReader();
    return new Response(new ReadableStream({
      async start (controller) {
        let done, value;
        controller.enqueue(new Uint8Array([...'export default '].map(c => c.charCodeAt(0))));
        while (({ done, value } = await reader.read()) && !done) {
          controller.enqueue(value);
        }
        controller.close();
      }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/javascript"
      }
    });
  }
}
```

#### Revoke Blob URLs

When polyfilling the missing features `es-module-shims` would create in-memory blobs using `URL.createObjectURL()` for each processed module.
In most cases, memory footprint of these blobs is negligible so there is no need to call `URL.revokeObjectURL()`
for them, and we don't do that by default.

That said, in some scenarios, e.g. when evaluating some continuously changing modules without a page reload, like in a web-based code editor,
you might want to reduce the growth of memory usage by revoking those blob URLs after they were already `import`ed.

You can do that by enabling the `revokeBlobURLs` init option:

```js
<script>
  globalThis.esmsInitOptions = {
    revokeBlobURLs: true
  }
</script>
<script type="module" src="es-module-shims.js"></script>
```

NOTE: revoking object URLs is not entirely free, while we are trying to be smart about it and make sure it doesn't
cause janks, we recommend enabling this option only if you have done the measurements and identified that you really need it.

##### Plugins

Since the Fetch Hook is very new, there are no plugin examples of it yet, but it should be easy to support various workflows
such as TypeScript and new JS features this way.

If you work on something here (or even just wrap the examples above into a separate project) please do share to link to from here!

## Implementation Details

### Import Rewriting

* Sources are fetched, import specifiers are rewritten to reference exact URLs, and then executed as BlobURLs through the whole module graph.
* CSP is not supported as we're using fetch and modular evaluation.
* The [lexer](https://github.com/guybedford/es-module-lexer) handles the full language grammar including nested template strings, comments, regexes and division operator ambiguity based on backtracking.
* When executing a circular reference A -> B -> A, a shell module technique is used to "shim" the circular reference into an acyclic graph. As a result, live bindings for the circular parent A are not supported, and instead the bindings are captured immediately after the execution of A.

## Inspiration

Huge thanks to Rich Harris for inspiring this approach with [Shimport](https://github.com/rich-harris/shimport).

### License

MIT
