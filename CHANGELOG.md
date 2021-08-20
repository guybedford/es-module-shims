ES Module Shims 0.12.6 (2021/08/20)
* Fix regression where inline scripts in polyfill mode on supported browsers would throw an unnecessary error (https://github.com/guybedford/es-module-shims/pull/159)

ES Module Shims 0.12.5 (2021/08/19)
* Support CSS module scripts (https://github.com/guybedford/es-module-shims/pull/154)

ES Module Shims 0.12.4 (2021/08/18)
* Fix eager modulepreload preloading bug from 0.12.3 (https://github.com/guybedford/es-module-shims/pull/152)

ES Module Shims 0.12.3 (2021/08/17)
* Support resolve hook (https://github.com/guybedford/es-module-shims/pull/146, @zhoukekestar)
* Internal preload cache to avoid double network requests (https://github.com/guybedford/es-module-shims/pull/149)

ES Module Shims 0.12.2 (2021/07/23)
* Support processing nested tags in mutaton observer (https://github.com/guybedford/es-module-shims/pull/144, @dbackeus)

ES Module SHims 0.12.1 (2021/06/29)
* Fixup dynamic injection of modulepreload (f231485)

ES Module Shims 0.12.0 (2021/06/29)
* Support modulepreload polyfilling (https://github.com/guybedford/es-module-shims/pull/141)

ES Module Shims 0.11.1 (2021/06/17)
* Fixup replacement offset regression (https://github.com/guybedford/es-module-shims/pull/140)

ES Module Shims 0.11.0 (2021/06/15)
* Support for JSON modules and import assertions (https://github.com/guybedford/es-module-shims/commit/2d7eb193986d51733fa6394ad699ee70e5060a13)
* Fix dynamic import bug in Firefox <67 (https://github.com/guybedford/es-module-shims/commit/3f3d71fc3dd76ba1a965ae00285823672f34c138)

ES Module Shims 0.10.7 (2021/06/10)
* Fix import map feature detection in Safari (https://github.com/guybedford/es-module-shims/pull/131, @heypiotr)

ES Module Shims 0.10.6 (2021/06/05)
* Support for revoking blob URLs (https://github.com/guybedford/es-module-shims/pull/124, @vovacodes)
* Include typescript types in published package (https://github.com/guybedford/es-module-shims/pull/125, @vovacodes)
* Fix support for dynamic import in inline scripts (https://github.com/guybedford/es-module-shims/pull/128)
* Polyfill bug fixes (https://github.com/guybedford/es-module-shims/pull/130)

ES Module Shims 0.10.5 (2021/05/14)
* Fix immediately added dynamic import maps (https://github.com/guybedford/es-module-shims/pull/123, @vovacodes)
* Handle relative sourceURL and sourceMappingURL (https://github.com/guybedford/es-module-shims/pull/122, @vovacodes)

ES Module Shims 0.10.4 (2021/04/11)
* Fix cycle handling regression (https://github.com/guybedford/es-module-shims/issues/119)

ES Module Shims 0.10.3 (2021/03/22)
* Fix shim mode execution bug (https://github.com/guybedford/es-module-shims/issues/117)

ES Module Shims 0.10.2 (2021/03/18)
* Fix inline module-shim execution in non-polyfill mode (https://github.com/guybedford/es-module-shims/issues/115)
* Bug fix for scope key resolution to be relative to baseURL not scopeURL (https://github.com/guybedford/es-module-shims/pull/116)

ES Module Shims 0.10.1 (2021/02/27)
* Various bug fixes for polyfill mode

ES Module Shims 0.10.0 (2021/02/27)
* Feature: Comprehensive polyfill mode (https://github.com/guybedford/es-module-shims/pull/113)

ES Module Shims 0.9.0 (2021/01/23)
* Breaking: New initialOptions global API instead of hooking importShims properties (https://github.com/guybedford/es-module-shims/pull/109, @lewisl9029)
* Fix inline script double execution issue (https://github.com/guybedford/es-module-shims/pull/111)

ES Module Shims 0.8.0 (2020/12/23)
* Fix URL to URL import map mappings (https://github.com/guybedford/es-module-shims/pull/107, @vovacodes)
* Include TypeScript types (https://github.com/guybedford/es-module-shims/pull/104, @ifiokjr)
* Fix processScripts to permit dynamic additions (https://github.com/guybedford/es-module-shims/pull/102, @ifiokjr)
* Remove unnecessary sourceMappingURL rebase (https://github.com/guybedford/es-module-shims/pull/98)

ES Module Shims 0.7.1 (2020/10/30)
* Update to es-module-shims@0.3.26
* Fixup onerror hook to throw by default (#96)

ES Module Shims 0.7.0 (2020/10/06)
* Process scripts in order, global importShims.onerror hook (a3e3f639e835d6)

ES Module Shims 0.6.0 (2020/09/17)
* Resolve scopes to the baseURL not the scopeURL (d2893159e4b66c43)

ES Module Shims 0.5.2 (2020/08/07)
* import.meta.resolve (https://github.com/guybedford/es-module-shims/pull/89)

ES Module Shims 0.5.0 (2020/07/24)
* Dynamic import map support (https://github.com/guybedford/es-module-shims/pull/85)
* Remove support for array fallbacks, builtin modules, workers, CSS modules, JSON modules, Wasm modules (https://github.com/guybedford/es-module-shims/pull/84)
* Depcache implementation (https://github.com/guybedford/es-module-shims/pull/78)

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
