const edge = !!navigator.userAgent.match(/Edge\/\d\d\.\d+$/);

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
    if (!edge)
      assert.equal(typeof m.a, 'function');
    assert.equal(m.b, 4);
    assert.equal(m.c, 5);
    assert.equal(m.d, 4);
    if (!edge) {
      assert.equal(typeof m.q, 'object');
      assert.equal(typeof m.q.foo, 'function');
    }
  });

  test('should support import.meta.url', async function () {
    var m = await importShim('./fixtures/es-modules/moduleName.js');
    assert.equal(m.name, new URL('./fixtures/es-modules/moduleName.js', baseURL).href);
  });

  test('should support import assertions', async function () {
    var m = await importShim('./fixtures/json-assertion.js');
    assert.equal(m.m, 'module');
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
    await new Promise(resolve => document.head.appendChild(Object.assign(document.createElement('script'), {
      type: 'module-shim',
      src: './fixtures/es-modules/importer1.js',
      onload: resolve
    })));
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(window.global1, true);
  });

  test('Should import a module via a full url, with scheme', async function () {
    const url = window.location.href.replace('/test-shim.html', '/fixtures/es-modules/no-imports.js');
    assert.equal(url.slice(0, 4), 'http');
    var m = await importShim(url);
    assert(m);
    assert.equal(m.asdf, 'asdf');
  });

  test('Should import a module via a full url, without scheme', async function () {
    const url = window.location.href
      .replace('/test-shim.html', '/fixtures/es-modules/no-imports.js')
      .replace(/^http(s)?:/, '');
    assert.equal(url.slice(0, 2), '//');
    var m = await importShim(url);
    assert(m);
    assert.equal(m.asdf, 'asdf');
  });

  test("Should import a module via a relative path re-mapped with importmap's scopes", async function () {
    const url = window.location.href
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
  test('should resolve circular dependencies', async function () {
    var m = await importShim('./fixtures/test-cycle.js');
    assert.equal(m.default, 'f');
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
    assert.equal(await m.resolve('./export-star2.js'), new URL('./export-star2.js', m.url).href);
    assert.equal(await m.resolve('test'), new URL('/test/fixtures/es-modules/es6-file.js', m.url).href);
    assert.equal(await m.resolve('test/'), new URL('/test/fixtures/', m.url).href);
    assert.equal(await m.resolve('test/sub/'), new URL('/test/fixtures/sub/', m.url).href);
    assert.equal(await m.resolve('test/custom.css'), new URL('/test/fixtures/custom.css', m.url).href);
    assert.equal(await m.resolve('test-dep'), new URL('/test/fixtures/test-dep.js', m.url).href);
    try {
      await m.resolve('test-dep', new URL('https://other.com'));
      assert(false);
    }
    catch (e) {
      assert.equal(e.message.indexOf('Unable to resolve'), 0);
    }
  });
});

suite('Errors', function () {
  async function getImportError(module) {
    try {
      await importShim(module);
    }
    catch(e) {
      return e.toString();
    }
    throw new Error('Test supposed to fail');
  }

  test('onerror hook worked correctly', async function () {
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(window.e.toString(), 'ReferenceError: syntax is not defined');
  });

  test('should give a plain name error', async function () {
    var err = await getImportError('plain-name');
    assert.equal(err.indexOf('Error: Unable to resolve specifier \'plain-name\' from'), 0);
  });

  test('should throw if on syntax error', async function () {
    Mocha.process.removeListener('uncaughtException');
    var err = await getImportError('./fixtures/es-modules/main.js');
    assert.equal(err.toString(), 'dep error');
  });

  test('should throw what the script throws', async function () {
    var err = await getImportError('./fixtures/es-modules/deperror.js');
    assert.equal(err, 'dep error');
  });

  test('404 error', async function () {
    var err = await getImportError('./fixtures/es-modules/load-non-existent.js');
    assert(err.toString().startsWith('Error: 404 Not Found ' + new URL('./fixtures/es-modules/non-existent.js', baseURL).href));
  });

  this.timeout(10000);
  test('Dynamic import map shim', async () => {
    insertDynamicImportMap({
        "imports": {
            "react-dom": "https://ga.jspm.io/npm:react-dom@17.0.2/dev.index.js"
        },
        "scopes": {
            "https://ga.jspm.io/": {
                "scheduler": "https://ga.jspm.io/npm:scheduler@0.20.2/dev.index.js",
                "scheduler/tracing": "https://ga.jspm.io/npm:scheduler@0.20.2/dev.tracing.js"
            }
        }
    });
    const [React, ReactDOM] = await Promise.all([
        importShim('react'),
        importShim('react-dom'),
    ]);

    assert.ok(React);
    assert.ok(ReactDOM);

    await new Promise(resolve => setTimeout(resolve, 1000));
    insertDynamicImportMap({
        "imports": {
            "lodash": "https://ga.jspm.io/npm:lodash-es@4.17.21/lodash.js",
        }
    });

    const lodash = await importShim("lodash");
    assert.ok(lodash);

    function insertDynamicImportMap(importMap) {
      document.body.appendChild(Object.assign(document.createElement('script'), {
          type: 'importmap-shim',
          innerHTML: JSON.stringify(importMap)
      }));
    }
  });
});

suite('Source maps', () => {
  test('should include `//# sourceURL=` directive if one is not present in original module', async () => {
    const moduleURL = new URL("./fixtures/es-modules/without-source-url.js", location.href).href;
    await importShim(moduleURL);
    const moduleBlobURL = window._esmsr[moduleURL].b
    const blobContent = await fetch(moduleBlobURL).then(r => r.text())
    assert(blobContent.includes(`//# sourceURL=${moduleURL}`))
  });

  test('should replace relative paths in `//# sourceURL=` directive with absolute URL', async () => {
    const moduleURL = new URL('./fixtures/es-modules/with-relative-source-url.js', location.href).href;
    await importShim(moduleURL);
    const moduleBlobURL = window._esmsr[moduleURL].b;
    const blobContent = await fetch(moduleBlobURL).then(r => r.text());
    const sourceURL = new URL('module.ts', moduleURL).href;
    assert(blobContent.endsWith(`//# sourceURL=${sourceURL}`));
    // Should not touch any other occurrences of `//# sourceURL=` in the code.
    assert(blobContent.includes('//# sourceURL=i-should-not-be-affected.no'));
  });

  test('should replace relative paths in `//# sourceMappingURL=` directive with absolute URL and add `//# sourceURL=`', async () => {
    const moduleURL = new URL('./fixtures/es-modules/with-relative-source-mapping-url.js', location.href).href;
    await importShim(moduleURL);
    const moduleBlobURL = window._esmsr[moduleURL].b;
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
    const moduleBlobURL = window._esmsr[moduleURL].b;
    const blobContent = await fetch(moduleBlobURL).then(r => r.text());
    assert(blobContent.endsWith(
        `//# sourceMappingURL=https://example.com/module.js.map\n//# sourceURL=${moduleURL}`
    ));

    // Should not touch any other occurrences of `//# sourceMappingURL=` in the code.
    assert(blobContent.includes('//# sourceMappingURL=i-should-not-be-affected.no'));
  });
});


suite('Fetch hook', () => {
  test('Should hook fetch', async function () {
    const baseFetchHook = window.fetchHook;
    window.fetchHook = async (url) => {
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
    };

    var m = await importShim('./fixtures/json-or-js.js');
    window.fetchHook = baseFetchHook;
    assert(m.default);
    assert.equal(m.default.json, 'module');
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
