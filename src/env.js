export const hasWindow = typeof window !== 'undefined';
export const hasDocument = typeof document !== 'undefined';

export const noop = () => {};

const optionsScript = hasDocument ? document.querySelector('script[type=esms-options]') : undefined;

export const esmsInitOptions = optionsScript ? JSON.parse(optionsScript.innerHTML) : {};
Object.assign(esmsInitOptions, self.esmsInitOptions || {});

export let shimMode = hasDocument ? !!esmsInitOptions.shimMode : true;

export const importHook = globalHook(shimMode && esmsInitOptions.onimport);
export const resolveHook = globalHook(shimMode && esmsInitOptions.resolve);
export let fetchHook = esmsInitOptions.fetch ? globalHook(esmsInitOptions.fetch) : fetch;
export const metaHook = esmsInitOptions.meta ? globalHook(shimModule && esmsInitOptions.meta) : noop;

export const skip = esmsInitOptions.skip ? new RegExp(esmsInitOptions.skip) : null;

export let nonce = esmsInitOptions.nonce;

export const mapOverrides = esmsInitOptions.mapOverrides;

if (!nonce && hasDocument) {
  const nonceElement = document.querySelector('script[nonce]');
  if (nonceElement)
    nonce = nonceElement.nonce || nonceElement.getAttribute('nonce');
}

export const onerror = globalHook(esmsInitOptions.onerror || noop);
export const onpolyfill = esmsInitOptions.onpolyfill ? globalHook(esmsInitOptions.onpolyfill) : () => {
  console.log('%c^^ Module TypeError above is polyfilled and can be ignored ^^', 'font-weight:900;color:#391');
};

export const { revokeBlobURLs, noLoadEventRetriggers, enforceIntegrity } = esmsInitOptions;

function globalHook (name) {
  return typeof name === 'string' ? self[name] : name;
}

const enable = Array.isArray(esmsInitOptions.polyfillEnable) ? esmsInitOptions.polyfillEnable : [];
export const cssModulesEnabled = enable.includes('css-modules');
export const jsonModulesEnabled = enable.includes('json-modules');

export function setShimMode () {
  shimMode = true;
}

export const edge = !navigator.userAgentData && !!navigator.userAgent.match(/Edge\/\d+\.\d+/);

function getBaseURL() {
  let baseUrl;

  if (hasDocument) {
    baseUrl = document.baseURI;
  }

  if (!baseUrl && typeof location !== 'undefined') {
    baseUrl = location.href.split('#')[0].split('?')[0];
    const lastSepIndex = baseUrl.lastIndexOf('/');
    if (lastSepIndex !== -1)
      baseUrl = baseUrl.slice(0, lastSepIndex + 1);
  }

  return baseUrl;
}
export const baseUrl = getBaseURL();

export function createBlob (source, type = 'text/javascript') {
  return URL.createObjectURL(new Blob([source], { type }));
}

const eoop = err => setTimeout(() => { throw err });

export const throwError = err => { (self.reportError || hasWindow && window.safari && console.error || eoop)(err), void onerror(err) };

export function fromParent (parent) {
  return parent ? ` imported from ${parent}` : '';
}
