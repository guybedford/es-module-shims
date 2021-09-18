import { createBlob, baseUrl } from './common.js';

export let supportsDynamicImportCheck = false;

export let dynamicImport;
try {
  dynamicImport = (0, eval)('u=>import(u)');
  supportsDynamicImportCheck = true;
}
catch (e) {}

if (!supportsDynamicImportCheck) {
  dynamicImport = (url, { errUrl = url }) => {
    const src = createBlob(`import*as m from'${url}';self._esmsi=m;`);
    const s = Object.assign(document.createElement('script'), { type: 'module', src });
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
          reject(new Error(`Error loading or executing the graph of ${errUrl} (check the console for ${src}).`));
        }
      });
    });
  };
}
