import { createBlob, noop, nonce, cssModulesEnabled, jsonModulesEnabled, hasDocument, dynamicImport, dynamicImportPromise } from './env.js';

// support browsers without dynamic import support (eg Firefox 6x)
export let supportsJsonAssertions = false;
export let supportsCssAssertions = false;

export let supportsImportMaps = hasDocument && HTMLScriptElement.supports ? HTMLScriptElement.supports('importmap') : false;
export let supportsImportMeta = supportsImportMaps;

const importMetaCheck = 'import.meta';
const cssModulesCheck = `import"x"assert{type:"css"}`;
const jsonModulesCheck = `import"x"assert{type:"json"}`;

export const featureDetectionPromise = dynamicImportPromise.then(() => {
  if (supportsImportMaps && !cssModulesEnabled && !jsonModulesEnabled)
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
    window.addEventListener('message', ({ data: [a, b, c, d] }) => {
      supportsImportMaps = a;
      supportsImportMeta = b;
      supportsCssAssertions = c;
      supportsJsonAssertions = d;
      resolve();
      document.head.removeChild(iframe);
    }, false);

    const importMapTest = `<script nonce=${nonce}>const b=(s,type='text/javascript')=>URL.createObjectURL(new Blob([s],{type}));document.head.appendChild(Object.assign(document.createElement('script'),{type:'importmap',nonce:"${nonce}",innerText:\`{"imports":{"x":"\${b('')}"}}\`}));Promise.all([${
      supportsImportMaps ? 'true,true' : `'x',b('${importMetaCheck}')`}, ${cssModulesEnabled ? `b('${cssModulesCheck}'.replace('x',b('','text/css')))` : 'false'}, ${
      jsonModulesEnabled ? `b('${jsonModulesCheck}'.replace('x',b('{}','text/json')))` : 'false'}].map(x =>typeof x==='string'?import(x).then(x =>!!x,()=>false):x)).then(a=>parent.postMessage(a,'*'))<${''}/script>`;
    // setting srcdoc is not supported in React native webviews on iOS
    // setting src to a blob URL results in a navigation event in webviews
    // document.write gives usability warnings
    if ('srcdoc' in iframe)
      iframe.srcdoc = importMapTest;
    else
      iframe.contentDocument.write(importMapTest);
    document.head.appendChild(iframe);
  });
});
