suite('TypeScript loading tests', () => {
  test('Static TS script', async function () {
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.ok(globalThis.executedTs === true);
  });
  test('Basic type stripping', async function () {
    const { fn } = await importShim('/test/fixtures/test-dep.ts');
    assert.ok(fn() === 5);
  });
});
