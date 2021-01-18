suite('Initial options', () => {
  test('Should apply initial options', async function () {
    self.esmsInitOptions = {
      fetch: (url) => fetch(url),
      skip: /.*/,
      onerror: (error) => console.log(error)
    };

    await import('../src/es-module-shims.js');

    assert.equal(self.esmsInitOptions.fetch, self._esmsState.fetch);
    assert.equal(self.esmsInitOptions.skip, self._esmsState.skip);
    assert.equal(self.esmsInitOptions.onerror, self._esmsState.onerror);
  });
});