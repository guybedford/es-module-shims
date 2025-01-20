suite('TypeScript loading tests', () => {
  test('Static TS script', async function () {
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.ok(globalThis.executedTs === true);
  });
  test('Basic type stripping', async function () {
    const { fn } = await importShim('/test/fixtures/test-dep.ts');
    assert.ok(fn() === 5);
  });
  test('TypeScript with CSS dependency', async function () {
    const { style, getStyle, p } = await importShim('/test/fixtures/ts-loading-css.ts');
    assert.ok(p === 50);
    assert.ok((await getStyle()).default instanceof CSSStyleSheet);
  });
});
