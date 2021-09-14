import { nonce } from './options.js';
import { createBlob, baseUrl } from './common.js';

export const supportsDynamicImport = true;

let err;
self.addEventListener('error', e => err = e.error);

export function dynamicImport (specifier) {
  const s = Object.assign(document.createElement('script'), {
    type: 'module',
    src: createBlob(
      `import*as m from'${specifier}';self._esmsi=m;`
    ),
    nonce
  });
  s.setAttribute('noshim', '');
  document.head.appendChild(s);
  return new Promise((resolve, reject) => {
    s.addEventListener('load', () => {
      document.head.removeChild(s);
      if (self._esmsi) {
        resolve(self._esmsi, baseUrl);
        self._esmsi = null;
      }
      else {
        reject(err);
      }
    });
  });
}
