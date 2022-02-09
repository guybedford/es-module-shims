import { dynamicImport, supportsDynamicImportCheck } from './dynamic-import-csp.js';
import { createBlob } from './common.js';
import { nonce, cssModulesEnabled, jsonModulesEnabled } from './options.js';
import noop from './noop.js';

// support browsers without dynamic import support (eg Firefox 6x)
export let supportsJsonAssertions = false;
export let supportsCssAssertions = false;

export let supportsImportMeta = false;
export let supportsImportMaps = false;

export let supportsDynamicImport = false;

export const featureDetectionPromise = Promise.resolve(supportsDynamicImportCheck).then(_supportsDynamicImport => {
  if (!_supportsDynamicImport)
    return;
  supportsDynamicImport = true;

  return Promise.all([
    dynamicImport(createBlob('import.meta')).then(() => supportsImportMeta = true, noop),
    cssModulesEnabled && dynamicImport(createBlob('import"data:text/css,{}"assert{type:"css"}')).then(() => supportsCssAssertions = true, noop),
    jsonModulesEnabled && dynamicImport(createBlob('import"data:text/json,{}"assert{type:"json"}')).then(() => supportsJsonAssertions = true, noop),
    new Promise(resolve => {
      self._$s = v => {
        document.head.removeChild(iframe);
        if (v) supportsImportMaps = true;
        delete self._$s;
        resolve();
      };
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.head.appendChild(iframe);
      iframe.src = createBlob(`<script type=importmap nonce="${nonce}">{"imports":{"x":"data:text/javascript,"}}<${''}/script><script nonce="${nonce}">import('x').then(()=>1,()=>0).then(v=>parent._$s(v))<${''}/script>`, 'text/html')
    })
  ]);
});
