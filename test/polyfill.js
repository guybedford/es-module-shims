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

  test.skip('should support json imports', async function () {
    const { m } = await importShim('./fixtures/json-assertion.js');
    assert.equal(m, 'module');
  });

  test('URL mappings do not cause double execution', async function () {
    await importShim('./fixtures/es-modules/dynamic-parent.js');
    if (window.dynamic)
      console.log('POLYFILL');
    if (window.dynamicUrlMap)
      console.log('NATIVE');
    assert.equal(window.dynamic || window.dynamicUrlMap, true);
    assert.equal(Boolean(window.dynamic && window.dynamicUrlMap), false);
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

  test('DOMContentLoaded fires only once', async function () {
    assert.equal(window.domLoad, 1);
  });
});
