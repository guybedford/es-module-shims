import { dynamicImport, supportsDynamicImport, dynamicImportCheck } from './dynamic-import.js';
import { createBlob, noop, nonce, cssModulesEnabled, jsonModulesEnabled, hasDocument } from './env.js';

// support browsers without dynamic import support (eg Firefox 6x)
export let supportsJsonAssertions = false;
export let supportsCssAssertions = false;

export let supportsImportMaps = hasDocument && HTMLScriptElement.supports ? HTMLScriptElement.supports('importmap') : false;
export let supportsImportMeta = supportsImportMaps;

const importMetaCheck = 'import.meta';
const cssModulesCheck = `import"x"assert{type:"css"}`;
const jsonModulesCheck = `import"x"assert{type:"json"}`;

export const featureDetectionPromise = Promise.resolve(dynamicImportCheck).then(() => {
  if (!supportsDynamicImport || supportsImportMaps && !cssModulesEnabled && !jsonModulesEnabled)
    return;

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

    const importMapTest = `<script nonce=${nonce || ''}>b=(s,type='text/javascript')=>URL.createObjectURL(new Blob([s],{type}));document.head.appendChild(Object.assign(document.createElement('script'),{type:'importmap',nonce:"${nonce}",innerText:\`{"imports":{"x":"\${b('')}"}}\`}));Promise.all([${
      supportsImportMaps ? 'true,true' : `'x',b('${importMetaCheck}')`}, ${cssModulesEnabled ? `b('${cssModulesCheck}'.replace('x',b('','text/css')))` : 'false'}, ${
      jsonModulesEnabled ? `b('${jsonModulesCheck}'.replace('x',b('{}','text/json')))` : 'false'}].map(x =>typeof x==='string'?import(x).then(x =>!!x,()=>false):x)).then(a=>parent.postMessage(a,'*'))<${''}/script>`;

    iframe.onload = () => {
      // WeChat browser doesn't support setting srcdoc scripts
      // But iframe sandboxes don't support contentDocument so we do this as a fallback
      const doc = iframe.contentDocument;
      if (doc && doc.head.childNodes.length === 0) {
        const s = doc.createElement('script');
        if (nonce)
          s.setAttribute('nonce', nonce);
        s.innerHTML = importMapTest.slice(15 + (nonce ? nonce.length : 0), -9);
        doc.head.appendChild(s);
      }
    };
    // WeChat browser requires append before setting srcdoc
    document.head.appendChild(iframe);
    // setting srcdoc is not supported in React native webviews on iOS
    // setting src to a blob URL results in a navigation event in webviews
    // document.write gives usability warnings
    if ('srcdoc' in iframe)
      iframe.srcdoc = importMapTest;
    else
      iframe.contentDocument.write(importMapTest);
  });
});
