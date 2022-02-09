import noop from './noop.js';

const optionsScript = document.querySelector('script[type=esms-options]');

const esmsInitOptions = optionsScript ? JSON.parse(optionsScript.innerHTML) : self.esmsInitOptions ? self.esmsInitOptions : {};

export let shimMode = !!esmsInitOptions.shimMode;
export const resolveHook = globalHook(shimMode && esmsInitOptions.resolve);

export const skip = esmsInitOptions.skip ? new RegExp(esmsInitOptions.skip) : null;

export let nonce = esmsInitOptions.nonce;

export const override = esmsInitOptions.override;

if (!nonce) {
  const nonceElement = document.querySelector('script[nonce]');
  if (nonceElement)
    nonce = nonceElement.nonce || nonceElement.getAttribute('nonce');
}

export const onerror = globalHook(esmsInitOptions.onerror || noop);
export const onpolyfill = esmsInitOptions.onpolyfill ? globalHook(esmsInitOptions.onpolyfill) : () => console.info(`OK: ^ TypeError module failure has been polyfilled`);

export const { revokeBlobURLs, noLoadEventRetriggers, enforceIntegrity } = esmsInitOptions;

export const fetchHook = esmsInitOptions.fetch ? globalHook(esmsInitOptions.fetch) : fetch;

function globalHook (name) {
  return typeof name === 'string' ? self[name] : name;
}

const enable = Array.isArray(esmsInitOptions.polyfillEnable) ? esmsInitOptions.polyfillEnable : [];
export const cssModulesEnabled = enable.includes('css-modules');
export const jsonModulesEnabled = enable.includes('json-modules');

export function setShimMode () {
  shimMode = true;
}
