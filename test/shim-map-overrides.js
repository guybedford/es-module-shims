const edge = !!navigator.userAgent.match(/Edge\/\d\d\.\d+$/);

self.baseURL = location.href.substr(0, location.href.lastIndexOf('/') + 1);

suite('Shim override tests', () => {
  test('Dynamic import map shim with override is allowed when enabled', async function () {
    const expectingNoError = new Promise((resolve, reject) => {
      window.addEventListener('error', (event) => reject(event.error))
      // waiting for 1 sec should be enough to make sure the error didn't happen.
      setTimeout(resolve, 1000)
    })

    const removeImportMap = insertDynamicImportMap({
      "imports": {
        "global1": "http://localhost:8080/test/fixtures/es-modules/a.js"
      }
    });

    await expectingNoError;

    removeImportMap();
  })

  function insertDynamicImportMap(importMap) {
    const script = Object.assign(document.createElement('script'), {
      type: 'importmap-shim',
      innerHTML: JSON.stringify(importMap),
    });
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }
})

