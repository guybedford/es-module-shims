self.baseURL = location.href.substr(0, location.href.lastIndexOf('/') + 1);

suite('Basic loading tests', () => {
  test('Static load order and domcontentloaded and ready state', async function () {
    window.onerror = () => {};
    await new Promise(resolve => {
      if (window.domContentLoadedOrder)
        resolve();
      document.addEventListener('DOMContentLoaded', resolve);
    });
    assert.ok(window.domContentLoadedOrder);
    assert.equal(window.domContentLoadedOrder.join(','), '1,2,3,4,5');
    await new Promise(resolve => {
      if (window.readyStateOrder)
        resolve();
      document.addEventListener('readystatechange', resolve);
    });
    assert.ok(window.readyStateOrder);
    assert.equal(window.readyStateOrder.join(','), '1,2,3,4,5');
  });

  test('Load counter', function () {
    assert.equal(count, 2);
  });
  test('Should import a module', async function () {
    var m = await importShim('./fixtures/es-modules/no-imports.js');
    assert(m);
    assert.equal(m.asdf, 'asdf');
  });

  test('Should import a module cached', async function () {
    var m1 = await importShim('./fixtures/es-modules/no-imports.js');
    var m2 = await importShim('./fixtures/es-modules/no-imports.js');
    assert.equal(m1.asdf, 'asdf');
    assert.equal(m1.obj, m2.obj);
  });

  test('should import an es module with its dependencies', async function () {
    var m = await importShim('./fixtures/es-modules/es6-withdep.js');
    assert.equal(m.p, 'p');
  });

  test('should import without bindings', async function () {
    var m = await importShim('./fixtures/es-modules/direct.js');
    assert(!!m);
  });

  test('should support various es syntax', async function () {
    var m = await importShim('./fixtures/es-modules/es6-file.js');

    assert.equal(typeof m.q, 'function');

    var thrown = false;
    try {
      new m.q().foo();
    }
    catch(e) {
      thrown = true;
      assert.equal(e, 'g');
    }

    if (!thrown)
      throw new Error('Supposed to throw');
  });

  test('should resolve various import syntax', async function () {
    var m = await importShim('./fixtures/es-modules/import.js');
    assert.equal(typeof m.a, 'function');
    assert.equal(m.b, 4);
    assert.equal(m.c, 5);
    assert.equal(m.d, 4);
    assert.equal(typeof m.q, 'object');
    assert.equal(typeof m.q.foo, 'function');
  });

  test('should support import.meta.url', async function () {
    var m = await importShim('./fixtures/es-modules/moduleName.js');
    assert.equal(m.name, new URL('./fixtures/es-modules/moduleName.js', baseURL).href);
  });

  test('should support import assertions', async function () {
    var m = await importShim('./fixtures/json-assertion.js');
    assert.equal(m.m.json, 'module');
  });

  test('should support css imports', async function () {
    var m = await importShim('./fixtures/css-assertion.js');
    assert.equal(m.default.cssRules[0].selectorText, 'body');
  });

  test('should support dynamic import', async function () {
    var m = await importShim('./fixtures/es-modules/dynamic-import.js');
    var dynamicModule = await m.doImport();

    assert.equal(m.before, 'before');
    assert.equal(m.after, 'after');
    assert.equal(dynamicModule.default, 'bareDynamicImport');
  });

  test('should support dynamic import in an inline script', async function () {
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(window.inlineScriptDynamicImportResult.default, 'bareDynamicImport');
  });

  test('should support dynamic import with an import map', async function () {
    const p = new Promise(resolve => window.done = resolve);
    document.head.appendChild(Object.assign(document.createElement('script'), {
      type: 'module-shim',
      src: './fixtures/es-modules/importer1.js'
    }));
    await p;
  });

  test('should support relative dynamic import', async function () {
    const result = await (await importShim('./fixtures/test-rel-dynamic.js')).default;
    assert.equal(result.hello, 'world');
  });

  test('should support nested import.meta.url in dynamic import', async function () {
    const result = await (await importShim('./fixtures/test-nested-dynamic.js')).default;
    assert.ok(result.default.endsWith('test-nested-dynamic.js'));
  });

  test('Should import a module via a full url, with scheme', async function () {
    const url = window.location.href.replace('/test-shim.html', '/fixtures/es-modules/no-imports.js');
    assert.equal(url.slice(0, 4), 'http');
    var m = await importShim(url);
    assert(m);
    assert.equal(m.asdf, 'asdf');
  });

  test('Should import a module via a full url, without scheme', async function () {
    const url = window.location.href.split('#')[0].split('?')[0]
      .replace('/test-shim.html', '/fixtures/es-modules/no-imports.js')
      .replace(/^http(s)?:/, '');
    assert.equal(url.slice(0, 2), '//');
    var m = await importShim(url);
    assert(m);
    assert.equal(m.asdf, 'asdf');
  });

  test("Should import a module via a relative path re-mapped with importmap's scopes", async function () {
    const url = window.location.href.split('#')[0].split('?')[0]
      .replace('/test-shim.html', '/fixtures/es-modules/import-relative-path.js');
    var m = await importShim(url);
    assert(m);
    assert.equal(m.p, 'p');
    assert.equal(m.a, 'a');
  });

  test('Should import a module via data url', async function () {
    var m = await importShim('data:application/javascript;charset=utf-8;base64,ZXhwb3J0IHZhciBhc2RmID0gJ2FzZGYnOw0KZXhwb3J0IHZhciBvYmogPSB7fTs=');
    assert(m);
    assert.equal(m.asdf, 'asdf');
  });

  test('Should import a module via blob', async function () {
    const code = await (await fetch('./fixtures/es-modules/no-imports.js')).text();
    const blob = new Blob([code], { type: 'application/javascript' });
    var m = await importShim(URL.createObjectURL(blob));
    assert(m);
    assert.equal(m.asdf, 'asdf');
  });

  test('Should import a module with query parameters with path segments', async function () {
    var m = await importShim('./fixtures/es-modules/query-param-a.js?foo=/foo/bar/');
    assert(m);
    assert.equal(m.a, 'ab');
  });
});

suite('Circular dependencies', function() {
  test('Should handle self-import tdzs', async function () {
    var m = await importShim('./fixtures/es-modules/tdz.js');
    assert.equal(m.checkTDZ(), 'tdz');
  });

  test('should resolve circular dependencies', async function () {
    var m = await importShim('./fixtures/test-cycle.js');
    assert.equal(m.default, 'f');
  });

  test('should support shell update import interleaving', async function () {
    var m = await importShim('./fixtures/test-self-import.js');
    assert.equal(m.default.length, 3);
    assert.equal(m.default[0], 5);
    assert.equal(m.default[1], 6);
    assert.equal(m.default[2], 7);
  });
});

suite('Loading order', function() {
  async function assertLoadOrder(module, exports) {
    window.ordering = [];
    await importShim(`./fixtures/es-modules/${module}`);
    assert.equal(exports.length, ordering.length);
    exports.forEach(function(name, index) {
      assert.equal(ordering[index], name);
    });
  }

  test('should execute in order', async function () {
    await assertLoadOrder('exec-order.js', ['a', 'b', 'c']);
  });

  test('should load in order (s)', async function () {
    await assertLoadOrder('s.js', ['b', 'a', 'c', 's']);
  });

  test('should load in order (_a)', async function () {
    await assertLoadOrder('_a.js', ['_d', '_c', '_b', '_g', '_a']);
  });

  test('should load in order (_h)', async function () {
    await assertLoadOrder('_h.js', ['_i', '_h']);
  });
});

suite('Export variations', function () {
  test('should resolve different export syntax', async function () {
    var m = await importShim('./fixtures/es-modules/export.js');
    assert.equal(m.p, 5);
    assert.equal(typeof m.foo, 'function');
    assert.equal(typeof m.q, 'object');
    assert.equal(typeof m.default, 'function');
    assert.equal(m.s, 4);
    assert.equal(m.t, 4);
    assert.equal(typeof m.m, 'object');
  });

  test('should resolve "export default"', async function () {
    var m = await importShim('./fixtures/es-modules/export-default.js');
    assert.equal(m.default(), 'test');
  });

  test('should support simple re-exporting', async function () {
    var m = await importShim('./fixtures/es-modules/reexport1.js');
    assert.equal(m.p, 5);
  });

  test('should support re-exporting binding', async function () {
    await importShim('./fixtures/es-modules/reexport-binding.js');
    var m = await importShim('./fixtures/es-modules/rebinding.js');
    assert.equal(m.p, 4);
  });

  test('should support re-exporting with a new name', async function () {
    var m = await importShim('./fixtures/es-modules/reexport2.js');
    assert.equal(m.q, 4);
    assert.equal(m.z, 5);
  });

  test('should support re-exporting', async function () {
    var m = await importShim('./fixtures/es-modules/export-star.js');
    assert.equal(m.foo, 'foo');
    assert.equal(m.bar, 'bar');
  });

  test('should support re-exporting overwriting', async function () {
    var m = await importShim('./fixtures/es-modules/export-star2.js');
    assert.equal(m.bar, 'bar');
    assert.equal(typeof m.foo, 'function');
  });

  test('import meta resolve', async function () {
    var m = await importShim('./fixtures/es-modules/import-meta-resolve.js');
    assert.equal(m.resolve('./export-star2.js'), new URL('./export-star2.js', m.url).href);
    assert.equal(m.resolve('test'), new URL('/test/fixtures/es-modules/es6-file.js', m.url).href);
    assert.equal(m.resolve('test/'), new URL('/test/fixtures/', m.url).href);
    assert.equal(m.resolve('test/sub/'), new URL('/test/fixtures/sub/', m.url).href);
    assert.equal(m.resolve('test/custom.css'), new URL('/test/fixtures/custom.css', m.url).href);
    assert.equal(m.resolve('test-dep'), new URL('/test/fixtures/test-dep.js', m.url).href);
    try {
      m.resolve('test-dep', new URL('https://other.com'));
      assert(false);
    }
    catch (e) {
      assert.equal(e.message.indexOf('Unable to resolve'), 0);
    }
  });
});

// These tests are order dependent, as importMap state will change when dynamic import maps are injected in the suite.
suite('Get import map', () => {
  test("should get correct import map state", async () => {
    const importMap = await importShim.getImportMap();

    const sortEntriesByKey = (entries) => [...entries].sort(([key1], [key2]) => key1.localeCompare(key2));
    const baseURL = document.location.href.replace(/\/test\/.*/, '/');

    assert.equal(JSON.stringify(Object.keys(importMap)), JSON.stringify(["imports", "scopes", "integrity"]));
    assert.equal(
      JSON.stringify(sortEntriesByKey(Object.entries(importMap.imports))),
      JSON.stringify(sortEntriesByKey(Object.entries({
        "test": baseURL + "test/fixtures/es-modules/es6-file.js",
        "test/": baseURL + "test/fixtures/",
        "global1": baseURL + "test/fixtures/es-modules/global1.js",
        "bare-dynamic-import": baseURL + "test/fixtures/es-modules/bare-dynamic-import.js",
        "react": "https://ga.jspm.io/npm:react@17.0.2/dev.index.js"
      })))
    );
    assert.equal(
      JSON.stringify(sortEntriesByKey(Object.entries(importMap.scopes))),
      JSON.stringify(sortEntriesByKey(Object.entries({
        [baseURL]: {
          "test-dep": baseURL + "test/fixtures/test-dep.js",
        },
        [baseURL + "test/fixtures/es-modules/import-relative-path.js"]: {
          [baseURL + "test/fixtures/es-modules/relative-path"]: baseURL + "test/fixtures/es-modules/es6-dep.js",
        },
        "https://ga.jspm.io/": {
          "object-assign": "https://ga.jspm.io/npm:object-assign@4.1.1/index.js",
        }
      })))
    );
  });
});

suite('Errors', function () {
  async function getImportError(module) {
    try {
      await importShim(module);
    }
    catch(e) {
      return e;
    }
    throw new Error('Test supposed to fail');
  }

  test('onerror hook worked correctly', async function () {
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.ok(window.e instanceof ReferenceError);
    assert.ok(window.e.toString().includes('syntax'));
  });

  test('should give a plain name error', async function () {
    var err = await getImportError('plain-name');
    assert.equal(err.toString().indexOf('Error: Unable to resolve specifier \'plain-name\' imported from'), 0);
  });

  test('should throw if on syntax error', async function () {
    Mocha.process.removeListener('uncaughtException');
    var err = await getImportError('./fixtures/es-modules/main.js');
    assert.equal(err.toString().toString(), 'dep error');
  });

  test('should throw what the script throws', async function () {
    var err = await getImportError('./fixtures/es-modules/deperror.js');
    assert.equal(err.toString(), 'dep error');
  });

  test('404 error', async function () {
    var err = await getImportError('./fixtures/es-modules/load-non-existent.js');
    assert(err.toString().startsWith('TypeError: 404 Not Found ' + new URL('./fixtures/es-modules/non-existent.js', baseURL).href));
  });

  test('network error should include response', async function () {
    var err = await getImportError('./fixtures/es-modules/load-non-existent.js');
    assert(err.response instanceof Response);
  });

  this.timeout(10000);

  test('Dynamic import map shim', async function () {
    insertDynamicImportMap({
      "imports": {
        "react-dom": "https://ga.jspm.io/npm:react-dom@17.0.2/dev.index.js"
      },
      "scopes": {
        "https://ga.jspm.io/": {
          "scheduler": "https://ga.jspm.io/npm:scheduler@0.20.2/dev.index.js",
          "scheduler/tracing": "https://ga.jspm.io/npm:scheduler@0.20.2/dev.tracing.js"
        }
      },
      "integrity": {
        "//ga.jspm.io/npm:scheduler@0.20.2/dev.index.js": "sha384-qF0Jy83btjdPADN4QLKKmk/aUUyJnDqT+kYomKiUQk4nWrBsHVkM67Pua+8nHYUt"
      }
    });
    const [React, ReactDOM] = await Promise.all([
      importShim('react'),
      importShim('react-dom'),
    ]);
    assert.ok(React);
    assert.ok(ReactDOM);
  });

  test('Dynamic import map shim 2', async function () {
    insertDynamicImportMap({
      "imports": {
          "lodash": "https://ga.jspm.io/npm:lodash-es@4.17.21/lodash.js",
      }
    });
    const lodash = await importShim("lodash");
    assert.ok(lodash);
  });

  test('Dynamic import map shim with override to the same mapping is allowed', async function () {
    const expectingNoError = new Promise((resolve, reject) => {
      window.addEventListener('error', (event) => {
        reject(event.error)
      });
      // waiting for 1 sec should be enough to make sure the error didn't happen.
      setTimeout(resolve, 1000)
    })

    const baseURL = document.location.href.replace(/\/test\/.*/, '/');
    const removeImportMap = insertDynamicImportMap({
      "imports": {
        "global1": baseURL + "test/fixtures/es-modules/global1.js"
      }
    });

    await expectingNoError;

    removeImportMap();
  });

  function insertDynamicImportMap(importMap) {
    const script = Object.assign(document.createElement('script'), {
      type: 'importmap-shim',
      innerHTML: JSON.stringify(importMap),
    });
    document.head.appendChild(script);
    return () => document.head.removeChild(script);
  }
});

suite('Source maps', () => {
  test('should include `//# sourceURL=` directive if one is not present in original module', async () => {
    const moduleURL = new URL("./fixtures/es-modules/without-source-url.js", location.href).href;
    await importShim(moduleURL);
    const moduleBlobURL = importShim._r[moduleURL].b
    const blobContent = await fetch(moduleBlobURL).then(r => r.text())
    assert(blobContent.includes(`//# sourceURL=${moduleURL}`))
  });

  test('should replace relative paths in `//# sourceURL=` directive with absolute URL', async () => {
    const moduleURL = new URL('./fixtures/es-modules/with-relative-source-url.js', location.href).href;
    await importShim(moduleURL);
    const moduleBlobURL = importShim._r[moduleURL].b;
    const blobContent = await fetch(moduleBlobURL).then(r => r.text());
    const sourceURL = new URL('module.ts', moduleURL).href;
    assert(blobContent.endsWith(`//# sourceURL=${sourceURL}`));
    // Should not touch any other occurrences of `//# sourceURL=` in the code.
    assert(blobContent.includes('//# sourceURL=i-should-not-be-affected.no'));
  });

  test('should replace relative paths in `//# sourceMappingURL=` directive with absolute URL and add `//# sourceURL=`', async () => {
    const moduleURL = new URL('./fixtures/es-modules/with-relative-source-mapping-url.js', location.href).href;
    await importShim(moduleURL);
    const moduleBlobURL = importShim._r[moduleURL].b;
    const blobContent = await fetch(moduleBlobURL).then(r => r.text());
    const sourceMappingURL = new URL('./with-relative-source-mapping-url.js.map', moduleURL).href;
    assert(blobContent.endsWith(
        `//# sourceMappingURL=${sourceMappingURL}\n//# sourceURL=${moduleURL}`
    ));

    // Should not touch any other occurrences of `//# sourceMappingURL=` in the code.
    assert(blobContent.includes('//# sourceMappingURL=i-should-not-be-affected.no'));
  });

  test('should keep original absolute URL in `//# sourceMappingURL=` directive and add `//# sourceURL=`', async () => {
    const moduleURL = new URL('./fixtures/es-modules/with-absolute-source-mapping-url.js', location.href).href;
    await importShim(moduleURL);
    const moduleBlobURL = importShim._r[moduleURL].b;
    const blobContent = await fetch(moduleBlobURL).then(r => r.text());
    assert(blobContent.endsWith(
        `//# sourceMappingURL=https://example.com/module.js.map\n//# sourceURL=${moduleURL}`
    ));

    // Should not touch any other occurrences of `//# sourceMappingURL=` in the code.
    assert(blobContent.includes('//# sourceMappingURL=i-should-not-be-affected.no'));
  });

  test('should preserve existing sourceURL if both sourceURL and sourceMappingURL already exist', async () => {
    const moduleURL = new URL('./fixtures/es-modules/with-source-url-and-source-mapping-url.js', location.href).href;
    await importShim(moduleURL);
    const moduleBlobURL = importShim._r[moduleURL].b;
    const blobContent = await fetch(moduleBlobURL).then(r => r.text());
    assert(blobContent.endsWith(
        `//# sourceURL=${new URL('/with-source-url-and-source-mapping-url.js', window.location.origin)}\n//# sourceMappingURL=https://example.com/module.js.map`
    ));

    // Should not touch any other occurrences of `//# sourceURL=` in the code.
    assert(blobContent.includes('//# sourceURL=i-should-not-be-affected.no'));
  });
});


suite('Fetch hook', () => {
  test('Should hook fetch', async function () {
    const baseFetchHook = window.fetchHook;
    window.fetchHook = async (url, options) => {
      if (!url.endsWith('.jsx'))
        return fetch(url, options);
      const res = await fetch(url);
      const text = await res.text();
      return new Response(new Blob(['export default `' + text + '`']), {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' }
      });
    };

    var m = await importShim('./fixtures/transform.js');
    window.fetchHook = baseFetchHook;
    assert(m.default);
    assert.equal(m.default, 'Totally JSX\n');
  });
});


suite('Resolve hook', () => {
  test('Should hook resolve', async function () {
    const resolveHook = window.resolveHook;
    window.resolveHook = async (id, parentUrl, defaultResolve) => {
      if (id === 'resolveTestModule') {
        return defaultResolve('./fixtures/es-modules/es6.js', parentUrl);
        // OR just resolve by yourself like this:
        // return new URL('./fixtures/es-modules/es6.js', location.href).href;
      }
    };

    var m = await importShim('resolveTestModule');
    window.resolveHook = resolveHook;
    assert(m.p);
  });
});
