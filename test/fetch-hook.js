
suite('Fetch hook', () => {
  test('Should hook fetch', async function () {
    const baseFetchHook = window.fetchHook;
    window.fetchHook = async (url) => {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText} ${response.url}`);
      const contentType = response.headers.get('content-type');
      if (!/^application\/json($|;)/.test(contentType))
        return response;
      const reader = response.body.getReader();
      return new Response(new ReadableStream({
        async start (controller) {
          let done, value;
          controller.enqueue(new Uint8Array([...'export default '].map(c => c.charCodeAt(0))));
          while (({ done, value } = await reader.read()) && !done) {
            controller.enqueue(value);
          }
          controller.close();
        }
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/javascript"
        }
      });
    };

    var m = await importShim('./fixtures/json-or-js.js');
    window.fetchHook = baseFetchHook;
    assert(m.default);
    assert.equal(m.default.json, 'module');
  });
});
