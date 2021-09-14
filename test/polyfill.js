async function loadModuleScript (src) {
  window.onerror = () => {};
  await new Promise(resolve => {
    let first = true;
    document.head.appendChild(Object.assign(document.createElement('script'), {
      type: 'module',
      src,
      onload () {
        if (first) first = false;
        else resolve();
      }
    }));
  });
}

suite('Polyfill tests', () => {
  test('should support dynamic import with an import map', async function () {
    await loadModuleScript('./fixtures/es-modules/importer1.js');
    assert.equal(window.global1, true);
  });

  test('should support css imports', async function () {
    await loadModuleScript('./fixtures/css-assertion.js');
    assert.equal(window.cssAssertion, true);
  });

  test('URL mappings do not cause double execution', async function () {
    await loadModuleScript('./fixtures/es-modules/dynamic-parent.js');
    if (window.dynamic)
      console.log('POLYFILL');
    if (window.dynamicUrlMap)
      console.log('NATIVE');
    assert.equal(window.dynamic || window.dynamicUrlMap, true);
    assert.equal(Boolean(window.dynamic && window.dynamicUrlMap), false);
  });
});
