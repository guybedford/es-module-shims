## ES Module Shims

[90% of users](https://caniuse.com/#feat=es6-module) are now running browsers with baseline support for ES modules.

But a lot of the useful features of modules come from new specifications which either aren't implemented yet, or are only available in some browsers.

_It turns out that we can actually polyfill most of the newer modules specifications on top of these baseline implementations in a performant 8KB shim._

This includes support for:

* Dynamic `import()` shimming when necessary in eg older Firefox versions.
* `import.meta` and `import.meta.url`.
* [Import Maps](https://github.com/domenic/import-maps) support.
* Importing JSON
* Importing Web Assembly (note, there is an [open issue on how to handle the 4KB imposed limit](https://github.com/guybedford/es-module-shims/issues/1))

In addition a custom [fetch hook](#fetch-hook) can be implemented allowing for streaming in-browser transform workflows.

Because we are still using the native module loader the edge cases work out comprehensively, including:

* Live bindings in ES modules
* Dynamic import expressions (`import('src/' + varname')`)
* Circular references, with the execption that live bindings are disabled for the first unexecuted circular parent.

Due to the use of a tiny [Web Assembly JS tokenizer for ES module syntax only](https://github.com/guybedford/es-module-lexer), with very simple rewriting rules, transformation is very fast, although in complex cases of hundreds of modules it can be a few hundred milliseconds slower than using SystemJS or native ES modules. See the [SystemJS performance comparison](https://github.com/systemjs/systemjs#performance) for a full performance breakdown in a complex loading scenario.

### Browser Support

Works in all browsers with [baseline ES module support](https://caniuse.com/#feat=es6-module).

Current browser compatibility of modules features without ES module shims:

| ES Modules Features                | Chrome (61+)                         | Firefox (60+)                        | Safari (10.1+)                       | Edge (16+)                           |
| ---------------------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| Executes Modules in Correct Order  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :x:<sup>1</sup>                      |
| [Dynamic Import](#dynamic-import)  | :heavy_check_mark: 63+               | :heavy_check_mark: 67+               | :heavy_check_mark: 11.1+             | :x:                                  |
| [import.meta.url](#dynamic-import) | :heavy_check_mark: ~76+              | :heavy_check_mark: ~67+              | :heavy_check_mark: ~12+ ❕<sup>1</sup>| :x:                                  |
| [Module Workers](#module-workers)  | :heavy_check_mark: ~68+              | :x:                                  | :x:                                  | :x:                                  |
| [Import Maps](#import-maps)        | :x:<sup>2</sup>                      | :x:                                  | :x:                                  | :x:                                  |
| [JSON Modules](#json-modules)      | :x:                                  | :x:                                  | :x:                                  | :x:                                  |
| [CSS Modules](#css-modules)        | :x:                                  | :x:                                  | :x:                                  | :x:                                  |
| [Wasm Modules](#web-assembly)      | :x:                                  | :x:                                  | :x:                                  | :x:                                  |

* 1: _Edge executes parallel dependencies in non-deterministic order. ([ChakraCore bug](https://github.com/microsoft/ChakraCore/issues/6261))._
* 2: _Enabled under the Experimental Web Platform Features flag in Chrome 76._
* ~: _Indicates the exact first version support has not yet been determined (PR's welcome!)._
* ❕<sup>1</sup>: On module redirects, Safari returns the request URL in `import.meta.url` instead of the response URL as per the spec.

#### Browser Compatibility with ES Module Shims:

| ES Modules Features                | Chrome (61+)                         | Firefox (60+)                        | Safari (10.1+)                       | Edge (16+)                           |
| ---------------------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| Executes Modules in Correct Order  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:<sup>1</sup>       |
| [Dynamic Import](#dynamic-import)  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [import.meta.url](#dynamic-import) | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [Module Workers](#module-workers)  | :heavy_check_mark: 63+               | :x:<sup>2</sup>                      | :x:<sup>2</sup>                      | :x:<sup>2</sup>                      |
| [Import Maps](#import-maps)        | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [JSON Modules](#json-modules)      | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [CSS Modules](#css-modules)        | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [Wasm Modules](#web-assembly)      | :heavy_multiplication_x:<sup>3</sup> | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |

* 1: _The Edge parallel execution ordering bug is corrected by ES Module Shims with an execution chain inlining approach._
* 2: _Module worker support cannot be implemented without dynamic import support in web workers._
* 3: _Chrome limits Web Assembly to 4KiB synchronous instantiations. [Fix tracking in #1](https://github.com/guybedford/es-module-shims/issues/1)._

### Import Maps

> The goal is for this project to eventually become a true polyfill for import maps in older browsers, but this will only happen once the spec is implemented in more than one browser and demonstrated to be stable.

In order to import bare package specifiers like `import "lodash"` we need [import maps](https://github.com/domenic/import-maps), which are still an experimental specification.

Using this polyfill we can write:

```html
<!doctype html>
<!-- either user "defer" or load this polyfill after the scripts below-->
<script defer src="es-module-shims.js"></script>
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

All modules are still loaded with the native browser module loader, just as Blob URLs, meaning there is minimal overhead to using a polyfill approach like this.

### Dynamic Import

Dynamic `import(...)` within any modules loaded will be rewritten as `importShim(...)` automatically
providing full support for all es-module-shims features through dynamic import.

To load code dynamically (say from the browser console), `importShim` can be called similarly:

```js
importShim('/path/to/module.js').then(x => console.log(x));
```

### import.meta.url

`import.meta.url` provides the full URL of the current module within the context of the module execution.

### JSON Modules

To load [JSON Modules](https://github.com/whatwg/html/pull/4407), import any JSON file served with `application/json`:

```js
import json from './test.json';
```

### CSS Modules

To load [CSS Modules](https://github.com/w3c/webcomponents/blob/gh-pages/proposals/css-modules-v1-explainer.md), import any file with served with `text/css`:

```js
import css from './style.css';
document.adoptedStyleSheets = [...document.adoptedStyleSheets, css];
```

Support relies on the `new CSSStyleSheet` constructor, which is currently only available in Chromium.

For other browsers a [polyfill](https://github.com/calebdwilliams/construct-style-sheets) can be used.

### Web Assembly

To load [Web Assembly Modules](https://github.com/webassembly/esm-integration), import a module served with `application/wasm`:

```js
import { fn } from './test.wasm';
```

Web Assembly imports are in turn supported.

Import map support is provided both for mapping into Web Assembly URLs, as well as mapping import specifiers to JS or WebAssembly from within WASM.

> Note some servers don't yet support serving `.wasm` files as `application/wasm` by default, in which case an invalid content type error will be thrown. The `application/wasm` MIME type is necessary for loading Web Assembly in line with the specification for browser modules.

### Module Workers

To load workers with full import shims support, the `WorkerShim` constructor can be used:

```js
const worker = new WorkerShim('./module.js', {
  type: 'module',
  // optional import map for worker:
  importMap: {...}
});
```

This matches the specification for ES module workers, supporting all features of import shims within the workers.

> Module workers are only supported in browsers that provide dynamic import in worker environments, which is only Chrome currently.

### Skip Processing

When loading modules that you know will only use baseline modules features, it is possible to set a rule to explicitly
opt-out modules from rewriting. This improves performance because those modules then do not need to be processed or transformed at all, so that only local application code is handled and not library code.

This can be configured by setting the `importShim.skip` URL regular expression:

```js
importShim.skip = /^https:\/\/cdn\.com/;
```

By default, this expression supports `jspm.dev`, `dev.jspm.io` and `cdn.pika.dev`.

### Fetch Hook

> Note: This hook is non spec-compliant, but is provided as a convenience feature since the pipeline handles the same data URL rewriting and circular handling of the module graph that applies when trying to implement any module transform system.

The ES Module Shims fetch hook can be used to implement transform plugins.

For example:

```js
importShim.fetch = async function (url) {
  const response = await fetch(url);
  if (response.url.endsWith('.ts')) {
    const source = await response.body();
    const transformed = tsCompile(source);
    return new Response(new Blob([transformed], { type: 'application/javascript' }));
  }
  return response;
};
```

Because the dependency analysis applies by ES Module Shims takes care of ensuring all dependencies run through the same fetch hook,
the above is all that is needed to implement custom plugins.

Streaming support can be handled through the above as well, although most compilers likely want synchronous sources as in the above.

#### Plugins

Since the Fetch Hook is very new, there are no plugin examples of it yet, but it should be easy to support various workflows
such as TypeScript and new JS features this way.

If you work on something here please do share to link to from here.

## Implementation Details

### Import Rewriting

* Sources are fetched, import specifiers are rewritten to reference exact URLs, and then executed as BlobURLs through the whole module graph.
* CSP is not supported as we're using fetch and modular evaluation.
* The [tokenizer](https://github.com/guybedford/es-module-lexer) handles the full language grammar including nested template strings, comments, regexes and division operator ambiguity based on backtracking.
* When executing a circular reference A -> B -> A, a shell module technique is used to "shim" the circular reference into an acyclic graph. As a result, live bindings for the circular parent A are not supported, and instead the bindings are captured immediately after the execution of A.

### Import Maps
* The import maps specification is under active development and will change, all of the current specification features are implemented, but the edge cases are not currently fully handled. These will be refined as the specification and reference implementation continue to develop.

### Web Assembly
* In order for Web Assembly to execute in the module graph as a blob: URL we need to use `new WebAssembly.Instance` for synchronous execution, but this has a 4KB size limit in Chrome and Firefox which will throw for larger binaries. There is no known workaround currently. Tracking in https://github.com/guybedford/es-module-shims/issues/1.
* Exports are snapshotted on execution. Unexecuted circular dependencies will be snapshotted as empty imports. This matches the [current integration plans for Web Assembly](https://github.com/WebAssembly/esm-integration/).

## Inspiration

Huge thanks to Rich Harris for inspiring this approach with [Shimport](https://github.com/rich-harris/shimport).

### License

MIT
