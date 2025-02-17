export const hasWindow = typeof window !== 'undefined';
export const hasDocument = typeof document !== 'undefined';

export const noop = () => {};

export const dynamicImport = (u, errUrl) => import(u);

const optionsScript = hasDocument ? document.querySelector('script[type=esms-options]') : undefined;

export const esmsInitOptions = optionsScript ? JSON.parse(optionsScript.innerHTML) : {};
Object.assign(esmsInitOptions, self.esmsInitOptions || {});

// shim mode is determined on initialization, no late shim mode
export const shimMode =
  hasDocument ?
    esmsInitOptions.shimMode ||
    document.querySelectorAll('script[type=module-shim],script[type=importmap-shim],link[rel=modulepreload-shim]')
      .length > 0
  : true;

export const importHook = globalHook(shimMode && esmsInitOptions.onimport);
export const resolveHook = globalHook(shimMode && esmsInitOptions.resolve);
export let fetchHook = esmsInitOptions.fetch ? globalHook(esmsInitOptions.fetch) : fetch;
export const metaHook = esmsInitOptions.meta ? globalHook(shimMode && esmsInitOptions.meta) : noop;
export const tsTransform =
  esmsInitOptions.tsTransform ||
  (hasDocument &&
    document.currentScript &&
    document.currentScript.src.replace(self.ESMS_DEBUG ? /\.debug\.js$/ : /\.js$/, '-typescript.js')) ||
  './es-module-shims-typescript.js';

export const mapOverrides = esmsInitOptions.mapOverrides;

export let nonce = esmsInitOptions.nonce;
if (!nonce && hasDocument) {
  const nonceElement = document.querySelector('script[nonce]');
  if (nonceElement) nonce = nonceElement.nonce || nonceElement.getAttribute('nonce');
}

export const onerror = globalHook(esmsInitOptions.onerror || noop);

export const { revokeBlobURLs, noLoadEventRetriggers, enforceIntegrity } = esmsInitOptions;

function globalHook(name) {
  return typeof name === 'string' ? self[name] : name;
}

const enable = Array.isArray(esmsInitOptions.polyfillEnable) ? esmsInitOptions.polyfillEnable : [];
const enableAll = esmsInitOptions.polyfillEnable === 'all' || enable.includes('all');
const enableLatest = esmsInitOptions.polyfillEnable === 'latest' || enable.includes('latest');
export const cssModulesEnabled = enable.includes('css-modules') || enableAll || enableLatest;
export const jsonModulesEnabled = enable.includes('json-modules') || enableAll || enableLatest;
export const wasmModulesEnabled = enable.includes('wasm-modules') || enableAll;
export const sourcePhaseEnabled = enable.includes('source-phase') || enableAll;
export const typescriptEnabled = enable.includes('typescript') || enableAll;

export const onpolyfill =
  esmsInitOptions.onpolyfill ?
    globalHook(esmsInitOptions.onpolyfill)
  : () => {
      console.log(`%c^^ Module error above is polyfilled and can be ignored ^^`, 'font-weight:900;color:#391');
    };

export const baseUrl =
  hasDocument ?
    document.baseURI
  : `${location.protocol}//${location.host}${
      location.pathname.includes('/') ?
        location.pathname.slice(0, location.pathname.lastIndexOf('/') + 1)
      : location.pathname
    }`;

export const createBlob = (source, type = 'text/javascript') => URL.createObjectURL(new Blob([source], { type }));
export let { skip } = esmsInitOptions;
if (Array.isArray(skip)) {
  const l = skip.map(s => new URL(s, baseUrl).href);
  skip = s => l.some(i => (i[i.length - 1] === '/' && s.startsWith(i)) || s === i);
} else if (typeof skip === 'string') {
  const r = new RegExp(skip);
  skip = s => r.test(s);
} else if (skip instanceof RegExp) {
  skip = s => skip.test(s);
}

const dispatchError = error => self.dispatchEvent(Object.assign(new Event('error'), { error }));

export const throwError = err => {
  (self.reportError || dispatchError)(err), void onerror(err);
};

export function fromParent(parent) {
  return parent ? ` imported from ${parent}` : '';
}
