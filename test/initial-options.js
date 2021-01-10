suite('Initial options', () => {
  test('Should apply initial options', async function () {
    self.esmsInitOptions = {
      fetch: (url) => fetch(url),
      skip: /.*/,
      onerror: (error) => console.log(error)
    };

    await import('../src/es-module-shims.js');

    assert.equal(self.esmsInitOptions.fetch, self.importShim.fetch);
    assert.equal(self.esmsInitOptions.skip, self.importShim.skip);
    assert.equal(self.esmsInitOptions.onerror, self.importShim.onerror);
  });
});