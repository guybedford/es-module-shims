import { nonce } from './options.js';
import { createBlob, baseUrl } from './common.js';

if (nonce)
  throw new Error('ESMS nonce unsupported in Wasm build');

export let supportsDynamicImport = false;

export let dynamicImport;
try {
  dynamicImport = (0, eval)('u=>import(u)');
  supportsDynamicImport = true;
}
catch {}

if (!supportsDynamicImport) {
  let err;
  self.addEventListener('error', e => err = e.error);
  dynamicImport = specifier => {
    const s = Object.assign(document.createElement('script'), {
      type: 'module',
      src: createBlob(
        `import*as m from'${specifier}';self._esmsi=m;`
      )
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
  };
}
