import { dynamicImport, supportsDynamicImportCheck } from './dynamic-import.js';
import { noop, createBlob } from './common.js';
import { nonce } from './options.js';

// support browsers without dynamic import support (eg Firefox 6x)
export let supportsJsonAssertions = false;
export let supportsCssAssertions = false;

export let supportsImportMeta = false;
export let supportsImportMaps = false;

export let supportsDynamicImport = false;

export const featureDetectionPromise = Promise.resolve(supportsDynamicImportCheck).then(ok => !ok ? 0 : (supportsDynamicImport = true, Promise.all([
  dynamicImport(createBlob('import"data:text/css,{}"assert{type:"css"}'), { errUrl: 'f1' }).then(() => supportsCssAssertions = true, noop),
  dynamicImport(createBlob('import"data:text/json,{}"assert{type:"json"}'), { errUrl: 'f2', }).then(() => supportsJsonAssertions = true, noop),
  dynamicImport(createBlob('import.meta'), { errUrl: 'f3' }).then(() => supportsImportMeta = true, noop),
  new Promise(resolve => {
    self._$s = v => {
      document.body.removeChild(iframe);
      delete self._$s;
      resolve(v);
    };
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    // we use document.write here because eg Weixin built-in browser doesn't support setting srcdoc
    iframe.contentWindow.document.write(`<script type=importmap nonce="${nonce}">{"imports":{"x":"data:text/javascript,"}}<${''}/script><script nonce="${nonce}">import('x').then(()=>1,()=>0).then(v=>parent._$s(v))<${''}/script>`);
  }).then(() => supportsImportMaps = true, noop)
])), noop);
