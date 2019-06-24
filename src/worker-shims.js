import { baseUrl as pageBaseUrl, createBlob } from './common.js';

export class WorkerShim {
  constructor(aURL, options = {type: 'classic'}) {
    if (options.type !== 'module') {
      return new Worker(aURL, options);
    }

    let es_module_shims_src = new URL('es-module-shims.js', pageBaseUrl).href;
    const scripts = document.scripts;
    for (let i = 0, len = scripts.length; i < len; i++) {
      if (scripts[i].src.includes('es-module-shims.js')) {
          es_module_shims_src = scripts[i].src;

          break;
      }
    }

    const workerScriptUrl = createBlob(`importScripts('${es_module_shims_src}'); 
    self.importMap = ${JSON.stringify(options.importMap || {})}; importShim('${new URL(aURL, pageBaseUrl).href}')`);

    const workerOptions = {...options};
    workerOptions.type = 'classic';

    return new Worker(workerScriptUrl, workerOptions);
  }
}
