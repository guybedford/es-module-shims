import {
  createBlob,
  noop,
  nonce,
  cssModulesEnabled,
  jsonModulesEnabled,
  wasmModulesEnabled,
  sourcePhaseEnabled,
  hasDocument
} from './env.js';

// support browsers without dynamic import support (eg Firefox 6x)
export let supportsJsonType = false;
export let supportsCssType = false;

const supports = hasDocument && HTMLScriptElement.supports;

export let supportsImportMaps = supports && supports.name === 'supports' && supports('importmap');
export let supportsWasmModules = false;
export let supportsSourcePhase = false;
export let supportsMultipleImportMaps = false;

const wasmBytes = [0, 97, 115, 109, 1, 0, 0, 0];

export let featureDetectionPromise = (async function () {
  if (!hasDocument)
    return Promise.all([
      cssModulesEnabled &&
        import(createBlob(`import"${createBlob('', 'text/css')}"with{type:"css"}`)).then(
          () => (supportsCssType = true),
          noop
        ),
      jsonModulesEnabled &&
        import(createBlob(`import"${createBlob('{}', 'text/json')}"with{type:"json"}`)).then(
          () => (supportsJsonType = true),
          noop
        ),
      wasmModulesEnabled &&
        import(createBlob(`import"${createBlob(new Uint8Array(wasmBytes), 'application/wasm')}"`)).then(
          () => (supportsWasmModules = true),
          noop
        ),
      wasmModulesEnabled &&
        sourcePhaseEnabled &&
        import(createBlob(`import source x from"${createBlob(new Uint8Array(wasmBytes), 'application/wasm')}"`)).then(
          () => (supportsSourcePhase = true),
          noop
        )
    ]);

  return new Promise(resolve => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.setAttribute('nonce', nonce);
    function cb({ data }) {
      const isFeatureDetectionMessage = Array.isArray(data) && data[0] === 'esms';
      if (!isFeatureDetectionMessage) return;
      [
        ,
        supportsImportMaps,
        supportsMultipleImportMaps,
        supportsCssType,
        supportsJsonType,
        supportsWasmModules,
        supportsSourcePhase
      ] = data;
      resolve();
      document.head.removeChild(iframe);
      window.removeEventListener('message', cb, false);
    }
    window.addEventListener('message', cb, false);

    const importMapTest = `<script nonce=${nonce || ''}>b=(s,type='text/javascript')=>URL.createObjectURL(new Blob([s],{type}));i=innerText=>document.head.appendChild(Object.assign(document.createElement('script'),{type:'importmap',nonce:"${nonce}",innerText}));i(\`{"imports":{"x":"\${b('')}"}}\`);i(\`{"imports":{"y":"\${b('')}"}}\`);Promise.all([${
      supportsImportMaps ? 'true' : "'x'"
    },${supportsImportMaps ? "'y'" : false},${supportsImportMaps && cssModulesEnabled ? `b(\`import"\${b('','text/css')}"with{type:"css"}\`)` : 'false'}, ${
      supportsImportMaps && jsonModulesEnabled ? `b(\`import"\${b('{}','text/json')\}"with{type:"json"}\`)` : 'false'
    },${
      supportsImportMaps && wasmModulesEnabled ?
        `b(\`import"\${b(new Uint8Array(${JSON.stringify(wasmBytes)}),'application/wasm')\}"\`)`
      : 'false'
    },${
      supportsImportMaps && wasmModulesEnabled && sourcePhaseEnabled ?
        `b(\`import source x from "\${b(new Uint8Array(${JSON.stringify(wasmBytes)}),'application/wasm')\}"\`)`
      : 'false'
    }].map(x =>typeof x==='string'?import(x).then(()=>true,()=>false):x)).then(a=>parent.postMessage(['esms'].concat(a),'*'))<${''}/script>`;

    // Safari will call onload eagerly on head injection, but we don't want the Wechat
    // path to trigger before setting srcdoc, therefore we track the timing
    let readyForOnload = false,
      onloadCalledWhileNotReady = false;
    function doOnload() {
      if (!readyForOnload) {
        onloadCalledWhileNotReady = true;
        return;
      }
      // WeChat browser doesn't support setting srcdoc scripts
      // But iframe sandboxes don't support contentDocument so we do this as a fallback
      const doc = iframe.contentDocument;
      if (doc && doc.head.childNodes.length === 0) {
        const s = doc.createElement('script');
        if (nonce) s.setAttribute('nonce', nonce);
        s.innerHTML = importMapTest.slice(15 + (nonce ? nonce.length : 0), -9);
        doc.head.appendChild(s);
      }
    }

    iframe.onload = doOnload;
    // WeChat browser requires append before setting srcdoc
    document.head.appendChild(iframe);

    // setting srcdoc is not supported in React native webviews on iOS
    // setting src to a blob URL results in a navigation event in webviews
    // document.write gives usability warnings
    readyForOnload = true;
    if ('srcdoc' in iframe) iframe.srcdoc = importMapTest;
    else iframe.contentDocument.write(importMapTest);
    // retrigger onload for Safari only if necessary
    if (onloadCalledWhileNotReady) doOnload();
  });
})();

if (self.ESMS_DEBUG)
  featureDetectionPromise = featureDetectionPromise.then(() => {
    console.info(
      `es-module-shims: detected native support - module types: (${[...(supportsJsonType ? ['json'] : []), ...(supportsCssType ? ['css'] : []), ...(supportsWasmModules ? ['wasm'] : [])].join(', ')}), ${supportsSourcePhase ? 'source phase' : 'no source phase'}, ${supportsMultipleImportMaps ? '' : 'no '}multiple import maps, ${supportsImportMaps ? '' : 'no '}import maps`
    );
  });
