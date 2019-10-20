
suite('Fetch hook', () => {
  importShim.fetch = async function (url) {
    if (!url.endsWith('json-or-js.js'))
      return fetch(url);
    const response = await fetch(url);
    const reader = response.body.getReader();
    console.log('--');
    return new Response(new ReadableStream({
      async start (controller) {
        let done, value;
        while (({ done, value } = await reader.read()) && !done) {
          controller.enqueue(value);
        }
        controller.close();
      }
    }), {
      status: 200,
      statusText: 'CRAP',
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
  test('Should hook fetch', async function () {
    var m = await importShim('./fixtures/json-or-js.js');
    assert(m.default);
    assert.equal(m.default.a, 'b');
  });
});
