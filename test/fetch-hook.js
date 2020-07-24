
suite('Fetch hook', () => {
  importShim.fetch = async function (url) {
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
  }
  test('Should hook fetch', async function () {
    var m = await importShim('./fixtures/json-or-js.js');
    assert(m.default);
    assert.equal(m.default.json, 'module');
  });
});
