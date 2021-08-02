
suite('Resolve hook', () => {
  test('Should hook resolve', async function () {
    const resolveHook = window.resolveHook;
    window.resolveHook = async (id, parentUrl, defaultResolve) => {
      if (id === 'resolveTestModule') {
        return defaultResolve('./fixtures/es-modules/es6.js', parentUrl);
        // OR just resolve by yourself like this:
        // return new URL('./fixtures/es-modules/es6.js', location.href).href;
      }
    };

    var m = await importShim('resolveTestModule');
    window.resolveHook = resolveHook;
    assert(m.p);
  });
});
