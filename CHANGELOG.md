ES Module Shims 0.4.6 (2019/10/21)
* Implement fetch hook (https://github.com/guybedford/es-module-shims/pull/73)

ES Module Shims 0.4.5 (2019/09/18)
* Fixup incorrect pageBaseUrl reference (7391880e836712)
* Fixup hasDocument check for Firefox (https://github.com/guybedford/es-module-shims/issues/62)

ES Module Shims 0.4.4 (2019/09/09)
* Fix to ensure build against latest es-module-lexer

ES Module Shims 0.4.3 (2019/09/08)
* Remove unnecessary Object.assign polyfill (https://github.com/guybedford/es-module-shims/commit/6bc90c059377e254e71b6695368215ce6ebff7d7)
* Rework standard module detection (https://github.com/guybedford/es-module-shims/pull/62)

ES Module Shims 0.4.2 (2019/08/31)
* Fixes a critical Edge bug with parallel execution using a graph inlining to ensure execution order (https://github.com/guybedford/es-module-shims/pull/57, https://github.com/microsoft/ChakraCore/issues/6261)
* `x-javascript` MIME type support (https://github.com/guybedford/es-module-shims/pull/56)

ES Module Shims 0.4.1 (2019/08/30)
* Support text/javascript MIME type (https://github.com/guybedford/es-module-shims/pull/53)

ES Module Shims 0.4.0 (2019/08/29)
* Support for cascading import maps (https://github.com/guybedford/es-module-shims/pull/49)
* Use strict Content-Type checks for modules (https://github.com/guybedford/es-module-shims/pull/47)

ES Module Shims 0.3.2 (2019/08/29)
* Update to ES module lexer 0.3.12

ES Module Shims 0.3.1 (2019/08/28)
* Updates to ES module lexer 0.3.11 including better errors and invalid syntax handling (https://github.com/guybedford/es-module-shims/pull/46)

ES Module Shims 0.3.0 (2019/08/25)
* Implement CSS modules (https://github.com/guybedford/es-module-shims/pull/41)
* Upgrade to Wasm-based ES module lexer for performance (https://github.com/guybedford/es-module-shims/38)
* Fix sourceMappingURL support in Firefox (https://github.com/guybedford/es-module-shims/pull/37, @MicahZoltu)
* Separate ES module lexer into its own project (https://github.com/guybedford/es-module-shims/pull/36, @LarsDenBakker)

ES Module Shims 0.2.15 (2019/07/28)
* Early import map resolution (https://github.com/guybedford/es-module-shims/pull/32)

ES Module Shims 0.2.14 (2019/07/17)
* Support import map fallbacks by ignoring std modules (https://github.com/guybedford/es-module-shims/pull/28, @thepassle)
* Support path separators in module URLs containing hashes and query strings (https://github.com/guybedford/es-module-shims/pull/30, @LarsDenBakker)

ES Module Shims 0.2.13 (2019/06/29)
* Support JSON module imports (https://github.com/guybedford/es-module-shims/pull/27)

ES Module Shims 0.2.12 (2019/06/29)
* Support `<base>` tag for baseURL (https://github.com/guybedford/es-module-shims/pull/26, @LarsDenBakker)

ES Module Shims 0.2.11 (2019/06/26)
* Fix use of object spread in Edge (https://github.com/guybedford/es-module-shims/pull/25, @LarsDenBakker)

ES Module Shims 0.2.10 (2019/06/25)
* Fix Worker constructor options bug (https://github.com/guybedford/es-module-shims/pull/23)

ES Module Shims 0.2.9 (2019/06/24)
* Fixup WorkerShim worker output

ES Module Shims 0.2.8 (2019/06/24)
* Support WorkerShim module workers (https://github.com/guybedford/es-module-shims/pull/17 by @costingeana)

ES Module Shims 0.2.7 (2019/05/04)
* Fix imports minification case (https://github.com/guybedford/es-module-shims/issues/11)

ES Module Shims 0.2.6 (2019/04/30)
* Fixup dynamic import regression

ES Module Shims 0.2.5 (2019/04/30)
* Fix various lexing edge cases around dynamic import

ES Module Shims 0.2.4
* Add "type": "module" to package.json

ES Module Shims 0.2.3 (2019/03/29)
* Fixup minification build
* Further lexer adjustments (2ca2589b1)

ES Module Shims 0.2.2 (2019/03/28)
* Fixup export syntax parser bug (51396799)

ES Module Shims 0.2.1 (2019/02/25)
* Fix support for URL imports

ES Module Shims 0.2.0 (2019/01/12)
* Update to latest import maps spec (e6e64748)

ES Module Shims 0.1.15 (2018/10/09)
* Use responseURL for resolution for spec compliant redirects (689aed0)

ES Module Shims 0.1.14 (2018/10/06)
* Fix Safari WASM support (7cf31ac4)
* add sourceURL to cycle shells for debugging (80438731)
