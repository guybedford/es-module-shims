## ES Module Shims

[Over 75% of users](https://caniuse.com/#feat=es6-module) are now running browsers with baseline support for ES modules.

But a lot of the useful features of modules come from new specifications which either aren't implemented yet, or are only available in some browsers.

_It turns out that we can actually polyfill most of the newer modules specifications on top of these baseline implementations in a performant 3.5KB shim._

This includes support for:

* Dynamic `import()` shimming when necessary in eg older Firefox versions.
* `import.meta` and `import.meta.url`.
* [Package Name Maps](https://github.com/domenic/package-name-maps) support.
* Importing Web Assembly

Because we are still using the native module loader the edge cases work out comprehensively, including:

* Live bindings in ES modules
* Dynamic import expressions (`import('src/' + varname')`)
* Circular references, with the execption that live bindings are disabled for the first unexecuted circular parent.

Due to the use of a dedicated JS tokenizer for ES module syntax only, with very simple rewriting rules, transformation is instant.

### Package Name Maps

In order to import bare package specifiers like `import "lodash"` we need [package name maps](https://github.com/domenic/package-name-maps), which are still an experimental specification without
any implementations.

Using this polyfill we can write:

```html
<!doctype html>
<!-- either user "defer" or load this polyfill after the scripts below-->
<script defer src="es-module-shims.js"></script>
<script type="packagemap-shim">
{
  "packages": {
    "test": "/test.js"
  },
  "scopes": {
    "/": {
      "packages": {
        "test-dep": "/test-dep.js"
      }
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

### Web Assembly

To load Web Assembly, just import it:

```js
import { fn } from './test.wasm';
```

Web Assembly imports are in turn supported.

Package map support is provided both for mapping into Web Assembly URLs, as well as mapping import specifiers to JS or WebAssembly from within WASM.

## Technical Limitations

### Tokenizer Rewriting

* Tokenizing handles the full language grammar including nested template strings, comments, regexes and division operator ambiguity based on backtracking.
* Rewriting is based on fetching the sources, turning them into BlobURLs and executing up the graph.
* When executing a circular reference A -> B -> A, a shell module technique is used to "shim" the circular reference into an acyclic graph. As a result, live bindings for the circular parent A are not supported, and instead the bindings are captured immediately after the execution of A.
* The approach will only work in browsers supporting ES modules.
* CSP is not supported as we're using fetch and modular evaluation.

### Package Name Maps
* The package maps specification is under active development and will change, what is implemented is a faithful subset of the existing behaviour.
* path_prefix in scopes is not supported.
* Only flat scopes are supported.

### Web Assembly
* Exports are snapshotted on execution. Unexecuted circular dependencies will be snapshotted as empty imports. This matches the [current integration plans for Web Assembly](https://github.com/WebAssembly/esm-integration/).

## Inspiration

Huge thanks to Rich Harris for inspiring this approach with [Shimport](https://github.com/rich-harris/shimport).

### License

MIT