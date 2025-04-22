test('should revoke blob URLs if `esmsInitOptions.revokeBlobURLs` is set to `true`', async () => {
    await importShim("/test/fixtures/test.ts");

    const moduleURL = new URL('/test/fixtures/test.ts', location.href).href;

    // must be on an old browser to test!
    if (!importShim._r[moduleURL])
        return;

    const moduleBlobURL = importShim._r[moduleURL].b;
    assert(moduleBlobURL.startsWith("blob:http"));

    await Promise.all([
        fetch(moduleBlobURL)
    ]).catch(() => fail('blob URLs should be revoked in a non-blocking way, AFTER the import is resolved'));

    // Give the scheduled cleanup a chance to be completed.
    await new Promise(resolve => setTimeout(resolve, 500));

    await Promise.all([
        fetch(moduleBlobURL)
    ]).then(
        () => { fail('blob URLs should already be revoked') },
        (err) => { assert(!!err) }
    )
});
