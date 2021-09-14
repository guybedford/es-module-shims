import { createBlob, baseUrl } from './common.js';

export let supportsDynamicImportCheck = false;

export let dynamicImport;
try {
  dynamicImport = (0, eval)('u=>import(u)');
  supportsDynamicImportCheck = true;
}
catch (e) {}

if (!supportsDynamicImportCheck) {
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
