import { dynamicImport, supportsDynamicImport } from './dynamic-import.js';
import { noop, createBlob } from './common.js';
import { nonce } from './options.js';

export { supportsDynamicImport }

// support browsers without dynamic import support (eg Firefox 6x)
export let supportsJsonAssertions = false;
export let supportsCssAssertions = false;

export let supportsImportMeta = false;
export let supportsImportMaps = false;

export const featureDetectionPromise = Promise.all([
  dynamicImport(createBlob('import"data:text/css,{}"assert{type:"css"}')).then(() => supportsCssAssertions = true, noop),
  dynamicImport(createBlob('import"data:text/json,{}"assert{type:"json"}')).then(() => supportsJsonAssertions = true, noop),
  dynamicImport(createBlob('import.meta')).then(() => supportsImportMeta = true, noop),
  supportsDynamicImport && new Promise(resolve => {
    self._$s = v => {
      document.body.removeChild(iframe);
      if (v) supportsImportMaps = true;
      delete self._$s;
      resolve();
    };
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    // we use document.write here because eg Weixin built-in browser doesn't support setting srcdoc
    iframe.contentWindow.document.write(`<script type=importmap nonce="${nonce}">{"imports":{"x":"data:text/javascript,"}}<${''}/script><script nonce="${nonce}">import('x').then(()=>1,()=>0).then(v=>parent._$s(v))<${''}/script>`);
  })
]);
