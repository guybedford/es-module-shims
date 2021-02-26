## ES Module Shims

[90% of users](https://caniuse.com/#feat=es6-module) are now running browsers with baseline support for ES modules.

But modules features like Import Maps will take a while to be supported in browsers.

_It turns out that we can actually polyfill new modules features on top of these baseline implementations in a performant 7KB shim._

This includes support for:

* [Import Maps](https://github.com/wicg/import-maps) support.
* `import.meta` and `import.meta.url`.
* Dynamic `import()` shimming when necessary in eg older Firefox versions.

In addition a custom [fetch hook](#fetch-hook) can be implemented allowing for streaming in-browser transform workflows to support custom module types.

Because we are still using the native module loader the edge cases work out comprehensively, including:

* Live bindings in ES modules
* Dynamic import expressions (`import('src/' + varname')`)
* Circular references, with the execption that live bindings are disabled for the first unexecuted circular parent.

Due to the use of a tiny [Web Assembly JS tokenizer for ES module syntax only](https://github.com/guybedford/es-module-lexer), with very simple rewriting rules, transformation is very fast, although in complex cases of hundreds of modules it can be a few hundred milliseconds slower than using SystemJS or native ES modules. See the [SystemJS performance comparison](https://github.com/systemjs/systemjs#performance) for a full performance breakdown in a complex loading scenario.

### Polyfill Mode

To use ES Module Shims as a polyfill for import maps, just include the script on the page of any modules application:

```js
<script src="dist/es-module-shims.js" defer></script>
```

Then go ahead and use import maps and other new modules features.

In Chrome 89+ with import maps support, ES Module Shims won't do anything at all apart from feature detections.

In browsers that don't support import maps, resolution of bare specifiers like `import 'lib'` will throw an error. ES Module Shims will
run its fast source analysis, determine this is the case, and then reexecute the modules with the rewritten resolutions.

There will still be a browser console error in these browsers since we cannot turn off the native module loader, but the application
will execute correctly.

#### "noshim" Attribute

There are some rare cases where the polyfill might execute modules twice. In these cases the `"noshim"` attribute can be used to avoid this:

```html
<script type="module" noshim>
  if (false) import('bare-specifier');
</script>
```

Without this attribute, ES Module Shims sees the `import('bare-specifier')` nd assumes browsers without import maps support require the polyfill,
but the module will have already executed.

### ES Module Shims Only Scripts

To ensure ES Module Shims definitely executes modules and entirely separately from native modules, use the importmap-shim and module-shim tags:

```html
<script type="importmap">
{
  "imports": {
    "x": "./x".js"
  }  
}
</script>
<script type="importmap-shim">
{
  "imports": {
    "x": "./x-shim".js"
  }  
}
</script>
<script type="module-shim">
  import 'x';
  console.log("Executed by ES Module Shims Only");
</script>
<script type="module" noshim>
  import 'x';
  console.log("Executed by the Native Loader Only");
</script>
```

### Browser Support

Works in all browsers with [baseline ES module support](https://caniuse.com/#feat=es6-module).

#### Browser Compatibility with ES Module Shims:

| ES Modules Features                | Chrome (61+)                         | Firefox (60+)                        | Safari (10.1+)                       | Edge (16+)                           |
| ---------------------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| Executes Modules in Correct Order  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:<sup>1</sup>       |
| [Dynamic Import](#dynamic-import)  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [import.meta.url](#importmetaurl)  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [import.meta.resolve](#resolve)    | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |
| [Module Workers](#module-workers)  | :heavy_check_mark: ~68+              | :x:<sup>2</sup>                      | :x:<sup>2</sup>                      | :x:<sup>2</sup>                      |
| [Import Maps](#import-maps)        | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   |

* 1: _The Edge parallel execution ordering bug is corrected by ES Module Shims with an execution chain inlining approach._
* 2: _Module worker support cannot be implemented without dynamic import support in web workers._

#### Current browser compatibility of modules features without ES module shims:

| ES Modules Features                | Chrome (61+)                         | Firefox (60+)                        | Safari (10.1+)                       | Edge (16+)                           |
| ---------------------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| Executes Modules in Correct Order  | :heavy_check_mark:                   | :heavy_check_mark:                   | :heavy_check_mark:                   | :x:<sup>1</sup>                      |
| [Dynamic Import](#dynamic-import)  | :heavy_check_mark: 63+               | :heavy_check_mark: 67+               | :heavy_check_mark: 11.1+             | :x:                                  |
| [import.meta.url](#importmetaurl)  | :heavy_check_mark: ~76+              | :heavy_check_mark: ~67+              | :heavy_check_mark: ~12+ ❕<sup>1</sup>| :x:                                  |
| [import.meta.resolve](#resolve)    | :x:                                  | :x:                                  | :x:                                  | :x:                                  |
| [Module Workers](#module-workers)  | :heavy_check_mark: ~68+              | :x:                                  | :x:                                  | :x:                                  |
| [Import Maps](#import-maps)        | :heavy_check_mark: 89+               | :x:                                  | :x:                                  | :x:                                  |

* 1: _Edge executes parallel dependencies in non-deterministic order. ([ChakraCore bug](https://github.com/microsoft/ChakraCore/issues/6261))._
* ~: _Indicates the exact first version support has not yet been determined (PR's welcome!)._
* ❕<sup>1</sup>: On module redirects, Safari returns the request URL in `import.meta.url` instead of the response URL as per the spec.

### Import Maps

In order to import bare package specifiers like `import "lodash"` we need [import maps](https://github.com/domenic/import-maps), which are still an experimental specification.

Using this polyfill we can write:

```html
<!doctype html>
<!-- either use "defer" or load this polyfill after the scripts below-->
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

> Stability: No current browser standard

Support is provided for dynamic import map updates via Mutation Observers.

This allows extending the import map via:

```js
document.body.appendChild(Object.assign(document.createElement('script'), {
  type: 'importmap',
  innerHTML: JSON.stringify({ imports: { x: './y.js' } })
}));
```

Note that dynamic import map extensions are not 

To support dynamic injection of new import maps into the page, call `importShim.load()` to pick up any new `<script type="importmap-shim">` tags.

This can be linked up to mutation observers if desired, with something like:

```js
new MutationObserver(mutations => {
  for (const mutation of mutations) {
    if (mutation.type !== 'childList') continue;
    for (const node of mutation.addedNodes) {
      if (node.tagName === 'SCRIPT' && node.type === 'importmap-shim' && !node.ep) {
        importShim.load();
        break;
      }
    }
  }
}).observe(document, { childList: true, subtree: true });
```

then allowing dynamic injection of `<script type="importmap-shim">` to immediately update the internal import maps.

This follows the [dynamic import map specification approach outlined in import map extensions](https://github.com/guybedford/import-maps-extensions).

### Init Options

Provide a `esmsInitOptions` on the global scope before `es-module-shims` is loaded to configure various aspects of the module loading process:

```html
<script>
  globalThis.esmsInitOptions = {
    fetch: (url => fetch(url)),
    skip: /^https?:\/\/(cdn\.pika\.dev|dev\.jspm\.io|jspm\.dev)\//,
    onerror: ((e) => { throw e; }),
  }
</script>
<script defer src="es-module-shims.js"></script>
```

See below for a detailed description of each of these options.

#### Skip Processing

When loading modules that you know will only use baseline modules features, it is possible to set a rule to explicitly
opt-out modules from rewriting. This improves performance because those modules then do not need to be processed or transformed at all, so that only local application code is handled and not library code.

This can be configured by providing a URL regular expression for the `skip` option:

```js
<script>
  globalThis.esmsInitOptions = {
    skip: /^https:\/\/cdn\.com/ // defaults to `/^https?:\/\/(cdn\.pika\.dev|dev\.jspm\.io|jspm\.dev)\//`
  }
</script>
<script defer src="es-module-shims.js"></script>
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
<script defer src="es-module-shims.js"></script>
```

#### Fetch Hook

This is provided as a convenience feature since the pipeline handles the same data URL rewriting and circular handling of the module graph that applies when trying to implement any module transform system.

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
<script defer src="es-module-shims.js"></script>
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

##### Plugins

Since the Fetch Hook is very new, there are no plugin examples of it yet, but it should be easy to support various workflows
such as TypeScript and new JS features this way.

If you work on something here (or even just wrap the examples above into a separate project) please do share to link to from here!

## Implementation Details

### Import Rewriting

* Sources are fetched, import specifiers are rewritten to reference exact URLs, and then executed as BlobURLs through the whole module graph.
* CSP is not supported as we're using fetch and modular evaluation.
* The [tokenizer](https://github.com/guybedford/es-module-lexer) handles the full language grammar including nested template strings, comments, regexes and division operator ambiguity based on backtracking.
* When executing a circular reference A -> B -> A, a shell module technique is used to "shim" the circular reference into an acyclic graph. As a result, live bindings for the circular parent A are not supported, and instead the bindings are captured immediately after the execution of A.

## Inspiration

Huge thanks to Rich Harris for inspiring this approach with [Shimport](https://github.com/rich-harris/shimport).

### License

MIT
