suite('Initial options', () => {
  test('Should apply initial options', async function () {
    self.importShimInitialOptions = {
      fetch: (url) => fetch(url),
      skip: /.*/,
      onerror: (error) => console.log(error)
    };

    await import('../src/es-module-shims.js');

    assert.equal(self.importShimInitialOptions.fetch, self.importShim.fetch);
    assert.equal(self.importShimInitialOptions.skip, self.importShim.skip);
    assert.equal(self.importShimInitialOptions.onerror, self.importShim.onerror);
  });
});