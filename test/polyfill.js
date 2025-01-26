const supportsTlaPromise = (async () => {
  let supportsTla = false;
  try {
    await eval("import('./fixtures/tla.js');");
    supportsTla = true;
  } catch (e) {
    console.log(e);
  }
  return supportsTla;
})();

suite('Polyfill tests', () => {
  test('should support dynamic import with an import map', async function () {
    const p = new Promise(resolve => window.done = resolve);
    await importShim('./fixtures/es-modules/importer1.js');
    await p;
  });

  test('should support dyanmic import failure', async function () {
    try {
      await import('./fixtures/es-modules/does-not-exist.js');
    }
    catch (e) {
      try {
        await importShim('./fixtures/es-modules/does-not-exist.js');
      }
      catch (e) {
        return;
      }
      throw new Error('Should fail twice');
    }
    throw new Error('Should fail');
  });

  test('should support multiple import maps', async function () {
    await importShim('global1');
  });

  test('should support css imports', async function () {
    const m = await importShim('./fixtures/sheet.css', { 'with': { type: 'css' } });
    assert.ok(m['default'] instanceof CSSStyleSheet);
  });

  test('should support json imports', async function () {
    const { m } = await importShim('./fixtures/json-assertion.js');
    assert.equal(m.json, 'module');
    let maybeNative;
    try {
      maybeNative = await eval("import('./fixtures/json.json', { with: { type: 'json' } })");
    } catch {}
    if (maybeNative && !window.noEval) {
      maybeNative.default.json = 'mutated';
      assert.equal(m.json, 'mutated');
    }
  });

  test('URL mappings do not cause double execution', async function () {
    await importShim('./fixtures/es-modules/dynamic-parent.js');
    assert.equal(window.dynamicUrlMap, true);
    assert.equal(window.dynamic, undefined);
  });

  test('should support wasm imports', async function () {
    const supportsTla = await supportsTlaPromise;
    if (!supportsTla) return;
    const { add } = await importShim('./fixtures/wasm-import.js');
    assert.equal(typeof add, 'function');
  });

  test('should support source phase imports', async function () {
    const supportsTla = await supportsTlaPromise;
    if (!supportsTla) return;
    const { add } = await importShim('./fixtures/source-phase-import.js');
    assert.equal(typeof add, 'function');
  });

  test('should support dynamic source phase imports', async function () {
    const supportsTla = await supportsTlaPromise;
    if (!supportsTla) return;
    const { add } = await importShim('./fixtures/source-phase-import.js');
    assert.equal(typeof add, 'function');
  });

  test('import maps passthrough polyfill mode', async function () {
    await importShim('test');
  });

  test('Shared instances', async function () {
    const { check } = await importShim('./fixtures/instance-case.js');
    const result = await check();
    assert.equal(result, true);
  });

  test('Polyfill engagement', async function () {
    if (window.cnt > 1)
      throw new Error(`Polyfill engaged despite native implementation`);
    assert.equal(window.cnt, 1);
  });

  test('DOMContentLoaded fires at least once', async function () {
    assert.ok(window.domLoad === 1 || window.domLoad === 2);
  });
});

// adapted from wasm/jsapi/module/moduleSource.tentative.any.js
suite('Source Phase WPT', () => {
  const emptyModuleBinary = new Uint8Array([0,97,115,109,1,0,0,0]);
  
  test("AbstractModuleSource not defined", () => {
    assert.equal(typeof AbstractModuleSource, "undefined");
  });

  test("AbstractModuleSource intrinsic", () => {
    const AbstractModuleSource = Object.getPrototypeOf(WebAssembly.Module);
    assert.equal(AbstractModuleSource.name, "AbstractModuleSource");
    assert.ok(AbstractModuleSource !== Function);
  });
  
  test("AbstractModuleSourceProto intrinsic", () => {
    const AbstractModuleSourceProto = Object.getPrototypeOf(WebAssembly.Module.prototype);
    assert.ok(AbstractModuleSourceProto !== Object.prototype);
    const AbstractModuleSource = Object.getPrototypeOf(WebAssembly.Module);
    assert.equal(AbstractModuleSource.prototype, AbstractModuleSourceProto);
  });
  
  test("AbstractModuleSourceProto toStringTag brand check", () => {
    const module = new WebAssembly.Module(emptyModuleBinary);
  
    const AbstractModuleSource = Object.getPrototypeOf(WebAssembly.Module);
    const toStringTag = Object.getOwnPropertyDescriptor(AbstractModuleSource.prototype, Symbol.toStringTag).get;
  
    assert.equal(toStringTag.call(module), "WebAssembly.Module");

    try {
      toStringTag.call({});
      assert.fail("expected an error");
    } catch (e) {
      assert.ok(e instanceof TypeError);
    }
  });
});
