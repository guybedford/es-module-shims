import { createBlob, baseUrl, nonce } from './env.js';

let err;
window.addEventListener('error', _err => err = _err);
const inject = (s, errUrl) => new Promise((resolve, reject) => {
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
      reject(!(_err instanceof Event) && _err || err && err.error || new Error(`Error loading or executing the graph of ${errUrl} (check the console for ${s.src}).`));
      err = undefined;
    }
  }

  document.head.appendChild(s);
});

export const dynamicImport = (url, opts) => inject(Object.assign(document.createElement('script'), {
  type: 'module',
  src: createBlob(`import*as m from'${url}';self._esmsi=m`)
}), opts && opts.errUrl || url);

// This is done as a script so we don't trigger module loading too early for any loading import maps
export const supportsDynamicImportCheck = inject(Object.assign(document.createElement('script'), { src: createBlob('self._esmsi=u => import(u)') })).then(() => true, () => false);
