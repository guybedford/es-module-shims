import { createBlob, baseUrl, nonce } from './env.js';

export let supportsDynamicImportCheck = false;

export let dynamicImport;
try {
  dynamicImport = (0, eval)('u=>import(u)');
  supportsDynamicImportCheck = true;
}
catch (e) {}

if (!supportsDynamicImportCheck) {
  let err;
  window.addEventListener('error', _err => err = _err);
  dynamicImport = (url, { errUrl = url }) => {
    err = undefined;
    const src = createBlob(`import*as m from'${url}';self._esmsi=m;`);
    const s = Object.assign(document.createElement('script'), { type: 'module', src });
    s.setAttribute('noshim', '');
    s.setAttribute('nonce', nonce);
    document.head.appendChild(s);
    return new Promise((resolve, reject) => {
      s.addEventListener('load', () => {
        document.head.removeChild(s);
        if (self._esmsi) {
          resolve(self._esmsi, baseUrl);
          self._esmsi = null;
        }
        else {
          reject(err.error || new Error(`Error loading or executing the graph of ${errUrl} (check the console for ${src}).`));
          err = undefined;
        }
      });
    });
  };
}
