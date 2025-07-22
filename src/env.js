import { self } from './self.js';
import { initHotReload } from './hot-reload.js';

export const hasDocument = typeof document !== 'undefined';

export const noop = () => {};

export const chain = (a, b) =>
  function () {
    a.apply(this, arguments);
    b.apply(this, arguments);
  };

export const dynamicImport = (u, _errUrl) => import(u);

export const defineValue = (obj, prop, value) =>
  Object.defineProperty(obj, prop, { writable: false, configurable: false, value });

export const optionsScript = hasDocument ? document.querySelector('script[type=esms-options]') : undefined;

export const esmsInitOptions = optionsScript ? JSON.parse(optionsScript.innerHTML) : {};
Object.assign(esmsInitOptions, self.esmsInitOptions || {});

export const version = self.VERSION;

const r = esmsInitOptions.version;
if (self.importShim || (r && r !== version)) {
  if (self.ESMS_DEBUG)
    console.info(
      `es-module-shims: skipping initialization as ${r ? `configured for ${r}` : 'another instance has already registered'}`
    );
  $ret();
}

// shim mode is determined on initialization, no late shim mode
export const shimMode =
  esmsInitOptions.shimMode ||
  (hasDocument ?
    document.querySelectorAll('script[type=module-shim],script[type=importmap-shim],link[rel=modulepreload-shim]')
      .length > 0
  : true);

export let importHook,
  resolveHook,
  fetchHook = fetch,
  sourceHook,
  metaHook,
  tsTransform =
    esmsInitOptions.tsTransform ||
    (hasDocument && document.currentScript && document.currentScript.src.replace(/(\.\w+)?\.js$/, '-typescript.js')) ||
    './es-module-shims-typescript.js';

export const defaultFetchOpts = { credentials: 'same-origin' };

const globalHook = name => (typeof name === 'string' ? self[name] : name);

if (esmsInitOptions.onimport) importHook = globalHook(esmsInitOptions.onimport);
if (esmsInitOptions.resolve) resolveHook = globalHook(esmsInitOptions.resolve);
if (esmsInitOptions.fetch) fetchHook = globalHook(esmsInitOptions.fetch);
if (esmsInitOptions.source) sourceHook = globalHook(esmsInitOptions.source);
if (esmsInitOptions.meta) metaHook = globalHook(esmsInitOptions.meta);

export const hasCustomizationHooks = importHook || resolveHook || fetchHook !== fetch || sourceHook || metaHook;

export const {
  noLoadEventRetriggers,
  enforceIntegrity,
  hotReload,
  hotReloadInterval = 100,
  nativePassthrough = !hasCustomizationHooks && !hotReload
} = esmsInitOptions;

export const setHooks = (importHook_, resolveHook_, metaHook_) => (
  (importHook = importHook_),
  (resolveHook = resolveHook_),
  (metaHook = metaHook_)
);

export const mapOverrides = esmsInitOptions.mapOverrides;

export let nonce = esmsInitOptions.nonce;
if (!nonce && hasDocument) {
  const nonceElement = document.querySelector('script[nonce]');
  if (nonceElement) nonce = nonceElement.nonce || nonceElement.getAttribute('nonce');
}

export const onerror = globalHook(esmsInitOptions.onerror || console.error.bind(console));

const enable = Array.isArray(esmsInitOptions.polyfillEnable) ? esmsInitOptions.polyfillEnable : [];
const disable = Array.isArray(esmsInitOptions.polyfillDisable) ? esmsInitOptions.polyfillDisable : [];

const enableAll = esmsInitOptions.polyfillEnable === 'all' || enable.includes('all');
export const wasmInstancePhaseEnabled =
  enable.includes('wasm-modules') || enable.includes('wasm-module-instances') || enableAll;
export const wasmSourcePhaseEnabled =
  enable.includes('wasm-modules') || enable.includes('wasm-module-sources') || enableAll;
export const deferPhaseEnabled = enable.includes('import-defer') || enableAll;
export const cssModulesEnabled = !disable.includes('css-modules');
export const jsonModulesEnabled = !disable.includes('json-modules');

export const onpolyfill =
  esmsInitOptions.onpolyfill ?
    globalHook(esmsInitOptions.onpolyfill)
  : () => {
      console.log(`%c^^ Module error above is polyfilled and can be ignored ^^`, 'font-weight:900;color:#391');
    };

export const baseUrl =
  hasDocument ? document.baseURI
  : typeof location !== 'undefined' ?
    `${location.protocol}//${location.host}${
      location.pathname.includes('/') ?
        location.pathname.slice(0, location.pathname.lastIndexOf('/') + 1)
      : location.pathname
    }`
  : 'about:blank';

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
  (self.reportError || dispatchError)(err);
  onerror(err);
};

export const fromParent = parent => (parent ? ` imported from ${parent}` : '');
