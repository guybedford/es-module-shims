const nonceScript = document.querySelector('script[nonce]');
const nonce = nonceScript && nonceScript.getAttribute('nonce');

async function loadModuleScript (src) {
  window.onerror = () => {};
  await new Promise(resolve => {
    let first = true;
    const s = Object.assign(document.createElement('script'), {
      type: 'module',
      src,
      onerror () {
        if (first) first = false;
        else resolve();
      },
      onload () {
        if (first) first = false;
        else resolve();
      }
    });
    s.setAttribute('nonce', nonce);
    document.head.appendChild(s);
  });
}

suite('Polyfill tests', () => {
  test('should support dynamic import with an import map', async function () {
    await loadModuleScript('./fixtures/es-modules/importer1.js');
    assert.equal(window.global1, true);
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
