suite('Basic loading tests', () => {
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