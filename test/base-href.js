suite('Base href', () => {
  test(`should should resolve relative to base href`, async () => {
    window.onerror = () => {};
    const m = await importShim('./base-href-relative.js');
    assert.equal(m.default, 'base href relative');
  });

  test('should resolve import map relative to base href', async () => {
    window.onerror = () => {};
    const m = await importShim('base-href-bare');
    assert.equal(m.default, 'base href bare');
  });
});
