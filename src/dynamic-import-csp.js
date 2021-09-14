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
        reject(err);
      }
    }
  });
  document.head.appendChild(s);
  return p;
}

export const supportsDynamicImportCheck = dynamicImport(createBlob('if(0)import("")'));
