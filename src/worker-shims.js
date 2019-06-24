import { baseUrl as pageBaseUrl, esModuleShimsSrc, createBlob } from './common.js';

export class WorkerShim {
  constructor(aURL, options = {}) {
    console.log(options);
    if (options.type !== 'module')
      return new Worker(aURL, options);

    if (!esModuleShimsSrc)
      throw new Error('es-module-shims.js must be loaded with a script tag for WorkerShim support.');

    const workerScriptUrl = createBlob(
      `importScripts('${esModuleShimsSrc}');self.importMapShim=${JSON.stringify(options.importMap || {})};console.log(self.importMapShim);importShim('${new URL(aURL, pageBaseUrl).href}').catch(e=>setTimeout(()=>{throw e}))`
    );

    return new Worker(workerScriptUrl, { type: undefined, ...options });
  }
}
