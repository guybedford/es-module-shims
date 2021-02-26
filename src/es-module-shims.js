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

// TODO: conditionally polyfill src and dynamic importmaps
const supportsImportMapsSrc = false;
const supportsImportMapsDynamic = false;

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
  if (supportsDynamicImport && supportsImportMeta && supportsImportMaps && importMapShim === importMapNoShim)
    return source && polyfill ? null : dynamicImport(url || createBlob(source));
  if (waitingForImportMapsInterval > 0) {
    clearTimeout(waitingForImportMapsInterval);
    waitingForImportMapsInterval = 0;
  }
  if (firstTopLevelProcess) {
    firstTopLevelProcess = false;
    hooks.load();
  }
  await importMapPromise;
  await init;
  const load = getOrCreateLoad(url, source);
  const seen = {};
  await loadAll(load, seen);
  lastLoad = undefined;
  resolveDeps(load, seen);
  if (polyfill && !load.n)
    return source ? null : dynamicImport(url || createBlob(source));
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
const hooks = {
  fetch: esmsInitOptions.fetch || (url => fetch(url)),
  skip: esmsInitOptions.skip || /^https?:\/\/(cdn\.pika\.dev|dev\.jspm\.io|jspm\.dev)\//,
  onerror: esmsInitOptions.onerror || ((e) => { throw e; }),
  load: processScripts
};

const noPolyfill = !!esmsInitOptions.fetch;

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

  // "execution"
  const source = load.S;
  // edge doesnt execute sibling in order, so we fix this up by ensuring all previous executions are explicit dependencies
  let resolvedSource = edge && lastLoad ? `import '${lastLoad}';` : '';

  const [imports] = load.a;

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
        if (!supportsImportMeta || source.slice(end, end + 8) === '.resolve')
          load.n = true;
        meta[load.r] = { url: load.r, resolve: importMetaResolve };
        resolvedSource += source.slice(lastIndex, start) + 'self._esmsm[' + JSON.stringify(load.r) + ']';
        lastIndex = end;
      }
      // dynamic import
      else {
        if (!supportsDynamicImport || !supportsImportMaps && n && resolve(n, load.r || load.u).m || !supportsImportMapsSrc && n && resolve(n, load.r || load.u, true).sm)
          load.n = true;
        resolvedSource += source.slice(lastIndex, dynamicImportIndex + 6) + 'Shim(' + source.slice(start, end) + ', ' + JSON.stringify(load.r);
        lastIndex = end;
      }
    }

    resolvedSource += source.slice(lastIndex);
  }

  if (resolvedSource.indexOf('//# sourceURL=') === -1)
    resolvedSource += '\n//# sourceURL=' + load.r;

  if (load.n || !load.r || noPolyfill) // load.r = not inline
    load.b = lastLoad = createBlob(resolvedSource);
  else
    load.b = lastLoad = load.u;
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
      const res = await hooks.fetch(url, { credentials: 'same-origin' });
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
    return load.a[0].filter(d => d.d === -1).map(d => source.slice(d.s, d.e));
  })();

  load.L = load.f.then(async deps => {
    load.d = await Promise.all(deps.map(async depId => {
      const { r, m, sm } = resolve(depId, load.r || load.u, true);
      if (!r)
        throwUnresolved(depId, load.r || load.u);
      if (!supportsImportMaps && m || !supportsImportMapsSrc && sm)
        load.n = true;
      if (hooks.skip.test(r))
        return { b: r };
      const depLoad = getOrCreateLoad(r);
      await depLoad.f;
      return depLoad;
    }));
  });

  return load;
}

let importMapNoShim = { imports: {}, scopes: {} };
let importMapShim = importMapNoShim;
let importMapPromise = resolvedPromise;

if (hasDocument) {
  hooks.load();
  waitingForImportMapsInterval = setInterval(hooks.load, 20);
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
        processScript(node, true);
    }
  }
}).observe(document, { childList: true, subtree: true });

async function processScript (script, dynamic) {
  if (script.ep) // ep marker = script processed
    return;
  const shim = script.type.endsWith('shim');
  if (!shim && noPolyfill)
    return;
  script.ep = true;
  if (script.type.startsWith('module')) {
    await topLevelLoad(script.src || `${pageBaseUrl}?${id++}`, !script.src && script.innerHTML, !shim).catch(e => hooks.onerror(e));
  }
  else {
    importMapPromise = importMapPromise.then(async () => {
      if (script.src) {
        // if (supportsImportMapsSrc)
        //   importMap = resolveAndComposeImportMap(await (await fetch(script.src)).json(), script.src || pageBaseUrl, importMap);
        importMapShim = resolveAndComposeImportMap(await (await fetch(script.src)).json(), script.src || pageBaseUrl, importMapShim);
      }
      else {
        const same = importMapNoshim === importMapShim;
        importMapShim = resolveAndComposeImportMap(JSON.parse(script.innerHTML), script.src || pageBaseUrl, importMapShim);
        if (!dynamic || supportsImportMapsDynamic) {
          if (same)
            importMapNoShim = importMapShim;
          else
            importMapNoShim = resolveAndComposeImportMap(JSON.parse(script.innerHTML), script.src || pageBaseUrl, importMapNoShim);
        }
      }
    });
  }
}

function resolve (id, parentUrl, compareNoShim) {
  const urlResolved = resolveIfNotPlainOrUrl(id, parentUrl);
  const resolved = resolveImportMap(importMapShim, urlResolved || id, parentUrl);
  let sm = false;
  if (compareNoShim) {
    const resolvedNoShim = resolveImportMap(importMapNoShim, urlResolved || id, parentUrl);
    sm = resolvedNoShim !== resolved;
  }
  return { r: resolved, m: urlResolved !== resolved, sm };
}

function throwUnresolved (id, parentUrl) {
  throw Error("Unable to resolve specifier '" + id + (parentUrl ? "' from " + parentUrl : "'"));
}
