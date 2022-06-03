import { dynamicImport, supportsDynamicImportCheck } from './dynamic-import-csp.js';
import { createBlob, noop, nonce, cssModulesEnabled, jsonModulesEnabled } from './env.js';

// support browsers without dynamic import support (eg Firefox 6x)
export let supportsJsonAssertions = false;
export let supportsCssAssertions = false;

export let supportsImportMaps = HTMLScriptElement.supports ? HTMLScriptElement.supports('importmap') : false;
export let supportsImportMeta = supportsImportMaps;
export let supportsDynamicImport = false;

export const featureDetectionPromise = Promise.resolve(supportsImportMaps || supportsDynamicImportCheck).then(_supportsDynamicImport => {
  if (!_supportsDynamicImport)
    return;
  supportsDynamicImport = true;

  return Promise.all([
    supportsImportMaps || dynamicImport(createBlob('import.meta')).then(() => supportsImportMeta = true, noop),
    cssModulesEnabled && dynamicImport(createBlob('import"data:text/css,{}"assert{type:"css"}')).then(() => supportsCssAssertions = true, noop),
    jsonModulesEnabled && dynamicImport(createBlob('import"data:text/json,{}"assert{type:"json"}')).then(() => supportsJsonAssertions = true, noop),
    supportsImportMaps || new Promise(resolve => {
      self._$s = v => {
        document.head.removeChild(iframe);
        if (v) supportsImportMaps = true;
        delete self._$s;
        resolve();
      };
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.setAttribute('nonce', nonce);
      document.head.appendChild(iframe);
      // we use document.write here because eg Weixin built-in browser doesn't support setting srcdoc
      // setting src to an object URL is not supported in React native webviews on iOS
      iframe.contentWindow.document.write(`<script type=importmap nonce="${nonce}">{"imports":{"x":"data:text/javascript,"}}<${''}/script><script nonce="${nonce}">import('x').then(()=>1,()=>0).then(v=>parent._$s(v))<${''}/script>`);
    })
  ]);
});
