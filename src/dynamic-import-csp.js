import { nonce } from './options.js';
import { createBlob, baseUrl } from './common.js';

let err;
self.addEventListener('error', e => err = e.error);

export function dynamicImport (specifier) {
  const s = Object.assign(document.createElement('script'), {
    type: 'module',
    src: createBlob(
      `import*as m from'${specifier}';self._esmsi=m`
    ),
    nonce
  });
  s.setAttribute('noshim', '');
  const p =  new Promise((resolve, reject) => {
    // Safari is unique in supporting module script error events
    s.addEventListener('error', cb);
    s.addEventListener('load', cb);

    function cb () {
      document.head.removeChild(s);
      if (self._esmsi) {
        resolve(self._esmsi, baseUrl);
        self._esmsi = null;
      }
      else {
        // If error is undefined, that usually means it was a previously natively loaded module
        // with a cached error.
        // TODO: in this case we should do a dynamic import and return the rejection, so long
        // as we can reliably determine that is the case in all browsers.
        reject(err);
      }
    }
  });
  document.head.appendChild(s);
  return p;
}

export const supportsDynamicImportCheck = dynamicImport(createBlob('()=>import("")'));
