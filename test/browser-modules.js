suite('Basic loading tests', () => {
  test('Should import a module', async function () {
    var m = await importShim('./fixtures/es-modules/no-imports.js');
    assert(m);
    assert.equal(m.asdf, 'asdf');
  });

  test('Should import the fallback for a built-in module', async function () {
    var m = await importShim('std:built-in');
    assert(m);
    assert.equal(m.fallback, 'fallback');
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

  test('should import json', async function () {
    var m = await importShim('./fixtures/json.json');
    assert.equal(m.default.json, 'module');
  }); 

  test('should throw json parse errors', async function () {
    try {
      await importShim('./fixtures/json-error.json');
    }
    catch (e) {
      assert(e instanceof SyntaxError);
    }
    try {
      await importShim('./fixtures/json-error.json');
    }
    catch (e) {
      assert(e instanceof SyntaxError);
    }
  });

  test('should import css', async function () {
    var m = await importShim('./fixtures/style.css');
    assert(m.default);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, m.default];
  })

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

  test('should support dynamic import', async function () {
    var m = await importShim('./fixtures/es-modules/dynamic-import.js');
    var dynamicModule = await m.doImport();

    assert.equal(m.before, 'before');
    assert.equal(m.after, 'after');
    assert.equal(dynamicModule.default, 'bareDynamicImport');
  });

  test('Should import a module via a full url, with scheme', async function () {
    const url = window.location.href.replace('/test.html', '/fixtures/es-modules/no-imports.js');
    assert.equal(url.slice(0, 4), 'http');
    var m = await importShim(url);
    assert(m);
    assert.equal(m.asdf, 'asdf');
  });

  test('Should import a module via a full url, without scheme', async function () {
    const url = window.location.href
      .replace('/test.html', '/fixtures/es-modules/no-imports.js')
      .replace(/^http(s)?:/, '');
    assert.equal(url.slice(0, 2), '//');
    var m = await importShim(url);
    assert(m);
    assert.equal(m.asdf, 'asdf');
  });

  test('Should import a module via data url', async function () {
    var m = await importShim('data:text/plain;charset=utf-8;base64,ZXhwb3J0IHZhciBhc2RmID0gJ2FzZGYnOw0KZXhwb3J0IHZhciBvYmogPSB7fTs=');
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
    var m = await importShim('./fixtures/es-modules/' + module);
    exports.forEach(function(name) {
      assert.equal(m[name], name);
    });
  }

  test('should load in order (a)', async function () {
    await assertLoadOrder('a.js', ['a', 'b']);
  });

  test('should load in order (c)', async function () {
    await assertLoadOrder('c.js', ['c', 'a', 'b']);
  });

  test('should load in order (s)', async function () {
    await assertLoadOrder('s.js', ['s', 'c', 'a', 'b']);
  });

  test('should load in order (_a)', async function () {
    await assertLoadOrder('_a.js', ['b', 'd', 'g', 'a']);
  });

  test('should load in order (_e)', async function () {
    await assertLoadOrder('_e.js', ['c', 'e']);
  });

  test('should load in order (_f)', async function () {
    await assertLoadOrder('_f.js', ['g', 'f']);
  });

  test('should load in order (_h)', async function () {
    await assertLoadOrder('_h.js', ['i', 'a', 'h']);
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

  test('should give a plain name error', async function () {
    var err = await getImportError('plain-name');
    assert.equal(err.indexOf('Error: Unable to resolve bare specifier "plain-name" from'), 0);
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

});

suite('wasm', () => {
  test('Loads WASM', async () => {
    const m = await importShim('/test/fixtures/wasm/example.wasm');
    assert.equal(m.exampleExport(1), 2);
  });
});
