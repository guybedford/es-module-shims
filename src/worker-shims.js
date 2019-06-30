import { baseUrl as pageBaseUrl, esModuleShimsSrc, createBlob } from './common.js';

export class WorkerShim {
  constructor(aURL, options = {}) {
    if (options.type !== 'module')
      return new Worker(aURL, options);

    if (!esModuleShimsSrc)
      throw new Error('es-module-shims.js must be loaded with a script tag for WorkerShim support.');

    const workerScriptUrl = createBlob(
      `importScripts('${esModuleShimsSrc}');importShim.map=${JSON.stringify(options.importMap || {})};importShim('${new URL(aURL, pageBaseUrl).href}').catch(e=>setTimeout(()=>{throw e}))`
    );

    return new Worker(workerScriptUrl, Object.assign({}, options, { type: undefined }));
  }
}
