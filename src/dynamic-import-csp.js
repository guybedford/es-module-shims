import { nonce } from './options.js';
import { createBlob, baseUrl, noop } from './common.js';

export function dynamicImport (url, { errUrl = url } = {}) {
  const src = createBlob(`import*as m from'${url}';self._esmsi=m`);
  const s = Object.assign(document.createElement('script'), { type: 'module', src });
  s.setAttribute('nonce', nonce);
  s.setAttribute('noshim', '');
  const p =  new Promise((resolve, reject) => {
    // Safari is unique in supporting module script error events
    s.addEventListener('error', cb);
    s.addEventListener('load', cb);

    function cb () {
      document.head.removeChild(s);
      if (self._esmsi) {
        resolve(self._esmsi, baseUrl);
        self._esmsi = undefined;
      }
      else {
        reject(new Error(`Error loading or executing the graph of ${errUrl} (check the console for ${src}).`));
      }
    }
  });
  document.head.appendChild(s);
  return p;
}

export const supportsDynamicImportCheck = dynamicImport(createBlob('0&&import("")')).catch(noop);
