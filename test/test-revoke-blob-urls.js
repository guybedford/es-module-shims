test('should revoke blob URLs if `esmsInitOptions.revokeBlobURLs` is set to `true`', async () => {
    await importShim("es-modules/es6-withdep.js");

    const moduleURL = new URL('./fixtures/es-modules/es6-withdep.js', location.href).href;
    const moduleDepURL = new URL('./fixtures/es-modules/es6-dep.js', location.href).href;
    const moduleBlobURL = globalThis._esmsr[moduleURL].b;
    const moduleDepBlobURL = globalThis._esmsr[moduleDepURL].b;
    assert(moduleBlobURL.startsWith("blob:http"));
    assert(moduleDepBlobURL.startsWith("blob:http"));

    await Promise.all([
        fetch(moduleBlobURL),
        fetch(moduleDepBlobURL)
    ]).catch(() => fail('blob URLs should be revoked in a non-blocking way, AFTER the import is resolved'));

    // Give the scheduled cleanup a chance to be completed.
    await new Promise(resolve => setTimeout(resolve, 100));

    await Promise.all([
        fetch(moduleBlobURL),
        fetch(moduleDepBlobURL)
    ]).then(
        () => { fail('blob URLs should already be revoked') },
        (err) => { assert(!!err) }
    )
})
