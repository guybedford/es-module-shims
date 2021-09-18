test('should revoke blob URLs if `esmsInitOptions.revokeBlobURLs` is set to `true`', async () => {
    await importShim("es-modules/es6-withdep.js");

    const moduleURL = new URL('./fixtures/es-modules/es6-withdep.js', location.href).href;
    const moduleDepURL = new URL('./fixtures/es-modules/es6-dep.js', location.href).href;

    // must be on an old browser to test!
    if (!window._esmsr[moduleDepURL])
        return;

    const moduleBlobURL = window._esmsr[moduleURL].b;
    const moduleDepBlobURL = window._esmsr[moduleDepURL].b;
    assert(moduleBlobURL.startsWith("blob:http"));
    assert(moduleDepBlobURL.startsWith("blob:http"));

    await Promise.all([
        fetch(moduleBlobURL),
        fetch(moduleDepBlobURL)
    ]).catch(() => fail('blob URLs should be revoked in a non-blocking way, AFTER the import is resolved'));

    // Give the scheduled cleanup a chance to be completed.
    await new Promise(resolve => setTimeout(resolve, 500));

    await Promise.all([
        fetch(moduleBlobURL),
        fetch(moduleDepBlobURL)
    ]).then(
        () => { fail('blob URLs should already be revoked') },
        (err) => { assert(!!err) }
    )
})
