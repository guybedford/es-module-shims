import { baseUrl as pageBaseUrl, esModuleShimsSrc, createBlob } from './common.js';

export class WorkerShim {
  constructor(aURL, options = {type: 'classic'}) {
    if (options.type !== 'module')
      return new Worker(aURL, options);

    if (!esModuleShimsSrc)
      throw new Error('es-module-shims.js must be loaded with a script tag for WorkerShim support.');

    const workerScriptUrl = createBlob(
      `importScripts('${esModuleShimsSrc}'); self.importMap = ${JSON.stringify(options.importMap || {})}; importShim('${new URL(aURL, pageBaseUrl).href}')`);

    const workerOptions = {...options};
    workerOptions.type = 'classic';

    return new Worker(workerScriptUrl, workerOptions);
  }
}
