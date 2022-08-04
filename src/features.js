import { dynamicImport, supportsDynamicImportCheck } from './dynamic-import-csp.js';
import { createBlob, noop, nonce, cssModulesEnabled, jsonModulesEnabled, hasDocument } from './env.js';

// support browsers without dynamic import support (eg Firefox 6x)
export let supportsJsonAssertions = false;
export let supportsCssAssertions = false;

export let supportsImportMaps = hasDocument && HTMLScriptElement.supports ? HTMLScriptElement.supports('importmap') : false;
export let supportsImportMeta = supportsImportMaps;
export let supportsDynamicImport = false;

export const featureDetect = async () => {
  if (!(supportsImportMaps || await supportsDynamicImportCheck))
    return;
  supportsDynamicImport = true;

  await Promise.all([
    supportsImportMaps || dynamicImport(createBlob('import.meta')).then(() => supportsImportMeta = true, noop),
    cssModulesEnabled && dynamicImport(createBlob(`import"${createBlob('', 'text/css')}"assert{type:"css"}`)).then(() => supportsCssAssertions = true, noop),
    jsonModulesEnabled && dynamicImport(createBlob(`import"${createBlob('{}', 'text/json')}"assert{type:"json"}`)).then(() => supportsJsonAssertions = true, noop),
    supportsImportMaps || hasDocument && (HTMLScriptElement.supports || new Promise(resolve => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.setAttribute('nonce', nonce);
      // setting src to a blob URL results in a navigation event in webviews
      // setting srcdoc is not supported in React native webviews on iOS
      // therefore, we need to first feature detect srcdoc support
      iframe.srcdoc = `<!doctype html><script nonce="${nonce}"><${''}/script>`;
      document.head.appendChild(iframe);
      iframe.onload = () => {
        self._$s = v => {
          document.head.removeChild(iframe);
          supportsImportMaps = v;
          delete self._$s;
          resolve();
        };
        const supportsSrcDoc = iframe.contentDocument.head.childNodes.length > 0;
        const importMapTest = `<!doctype html><script type=importmap nonce="${nonce}">{"imports":{"x":"${createBlob('')}"}<${''}/script><script nonce="${nonce}">import('x').catch(() => {}).then(v=>parent._$s(!!v))<${''}/script>`;
        if (supportsSrcDoc)
          iframe.srcdoc = importMapTest;
        else
          iframe.contentDocument.write(importMapTest);
      };
    }))
  ]);
};
