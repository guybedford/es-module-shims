
suite('Resolve hook', () => {
  test('Should hook resolve', async function () {
    globalThis.esmsInitOptions = {
      resolve: async function (id, parentUrl, defaultResolver) {
        if (id === 'resolveTestModule') {
          return './fixtures/es-modules/es6.js';
        }
      }
    };

    await import('../src/es-module-shims.js');
    var m = await importShim('resolveTestModule');
    assert(m.p);
  });
});
