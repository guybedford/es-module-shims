
suite('Resolve hook', () => {
  test('Should hook resolve', async function () {
    globalThis.esmsInitOptions = {
      resolve: async function (id, parentUrl, defaultResolver) {
        if (id === 'resolveTestModule') {
          return defaultResolver('./fixtures/es-modules/es6.js', parentUrl);
          // OR just resolve by yourself like this:
          // return new URL('./fixtures/es-modules/es6.js', location.href).href;
        }
      }
    };

    await import('../src/es-module-shims.js');
    var m = await importShim('resolveTestModule');
    assert(m.p);
  });
});
