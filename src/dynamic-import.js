import { createBlob, baseUrl, hasDocument } from './env.js';

export let supportsDynamicImportCheck = false;

// first check basic eval support
try {
  eval('');
}
catch (e) {
  throw new Error(`The ES Module Shims Wasm build will not work without eval support. Either use the alternative CSP-compatible build or make sure to add both the "unsafe-eval" and "unsafe-wasm-eval" CSP policies.`);
}

// polyfill dynamic import if not supported
export let dynamicImport;
try {
  dynamicImport = (0, eval)('u=>import(u)');
  supportsDynamicImportCheck = true;
}
catch (e) {}

if (hasDocument && !supportsDynamicImportCheck) {
  let err;
  window.addEventListener('error', _err => err = _err);
  dynamicImport = (url, { errUrl = url }) => {
    err = undefined;
    const src = createBlob(`import*as m from'${url}';self._esmsi=m;`);
    const s = Object.assign(document.createElement('script'), { type: 'module', src });
    s.setAttribute('noshim', '');
    document.appendChild(s);
    return new Promise((resolve, reject) => {
      s.addEventListener('load', () => {
        document.removeChild(s);
        if (self._esmsi) {
          resolve(_esmsi, baseUrl);
          _esmsi = null;
        }
        else {
          reject(err.error || new Error(`Error loading or executing the graph of ${errUrl} (check the console for ${src}).`));
          err = undefined;
        }
      });
    });
  };
}
