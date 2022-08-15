import { createBlob, baseUrl, nonce, hasDocument } from './env.js';

export let dynamicImport = !hasDocument && (0, eval)('u=>import(u)');

export let supportsDynamicImport;

export const dynamicImportCheck = hasDocument && new Promise(resolve => {
  const s = Object.assign(document.createElement('script'), {
    src: createBlob('self._d=u=>import(u)'),
    ep: true
  });
  s.setAttribute('nonce', nonce);
  s.addEventListener('load', () => {
    if (!(supportsDynamicImport = !!(dynamicImport = self._d))) {
      let err;
      window.addEventListener('error', _err => err = _err);
      dynamicImport = (url, opts) => new Promise((resolve, reject) => {
        const s = Object.assign(document.createElement('script'), {
          type: 'module',
          src: createBlob(`import*as m from'${url}';self._esmsi=m`)
        });
        err = undefined;
        s.ep = true;
        if (nonce)
          s.setAttribute('nonce', nonce);
        // Safari is unique in supporting module script error events
        s.addEventListener('error', cb);
        s.addEventListener('load', cb);
        function cb (_err) {
          document.head.removeChild(s);
          if (self._esmsi) {
            resolve(self._esmsi, baseUrl);
            self._esmsi = undefined;
          }
          else {
            reject(!(_err instanceof Event) && _err || err && err.error || new Error(`Error loading ${opts && opts.errUrl || url} (${s.src}).`));
            err = undefined;
          }
        }
        document.head.appendChild(s);
      });
    }
    document.head.removeChild(s);
    delete self._d;
    resolve();
  });
  document.head.appendChild(s);
});
