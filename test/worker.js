suite('Worker', () => {
  test(`should create a worker type=classic and then receive a message containing the string 'classic'`, async () => {
    const worker = new WorkerShim("./fixtures/worker/clasic-worker.js", {
      name: 'classic-worker'
    });

    const result = await new Promise((resolve, reject) => {
      // set a timeout to resolve the promise if the worker doesn't 'respond'
      const timeoutId = setTimeout(() => {
        resolve(null);
        }, 2000);

      worker.onmessage = (e) => {
        clearTimeout(timeoutId);

        resolve(e.data);
      };

      worker.onerror = (e) => {
        clearTimeout(timeoutId);
        resolve(null);
      }
    });

    assert.equal(result, 'classic');
  });

  test('should create worker type=module and then receive a message containing the result of a bare import', async () => {
    const worker = new WorkerShim("./fixtures/worker/module-worker.js", {
      type: 'module',
      name: 'test_import_map',
      importMap: self.importMapShim
    });

    const result = await new Promise((resolve, reject) => {
      // set a timeout to resolve the promise if the worker doesn't 'respond'
      const timeoutId = setTimeout(() => {
        resolve(null);
        }, 2000);

      worker.onmessage = (e) => {
        clearTimeout(timeoutId);
        resolve(e.data);
      };

      worker.onerror = (e) => {
        clearTimeout(timeoutId);
        resolve(null);
      }
    });

    assert.equal(result, 4);
  });
});
