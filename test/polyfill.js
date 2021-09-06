suite('Polyfill tests', () => {
  test('should support dynamic import with an import map', async function () {
    let err;
    window.onerror = e => err = e;
    await new Promise(resolve => {
      let first = true;
      document.head.appendChild(Object.assign(document.createElement('script'), {
        type: 'module',
        src: './fixtures/es-modules/importer1.js',
        onload () {
          // Firefox gets two "onload" events
          // The first is the native error which we need to ignore
          if (first && err)
            first = false;
          else
            resolve();
        }
      }));
    });
    assert.equal(window.global1, true);
  });
});
