import { dynamicImport, supportsDynamicImportCheck } from './dynamic-import-csp.js';
import { createBlob, noop, nonce, cssModulesEnabled, jsonModulesEnabled, hasDocument } from './env.js';

// support browsers without dynamic import support (eg Firefox 6x)
export let supportsJsonAssertions = false;
export let supportsCssAssertions = false;

export let supportsImportMaps = hasDocument && HTMLScriptElement.supports ? HTMLScriptElement.supports('importmap') : false;
export let supportsImportMeta = supportsImportMaps;
export let supportsDynamicImport = false;

export const featureDetectionPromise = Promise.resolve(supportsImportMaps || supportsDynamicImportCheck).then(_supportsDynamicImport => {
  if (!_supportsDynamicImport)
    return;
  supportsDynamicImport = true;

  if (!supportsImportMaps || cssModulesEnabled || jsonModulesEnabled) {
    const importMetaCheck = createBlob('import.meta');
    const cssModulesCheck = createBlob(`import"${createBlob('', 'text/css')}"assert{type:"css"}`);
    const jsonModulesCheck = createBlob(`import"${createBlob('{}', 'text/json')}"assert{type:"json"}`);

    if (!hasDocument)
      return Promise.all([
        supportsImportMaps || dynamicImport(importMetaCheck).then(() => supportsImportMeta = true, noop),
        cssModulesEnabled && dynamicImport(cssModulesCheck).then(() => supportsCssAssertions = true, noop),
        jsonModulesEnabled && dynamicImport(jsonModulescheck).then(() => supportsJsonAssertions = true, noop),
      ]);

    return new Promise(resolve => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.setAttribute('nonce', nonce);
      // setting src to a blob URL results in a navigation event in webviews
      // setting srcdoc is not supported in React native webviews on iOS
      // therefore, we need to first feature detect srcdoc support
      iframe.srcdoc = `<!doctype html><script nonce="${nonce}"><${''}/script>`;
      document.head.appendChild(iframe);
      iframe.onload = () => {
        self._$s = (a, b, c, d) => {
          document.head.removeChild(iframe);
          supportsImportMaps = a;
          supportsImportMeta = b;
          supportsCssAssertions = c;
          supportsJsonAssertions = d;
          delete self._$s;
          resolve();
        };
        const supportsSrcDoc = iframe.contentDocument.head.childNodes.length > 0;
        const importMapTest = `<!doctype html><script type=importmap nonce="${nonce}">{"imports":{"x":"${createBlob('')}"}<${''}/script><script nonce="${nonce}">Promise.all([${
          supportsImportMaps ? 'true, true' : `'x', '${importMetaCheck}'`}, ${cssModulesEnabled ? `'${cssModulesCheck}'` : 'false'}, ${jsonModulesEnabled ? `'${jsonModulesCheck}'` : 'false'
        }].map(x => typeof x === 'string' ? import(x).then(x => !!x, () => false) : x)).then(a=>parent._$s.apply(null, a))<${''}/script>`;
        if (supportsSrcDoc)
          iframe.srcdoc = importMapTest;
        else
          iframe.contentDocument.write(importMapTest);
      };
    });
  }
});
