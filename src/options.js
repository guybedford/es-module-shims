import { noop } from './common.js';

const optionsScript = document.querySelector('script[type=esms-options]');

const esmsInitOptions = optionsScript ? JSON.parse(optionsScript.innerHTML) : self.esmsInitOptions ? self.esmsInitOptions : {};

export let shimMode = !!esmsInitOptions.shimMode;
export const resolveHook = shimMode && esmsInitOptions.resolve;

export const skip = esmsInitOptions.skip ? new RegExp(esmsInitOptions.skip) : /^https:\/\/(cdn\.skypack\.dev|jspm\.dev)\//;

export let nonce = esmsInitOptions.nonce;

if (!nonce) {
  const nonceElement = document.querySelector('script[nonce]');
  if (nonceElement)
    nonce = nonceElement.nonce;
}

export const {
  fetchHook = fetch,
  onerror = noop,
  revokeBlobURLs,
  noLoadEventRetriggers,
} = esmsInitOptions;

const enable = Array.isArray(esmsInitOptions.polyfillEnable) ? esmsInitOptions.polyfillEnable : [];
export const cssModulesEnabled = enable.includes('css-modules');
export const jsonModulesEnabled = enable.includes('json-modules');

export function setShimMode () {
  shimMode = true;
}
