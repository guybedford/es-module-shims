import { noop } from './common.js';

const optionsScript = document.querySelector('script[type=esms-options]');

const esmsInitOptions = optionsScript ? JSON.parse(optionsScript.innerHTML) : self.esmsInitOptions ? self.esmsInitOptions : {};

export let shimMode = !!esmsInitOptions.shimMode;
export const resolveHook = globalHook(shimMode && esmsInitOptions.resolve);

export const skip = esmsInitOptions.skip ? new RegExp(esmsInitOptions.skip) : null;

export let nonce = esmsInitOptions.nonce;

if (!nonce) {
  const nonceElement = document.querySelector('script[nonce]');
  if (nonceElement)
    nonce = nonceElement.getAttribute('nonce');
}

export const onerror = globalHook(esmsInitOptions.onerror || noop);
export const onpolyfill = globalHook(esmsInitOptions.onpolyfill || noop);

export const { revokeBlobURLs, noLoadEventRetriggers } = esmsInitOptions;

export const fetchHook = esmsInitOptions.fetchHook ? globalHook(esmsInitOptions.fetchHook) : fetch;

function globalHook (name) {
  return typeof name === 'string' ? self[name] : name;
}

const enable = Array.isArray(esmsInitOptions.polyfillEnable) ? esmsInitOptions.polyfillEnable : [];
export const cssModulesEnabled = enable.includes('css-modules');
export const jsonModulesEnabled = enable.includes('json-modules');

export function setShimMode () {
  shimMode = true;
}
