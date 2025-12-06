import { self } from './self.js';
import { esmsInitOptions, defineValue, optionsScript } from './env.js';
import './version-check.js';
import { importShim } from './core.js';

defineValue(self, 'importShim', importShim);
const shimModeOptions = { ...esmsInitOptions, shimMode: true };
if (optionsScript) optionsScript.innerHTML = JSON.stringify(shimModeOptions);
self.esmsInitOptions = shimModeOptions;
