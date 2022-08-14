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
    const importMetaCheck = 'import.meta';
    const cssModulesCheck = `import"x"assert{type:"css"}`;
    const jsonModulesCheck = `import"x"assert{type:"json"}`;

    if (!hasDocument)
      return Promise.all([
        supportsImportMaps || dynamicImport(createBlob(importMetaCheck)).then(() => supportsImportMeta = true, noop),
        cssModulesEnabled && dynamicImport(createBlob(cssModulesCheck.replace('x', createBlob('', 'text/css')))).then(() => supportsCssAssertions = true, noop),
        jsonModulesEnabled && dynamicImport(createBlob(jsonModulescheck.replace('x', createBlob('{}', 'text/json')))).then(() => supportsJsonAssertions = true, noop),
      ]);

    return new Promise(resolve => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.setAttribute('nonce', nonce);
      function cb ({ data: [a, b, c, d] }) {
        supportsImportMaps = a;
        supportsImportMeta = b;
        supportsCssAssertions = c;
        supportsJsonAssertions = d;
        resolve();
        document.head.removeChild(iframe);
        window.removeEventListener('message', cb, false);
      }
      window.addEventListener('message', cb, false);

      const importMapTest = `<script nonce=${nonce}>const createBlob=(s,type='text/javascript')=>URL.createObjectURL(new Blob([s],{type}));document.head.appendChild(Object.assign(document.createElement('script'),{type:'importmap',nonce:"${nonce}",innerText:\`{"imports":{"x":"\${createBlob('')}"}}\`}));Promise.all([${
        supportsImportMaps ? 'true, true' : `'x',createBlob('${importMetaCheck}')`}, ${cssModulesEnabled ? `createBlob('${cssModulesCheck}'.replace('x',createBlob('','text/css')))` : 'false'}, ${
        jsonModulesEnabled ? `createBlob('${jsonModulesCheck}'.replace('x',createBlob('{}','text/json')))` : 'false'}].map(x =>typeof x==='string'?import(x).then(x =>!!x,()=>false):x)).then(a=>parent.postMessage(a,'*'))<${''}/script>`;
      // setting srcdoc is not supported in React native webviews on iOS
      // setting src to a blob URL results in a navigation event in webviews
      // document.write gives usability warnings
      if ('srcdoc' in iframe)
        iframe.srcdoc = importMapTest;
      else
        iframe.contentDocument.write(importMapTest);
      document.head.appendChild(iframe);
    });
  }
});
