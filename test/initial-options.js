suite('Initial options', () => {
  test('Should apply initial options', async function () {
    const esmsInitOptions = {
      fetch: (url) => fetch(url),
      skip: /.*/,
      onerror: (error) => console.log(error)
    };

    self.esmsInitOptions = esmsInitOptions

    await import('../src/es-module-shims.js');

    assert.equal(esmsInitOptions.fetch, self._esmsState.fetch);
    assert.equal(esmsInitOptions.skip, self._esmsState.skip);
    assert.equal(esmsInitOptions.onerror, self._esmsState.onerror);
  });
});