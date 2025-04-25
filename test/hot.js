function syntheticResponse (contents, contentType = 'text/javascript') {
  return {
    status: 200,
    ok () {
      return true;
    },
    headers: new Headers({ 'content-type': contentType }),
    text () {
      return contents;
    }
  };
}

const HOT_WAIT = 1000;

let jsonSource = '{ "json": "module" }';
let cssSource = 'body { background-color: mistyrose }';
let hotreloadSource = 'export var p = 5';

suite('Hot reloading tests', () => {
  test('Hot reload', async function () {
    const mod = await importShim('test/hotreload-parent.js');
    assert.equal(mod.getP(), 10);
    assert.equal(window.hotReloadParentCnt, 1);
    assert.ok(!window.disposed);
    hotFetch = (url, opts) => {
      if (url.includes('test/fixtures/hotreload.js')) {
        return syntheticResponse(hotreloadSource);
      }
      if (url.includes('test/fixtures/sheet.css')) {
        return syntheticResponse(cssSource, 'text/css');
      }
      if (url.includes('test/fixtures/json.json')) {
        return syntheticResponse(jsonSource, 'text/json');
      }
      return fetch(url, opts);
    };
    importShim.hotReload('fixtures/hotreload.js');
    await new Promise(resolve => setTimeout(resolve, HOT_WAIT));
    assert.equal(mod.getP(), 5);
    assert.equal(window.disposed, true);
    assert.equal(window.hotReloadParentCnt, 1);
  });

  test('CSS Hot reload', async function () {
    importShim.hotReload('fixtures/sheet.css');
  });

  test('JSON Hot reload', async function () {
    const m = await importShim('test/json-assertion.js');
    assert.equal(m.m.json, 'module');
    jsonSource = '{ "json": "hot" }';
    importShim.hotReload('fixtures/json.json');
    await new Promise(resolve => setTimeout(resolve, HOT_WAIT));
    assert.equal(m.m.json, 'hot');
    jsonSource = '{ "json": "hot2" }';
    importShim.hotReload('fixtures/json.json');
    await new Promise(resolve => setTimeout(resolve, HOT_WAIT));
    assert.equal(m.m.json, 'hot2');
  });

  test('Accept invalidate', async function () {
    window.acceptInvalidate = true;
    assert.equal(window.hotReloadParentCnt, 1);
    importShim.hotReload('fixtures/hotreload.js');
    await new Promise(resolve => setTimeout(resolve, HOT_WAIT));
    assert.equal(window.hotReloadParentCnt, 2);
  });

  test('Deps accept', async function () {
    const m = await importShim('test/hotreload-accept-dep.js');
    assert.equal(window.depUpdated, false);
    assert.equal(window.hotReloadAcceptDepCnt, 1);
    importShim.hotReload('fixtures/hotreload.js');
    await new Promise(resolve => setTimeout(resolve, HOT_WAIT));
    assert.equal(window.depUpdated, true);
    assert.equal(window.hotReloadAcceptDepCnt, 1);
  });
});
