import {
  baseUrl as pageBaseUrl,
  resolveImportMap,
  createBlob,
  resolveAndComposeImportMap,
  hasDocument,
  resolveIfNotPlainOrUrl,
  resolvedPromise,
  dynamicImport,
  supportsDynamicImport,
  supportsImportMeta,
  supportsImportMaps,
  featureDetectionPromise
} from './common.js';
import { init, parse } from '../node_modules/es-module-lexer/dist/lexer.js';

let id = 0;
const registry = {};

async function loadAll (load, seen) {
  if (load.b || seen[load.u])
    return;
  seen[load.u] = 1;
  await load.L;
  return Promise.all(load.d.map(dep => loadAll(dep, seen)));
}

let waitingForImportMapsInterval;
let firstTopLevelProcess = true;
async function topLevelLoad (url, source, polyfill) {
  // no need to even fetch if we have feature support
  await featureDetectionPromise;
  // early analysis opt-out
  if (supportsDynamicImport && supportsImportMeta && supportsImportMaps && !importMapSrcOrLazy) {
    // dont reexec inline for polyfills -> just return null
    return source && polyfill ? null : dynamicImport(url || createBlob(source));
  }
  if (waitingForImportMapsInterval > 0) {
    clearTimeout(waitingForImportMapsInterval);
    waitingForImportMapsInterval = 0;
  }
  if (firstTopLevelProcess) {
    firstTopLevelProcess = false;
    processScripts();
  }
  await importMapPromise;
  await init;
  const load = getOrCreateLoad(url, source);
  const seen = {};
  await loadAll(load, seen);
  lastLoad = undefined;
  resolveDeps(load, seen);
  // inline "module-shim" must still execute even if no shim
  if (source && !polyfill && !load.n)
    return dynamicImport(createBlob(source));
  const module = await dynamicImport(load.b);
  // if the top-level load is a shell, run its update function
  if (load.s)
    (await dynamicImport(load.s)).u$_(module);
  return module;
}

async function importShim (id, parentUrl = pageBaseUrl) {
  return topLevelLoad(resolve(id, parentUrl).r || throwUnresolved(id, parentUrl));
}

self.importShim = importShim;

const meta = {};

const edge = navigator.userAgent.match(/Edge\/\d\d\.\d+$/);

async function importMetaResolve (id, parentUrl = this.url) {
  await importMapPromise;
  return resolve(id, `${parentUrl}`).r || throwUnresolved(id, parentUrl);
}

self._esmsm = meta;

const esmsInitOptions = self.esmsInitOptions || {};
delete self.esmsInitOptions;
const shimMode = typeof esmsInitOptions.shimMode === 'boolean' ? esmsInitOptions.shimMode : !!esmsInitOptions.fetch || !!document.querySelector('script[type="module-shim"],script[type="importmap-shim"]');
const fetchHook = esmsInitOptions.fetch || (url => fetch(url));
const skip = esmsInitOptions.skip || /^https?:\/\/(cdn\.skypack\.dev|jspm\.dev)\//;
const onerror = esmsInitOptions.onerror || ((e) => { throw e; });

let lastLoad;
function resolveDeps (load, seen) {
  if (load.b || !seen[load.u])
    return;
  seen[load.u] = 0;

  for (const dep of load.d) {
    resolveDeps(dep, seen);
    if (dep.n)
      load.n = true;
  }

  if (!load.n && !shimMode) {
    load.b = lastLoad = load.u;
    load.S = undefined;
    return;
  }

  const [imports] = load.a;

  // "execution"
  const source = load.S;

  // edge doesnt execute sibling in order, so we fix this up by ensuring all previous executions are explicit dependencies
  let resolvedSource = edge && lastLoad ? `import '${lastLoad}';` : '';  

  if (!imports.length) {
    resolvedSource += source;
  }
  else {
    // once all deps have loaded we can inline the dependency resolution blobs
    // and define this blob
    let lastIndex = 0, depIndex = 0;
    for (const { s: start, e: end, d: dynamicImportIndex, n } of imports) {
      // dependency source replacements
      if (dynamicImportIndex === -1) {
        const depLoad = load.d[depIndex++];
        let blobUrl = depLoad.b;
        if (!blobUrl) {
          // circular shell creation
          if (!(blobUrl = depLoad.s)) {
            blobUrl = depLoad.s = createBlob(`export function u$_(m){${
                depLoad.a[1].map(
                  name => name === 'default' ? `$_default=m.default` : `${name}=m.${name}`
                ).join(',')
              }}${
                depLoad.a[1].map(name =>
                  name === 'default' ? `let $_default;export{$_default as default}` : `export let ${name}`
                ).join(';')
              }\n//# sourceURL=${depLoad.r}?cycle`);
          }
        }
        // circular shell execution
        else if (depLoad.s) {
          resolvedSource += source.slice(lastIndex, start - 1) + '/*' + source.slice(start - 1, end + 1) + '*/' + source.slice(start - 1, start) + blobUrl + source[end] + `;import*as m$_${depIndex} from'${depLoad.b}';import{u$_ as u$_${depIndex}}from'${depLoad.s}';u$_${depIndex}(m$_${depIndex})`;
          lastIndex = end + 1;
          depLoad.s = undefined;
          continue;
        }
        resolvedSource += source.slice(lastIndex, start - 1) + '/*' + source.slice(start - 1, end + 1) + '*/' + source.slice(start - 1, start) + blobUrl;
        lastIndex = end;
      }
      // import.meta
      else if (dynamicImportIndex === -2) {
        meta[load.r] = { url: load.r, resolve: importMetaResolve };
        resolvedSource += source.slice(lastIndex, start) + 'self._esmsm[' + JSON.stringify(load.r) + ']';
        lastIndex = end;
      }
      // dynamic import
      else {
        resolvedSource += source.slice(lastIndex, dynamicImportIndex + 6) + 'Shim(' + source.slice(start, end) + ', ' + JSON.stringify(load.r);
        lastIndex = end;
      }
    }

    resolvedSource += source.slice(lastIndex);
  }

  if (resolvedSource.indexOf('//# sourceURL=') === -1)
    resolvedSource += '\n//# sourceURL=' + load.r;

  load.b = lastLoad = createBlob(resolvedSource);
  load.S = undefined;
}

function getOrCreateLoad (url, source) {
  let load = registry[url];
  if (load)
    return load;

  load = registry[url] = {
    // url
    u: url,
    // response url
    r: undefined,
    // fetchPromise
    f: undefined,
    // source
    S: undefined,
    // linkPromise
    L: undefined,
    // analysis
    a: undefined,
    // deps
    d: undefined,
    // blobUrl
    b: undefined,
    // shellUrl
    s: undefined,
    // needsShim
    n: false,
  };

  load.f = (async () => {
    if (!source) {
      const res = await fetchHook(url, { credentials: 'same-origin' });
      if (!res.ok)
        throw new Error(`${res.status} ${res.statusText} ${res.url}`);
      load.r = res.url;
      const contentType = res.headers.get('content-type');
      if (contentType.match(/^(text|application)\/(x-)?javascript(;|$)/))
        source = await res.text();
      else
        throw new Error(`Unknown Content-Type "${contentType}"`);
    }
    try {
      load.a = parse(source, load.u);
    }
    catch (e) {
      console.warn(e);
      load.a = [[], []];
    }
    load.S = source;
    // determine if this source needs polyfilling
    for (const { e: end, d: dynamicImportIndex, n } of load.a[0]) {
      if (dynamicImportIndex === -2) {
        if (!supportsImportMeta || source.slice(end, end + 8) === '.resolve') {
          load.n = true;
          break;
        }
      }
      else if (dynamicImportIndex !== -1) {
        if (!supportsDynamicImport || (!supportsImportMaps || importMapSrcOrLazy) && n && resolve(n, load.r || load.u).m || !n && hasImportMap) {
          load.n = true;
          break;
        }
      }
    }
    return load.a[0].filter(d => d.d === -1).map(d => d.n);
  })();

  load.L = load.f.then(async deps => {
    load.d = await Promise.all(deps.map(async depId => {
      const { r, m } = resolve(depId, load.r || load.u);
      if (!r)
        throwUnresolved(depId, load.r || load.u);
      if (m && (!supportsImportMaps || importMapSrcOrLazy))
        load.n = true;
      if (skip.test(r))
        return { b: r };
      const depLoad = getOrCreateLoad(r);
      await depLoad.f;
      return depLoad;
    }));
  });

  return load;
}

let importMap = { imports: {}, scopes: {} };
let importMapSrcOrLazy = false;
let hasImportMap = false;
let importMapPromise = resolvedPromise;

if (hasDocument) {
  processScripts();
  waitingForImportMapsInterval = setInterval(processScripts, 20);
}

async function processScripts () {
  if (waitingForImportMapsInterval > 0 && document.readyState !== 'loading') {
    clearTimeout(waitingForImportMapsInterval);
    waitingForImportMapsInterval = 0;
  }
  for (const script of document.querySelectorAll('script[type="module-shim"],script[type="importmap-shim"],script[type="module"],script[type="importmap"]'))
    await processScript(script);
}

new MutationObserver(mutations => {
  for (const mutation of mutations) {
    if (mutation.type !== 'childList') continue;
    for (const node of mutation.addedNodes) {
      if (node.tagName === 'SCRIPT')
        processScript(node, !firstTopLevelProcess);
    }
  }
}).observe(document, { childList: true, subtree: true });

async function processScript (script, dynamic) {
  if (script.ep) // ep marker = script processed
    return;
  const shim = script.type.endsWith('shim');
  if (!shim && shimMode || script.getAttribute('noshim') !== null)
    return;
  script.ep = true;
  if (script.type.startsWith('module')) {
    await topLevelLoad(script.src || `${pageBaseUrl}?${id++}`, !script.src && script.innerHTML, !shim).catch(onerror);
  }
  else {
    importMapPromise = importMapPromise.then(async () => {
      if (script.src || dynamic)
        importMapSrcOrLazy = true;
      hasImportMap = true;
      importMap = resolveAndComposeImportMap(script.src ? await (await fetchHook(script.src)).json() : JSON.parse(script.innerHTML), script.src || pageBaseUrl, importMap);
    });
  }
}

function resolve (id, parentUrl) {
  const urlResolved = resolveIfNotPlainOrUrl(id, parentUrl);
  const resolved = resolveImportMap(importMap, urlResolved || id, parentUrl);
  return { r: resolved, m: urlResolved !== resolved };
}

function throwUnresolved (id, parentUrl) {
  throw Error("Unable to resolve specifier '" + id + (parentUrl ? "' from " + parentUrl : "'"));
}
