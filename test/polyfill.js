suite('Polyfill tests', () => {
  test('should support dynamic import with an import map', async function () {
    window.onerror = () => {};
    const x = await new Promise(resolve => document.head.appendChild(Object.assign(document.createElement('script'), {
      type: 'module',
      src: './fixtures/es-modules/importer1.js',
      onload: resolve
    })));
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(window.global1, true);
  });
});
