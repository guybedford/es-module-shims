import {
  resolveAndComposeImportMap,
  resolveUrl,
  resolveImportMap,
  resolveIfNotPlainOrUrl,
  isURL,
} from './resolve.js'
import {
  baseUrl as pageBaseUrl,
  createBlob,
  edge,
  throwError,
  shimMode,
  resolveHook,
  fetchHook,
  importHook,
  metaHook,
  skip,
  revokeBlobURLs,
  noLoadEventRetriggers,
  cssModulesEnabled,
  jsonModulesEnabled,
  onpolyfill,
  enforceIntegrity,
  fromParent,
  esmsInitOptions,
  hasDocument,
  importMapSrcOrLazy,
  setImportMapSrcOrLazy,
} from './env.js';
import { dynamicImport, supportsDynamicImport } from './dynamic-import.js';
import {
  supportsImportMeta,
  supportsImportMaps,
  supportsCssAssertions,
  supportsJsonAssertions,
  featureDetectionPromise,
} from './features.js';
import * as lexer from '../node_modules/es-module-lexer/dist/lexer.asm.js';

async function _resolve (id, parentUrl) {
  const urlResolved = resolveIfNotPlainOrUrl(id, parentUrl);
  return {
    r: resolveImportMap(importMap, urlResolved || id, parentUrl) || throwUnresolved(id, parentUrl),
    // b = bare specifier
    b: !urlResolved && !isURL(id)
  };
}

const resolve = resolveHook ? async (id, parentUrl) => {
  let result = resolveHook(id, parentUrl, defaultResolve);
  // will be deprecated in next major
  if (result && result.then)
    result = await result;
  return result ? { r: result, b: !resolveIfNotPlainOrUrl(id, parentUrl) && !isURL(id) } : _resolve(id, parentUrl);
} : _resolve;

// importShim('mod');
// importShim('mod', { opts });
// importShim('mod', { opts }, parentUrl);
// importShim('mod', parentUrl);
async function importShim (id, ...args) {
  // parentUrl if present will be the last argument
  let parentUrl = args[args.length - 1];
  if (typeof parentUrl !== 'string')
    parentUrl = pageBaseUrl;
  // needed for shim check
  await initPromise;
  if (importHook) await importHook(id, typeof args[1] !== 'string' ? args[1] : {}, parentUrl);
  if (acceptingImportMaps || shimMode || !baselinePassthrough) {
    if (hasDocument)
      processScriptsAndPreloads(true);
    if (!shimMode)
      acceptingImportMaps = false;
  }
  await importMapPromise;
  return topLevelLoad((await resolve(id, parentUrl)).r, { credentials: 'same-origin' });
}

self.importShim = importShim;

function defaultResolve (id, parentUrl) {
  return resolveImportMap(importMap, resolveIfNotPlainOrUrl(id, parentUrl) || id, parentUrl) || throwUnresolved(id, parentUrl);
}

function throwUnresolved (id, parentUrl) {
  throw Error(`Unable to resolve specifier '${id}'${fromParent(parentUrl)}`);
}

const resolveSync = (id, parentUrl = pageBaseUrl) => {
  parentUrl = `${parentUrl}`;
  const result = resolveHook && resolveHook(id, parentUrl, defaultResolve);
  return result && !result.then ? result : defaultResolve(id, parentUrl);
};

function metaResolve (id, parentUrl = this.url) {
  return resolveSync(id, parentUrl);
}

importShim.resolve = resolveSync;
importShim.getImportMap = () => JSON.parse(JSON.stringify(importMap));
importShim.addImportMap = importMapIn => {
  if (!shimMode) throw new Error('Unsupported in polyfill mode.');
  importMap = resolveAndComposeImportMap(importMapIn, pageBaseUrl, importMap);
}

const registry = importShim._r = {};

async function loadAll (load, seen) {
  if (load.b || seen[load.u])
    return;
  seen[load.u] = 1;
  await load.L;
  await Promise.all(load.d.map(dep => loadAll(dep, seen)));
  if (!load.n)
    load.n = load.d.some(dep => dep.n);
}

let importMap = { imports: {}, scopes: {} };
let baselinePassthrough;

const initPromise = featureDetectionPromise.then(() => {
  baselinePassthrough = esmsInitOptions.polyfillEnable !== true && supportsDynamicImport && supportsImportMeta && supportsImportMaps && (!jsonModulesEnabled || supportsJsonAssertions) && (!cssModulesEnabled || supportsCssAssertions) && !importMapSrcOrLazy;
  if (self.ESMS_DEBUG) console.info(`es-module-shims: init ${shimMode ? 'shim mode' : 'polyfill mode'}, ${baselinePassthrough ? 'baseline passthrough' : 'polyfill engaged'}`);
  if (hasDocument) {
    if (!supportsImportMaps) {
      const supports = HTMLScriptElement.supports || (type => type === 'classic' || type === 'module');
      HTMLScriptElement.supports = type => type === 'importmap' || supports(type);
    }
    if (shimMode || !baselinePassthrough) {
      new MutationObserver(mutations => {
        for (const mutation of mutations) {
          if (mutation.type !== 'childList') continue;
          for (const node of mutation.addedNodes) {
            if (node.tagName === 'SCRIPT') {
              if (node.type === (shimMode ? 'module-shim' : 'module'))
                processScript(node, true);
              if (node.type === (shimMode ? 'importmap-shim' : 'importmap'))
                processImportMap(node, true);
            }
            else if (node.tagName === 'LINK' && node.rel === (shimMode ? 'modulepreload-shim' : 'modulepreload')) {
              processPreload(node);
            }
          }
        }
      }).observe(document, {childList: true, subtree: true});
      processScriptsAndPreloads();
      if (document.readyState === 'complete') {
        readyStateCompleteCheck();
      }
      else {
        async function readyListener() {
          await initPromise;
          processScriptsAndPreloads();
          if (document.readyState === 'complete') {
            readyStateCompleteCheck();
            document.removeEventListener('readystatechange', readyListener);
          }
        }
        document.addEventListener('readystatechange', readyListener);
      }
    }
  }
  return lexer.init;
});
let importMapPromise = initPromise;
let firstPolyfillLoad = true;
let acceptingImportMaps = true;

async function topLevelLoad (url, fetchOpts, source, nativelyLoaded, lastStaticLoadPromise) {
  if (!shimMode)
    acceptingImportMaps = false;
  await initPromise;
  await importMapPromise;
  if (importHook) await importHook(url, typeof fetchOpts !== 'string' ? fetchOpts : {}, '');
  // early analysis opt-out - no need to even fetch if we have feature support
  if (!shimMode && baselinePassthrough) {
    if (self.ESMS_DEBUG) console.info(`es-module-shims: load skipping polyfill due to baseline passthrough applying: ${url}`);
    // for polyfill case, only dynamic import needs a return value here, and dynamic import will never pass nativelyLoaded
    if (nativelyLoaded)
      return null;
    await lastStaticLoadPromise;
    return dynamicImport(source ? createBlob(source) : url, { errUrl: url || source });
  }
  const load = getOrCreateLoad(url, fetchOpts, null, source);
  const seen = {};
  await loadAll(load, seen);
  lastLoad = undefined;
  resolveDeps(load, seen);
  await lastStaticLoadPromise;
  if (source && !shimMode && !load.n) {
    if (nativelyLoaded) return;
    if (revokeBlobURLs) revokeObjectURLs(Object.keys(seen));
    return await dynamicImport(createBlob(source), { errUrl: source });
  }
  if (firstPolyfillLoad && !shimMode && load.n && nativelyLoaded) {
    onpolyfill();
    firstPolyfillLoad = false;
  }
  const module = await dynamicImport(!shimMode && !load.n && nativelyLoaded ? load.u : load.b, { errUrl: load.u });
  // if the top-level load is a shell, run its update function
  if (load.s)
    (await dynamicImport(load.s)).u$_(module);
  if (revokeBlobURLs) revokeObjectURLs(Object.keys(seen));
  // when tla is supported, this should return the tla promise as an actual handle
  // so readystate can still correspond to the sync subgraph exec completions
  return module;
}

function revokeObjectURLs(registryKeys) {
  let batch = 0;
  const keysLength = registryKeys.length;
  const schedule = self.requestIdleCallback ? self.requestIdleCallback : self.requestAnimationFrame;
  schedule(cleanup);
  function cleanup() {
    const batchStartIndex = batch * 100;
    if (batchStartIndex > keysLength) return
    for (const key of registryKeys.slice(batchStartIndex, batchStartIndex + 100)) {
      const load = registry[key];
      if (load) URL.revokeObjectURL(load.b);
    }
    batch++;
    schedule(cleanup);
  }
}

function urlJsString (url) {
  return `'${url.replace(/'/g, "\\'")}'`;
}

let lastLoad;
function resolveDeps (load, seen) {
  if (load.b || !seen[load.u])
    return;
  seen[load.u] = 0;

  for (const dep of load.d)
    resolveDeps(dep, seen);

  const [imports, exports] = load.a;

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
    let lastIndex = 0, depIndex = 0, dynamicImportEndStack = [];
    function pushStringTo (originalIndex) {
      while (dynamicImportEndStack[dynamicImportEndStack.length - 1] < originalIndex) {
        const dynamicImportEnd = dynamicImportEndStack.pop();
        resolvedSource += `${source.slice(lastIndex, dynamicImportEnd)}, ${urlJsString(load.r)}`;
        lastIndex = dynamicImportEnd;
      }
      resolvedSource += source.slice(lastIndex, originalIndex);
      lastIndex = originalIndex;
    }
    for (const { s: start, ss: statementStart, se: statementEnd, d: dynamicImportIndex } of imports) {
      // dependency source replacements
      if (dynamicImportIndex === -1) {
        let depLoad = load.d[depIndex++], blobUrl = depLoad.b, cycleShell = !blobUrl;
        if (cycleShell) {
          // circular shell creation
          if (!(blobUrl = depLoad.s)) {
            blobUrl = depLoad.s = createBlob(`export function u$_(m){${
              depLoad.a[1].map(({ s, e }, i) => {
                const q = depLoad.S[s] === '"' || depLoad.S[s] === "'";
                return `e$_${i}=m${q ? `[` : '.'}${depLoad.S.slice(s, e)}${q ? `]` : ''}`;
              }).join(',')
            }}${
              depLoad.a[1].length ? `let ${depLoad.a[1].map((_, i) => `e$_${i}`).join(',')};` : ''
            }export {${
              depLoad.a[1].map(({ s, e }, i) => `e$_${i} as ${depLoad.S.slice(s, e)}`).join(',')
            }}\n//# sourceURL=${depLoad.r}?cycle`);
          }
        }

        pushStringTo(start - 1);
        resolvedSource += `/*${source.slice(start - 1, statementEnd)}*/${urlJsString(blobUrl)}`;

        // circular shell execution
        if (!cycleShell && depLoad.s) {
          resolvedSource += `;import*as m$_${depIndex} from'${depLoad.b}';import{u$_ as u$_${depIndex}}from'${depLoad.s}';u$_${depIndex}(m$_${depIndex})`;
          depLoad.s = undefined;
        }
        lastIndex = statementEnd;
      }
      // import.meta
      else if (dynamicImportIndex === -2) {
        load.m = { url: load.r, resolve: metaResolve };
        metaHook(load.m, load.u);
        pushStringTo(start);
        resolvedSource += `importShim._r[${urlJsString(load.u)}].m`;
        lastIndex = statementEnd;
      }
      // dynamic import
      else {
        pushStringTo(statementStart + 6);
        resolvedSource += `Shim(`;
        dynamicImportEndStack.push(statementEnd - 1);
        lastIndex = start;
      }
    }

    // support progressive cycle binding updates (try statement avoids tdz errors)
    if (load.s)
      resolvedSource += `\n;import{u$_}from'${load.s}';try{u$_({${exports.filter(e => e.ln).map(({ s, e, ln }) => `${source.slice(s, e)}:${ln}`).join(',')}})}catch(_){};\n`;

    pushStringTo(source.length);
  }

  let hasSourceURL = false;
  resolvedSource = resolvedSource.replace(sourceMapURLRegEx, (match, isMapping, url) => (hasSourceURL = !isMapping, match.replace(url, () => new URL(url, load.r))));
  if (!hasSourceURL)
    resolvedSource += '\n//# sourceURL=' + load.r;

  load.b = lastLoad = createBlob(resolvedSource);
  load.S = undefined;
}

// ; and // trailer support added for Ruby on Rails 7 source maps compatibility
// https://github.com/guybedford/es-module-shims/issues/228
const sourceMapURLRegEx = /\n\/\/# source(Mapping)?URL=([^\n]+)\s*((;|\/\/[^#][^\n]*)\s*)*$/;

const jsContentType = /^(text|application)\/(x-)?javascript(;|$)/;
const jsonContentType = /^(text|application)\/json(;|$)/;
const cssContentType = /^(text|application)\/css(;|$)/;

const cssUrlRegEx = /url\(\s*(?:(["'])((?:\\.|[^\n\\"'])+)\1|((?:\\.|[^\s,"'()\\])+))\s*\)/g;

// restrict in-flight fetches to a pool of 100
let p = [];
let c = 0;
function pushFetchPool () {
  if (++c > 100)
    return new Promise(r => p.push(r));
}
function popFetchPool () {
  c--;
  if (p.length)
    p.shift()();
}

async function doFetch (url, fetchOpts, parent) {
  if (enforceIntegrity && !fetchOpts.integrity)
    throw Error(`No integrity for ${url}${fromParent(parent)}.`);
  const poolQueue = pushFetchPool();
  if (poolQueue) await poolQueue;
  try {
    var res = await fetchHook(url, fetchOpts);
  }
  catch (e) {
    e.message = `Unable to fetch ${url}${fromParent(parent)} - see network log for details.\n` + e.message;
    throw e;
  }
  finally {
    popFetchPool();
  }
  if (!res.ok)
    throw Error(`${res.status} ${res.statusText} ${res.url}${fromParent(parent)}`);
  return res;
}

async function fetchModule (url, fetchOpts, parent) {
  const res = await doFetch(url, fetchOpts, parent);
  const contentType = res.headers.get('content-type');
  if (jsContentType.test(contentType))
    return { r: res.url, s: await res.text(), t: 'js' };
  else if (jsonContentType.test(contentType))
    return { r: res.url, s: `export default ${await res.text()}`, t: 'json' };
  else if (cssContentType.test(contentType)) {
    return { r: res.url, s: `var s=new CSSStyleSheet();s.replaceSync(${
        JSON.stringify((await res.text()).replace(cssUrlRegEx, (_match, quotes = '', relUrl1, relUrl2) => `url(${quotes}${resolveUrl(relUrl1 || relUrl2, url)}${quotes})`))
      });export default s;`, t: 'css' };
  }
  else
    throw Error(`Unsupported Content-Type "${contentType}" loading ${url}${fromParent(parent)}. Modules must be served with a valid MIME type like application/javascript.`);
}

function getOrCreateLoad (url, fetchOpts, parent, source) {
  let load = registry[url];
  if (load && !source)
    return load;

  load = {
    // url
    u: url,
    // response url
    r: source ? url : undefined,
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
    // type
    t: null,
    // meta
    m: null
  };
  if (registry[url]) {
    let i = 0;
    while (registry[load.u + ++i]);
    load.u += i;
  }
  registry[load.u] = load;

  load.f = (async () => {
    if (!source) {
      // preload fetch options override fetch options (race)
      let t;
      ({ r: load.r, s: source, t } = await (fetchCache[url] || fetchModule(url, fetchOpts, parent)));
      if (t && !shimMode) {
        if (t === 'css' && !cssModulesEnabled || t === 'json' && !jsonModulesEnabled)
          throw Error(`${t}-modules require <script type="esms-options">{ "polyfillEnable": ["${t}-modules"] }<${''}/script>`);
        if (t === 'css' && !supportsCssAssertions || t === 'json' && !supportsJsonAssertions)
          load.n = true;
      }
    }
    try {
      load.a = lexer.parse(source, load.u);
    }
    catch (e) {
      throwError(e);
      load.a = [[], [], false];
    }
    load.S = source;
    return load;
  })();

  load.L = load.f.then(async () => {
    let childFetchOpts = fetchOpts;
    load.d = (await Promise.all(load.a[0].map(async ({ n, d }) => {
      if (d >= 0 && !supportsDynamicImport || d === -2 && !supportsImportMeta)
        load.n = true;
      if (d !== -1 || !n) return;
      const { r, b } = await resolve(n, load.r || load.u);
      if (b && (!supportsImportMaps || importMapSrcOrLazy))
        load.n = true;
      if (d !== -1) return;
      if (skip && skip(r)) return { b: r };
      if (childFetchOpts.integrity)
        childFetchOpts = Object.assign({}, childFetchOpts, { integrity: undefined });
      return getOrCreateLoad(r, childFetchOpts, load.r).f;
    }))).filter(l => l);
  });

  return load;
}

function processScriptsAndPreloads (mapsOnly = false) {
  if (self.ESMS_DEBUG) console.info(`es-module-shims: processing scripts`);
  if (!mapsOnly)
    for (const link of document.querySelectorAll(shimMode ? 'link[rel=modulepreload-shim]' : 'link[rel=modulepreload]'))
      processPreload(link);
  for (const script of document.querySelectorAll(shimMode ? 'script[type=importmap-shim]' : 'script[type=importmap]'))
    processImportMap(script);
  if (!mapsOnly)
    for (const script of document.querySelectorAll(shimMode ? 'script[type=module-shim]' : 'script[type=module]'))
      processScript(script);
}

function getFetchOpts (script) {
  const fetchOpts = {};
  if (script.integrity)
    fetchOpts.integrity = script.integrity;
  if (script.referrerPolicy)
    fetchOpts.referrerPolicy = script.referrerPolicy;
  if (script.crossOrigin === 'use-credentials')
    fetchOpts.credentials = 'include';
  else if (script.crossOrigin === 'anonymous')
    fetchOpts.credentials = 'omit';
  else
    fetchOpts.credentials = 'same-origin';
  return fetchOpts;
}

let lastStaticLoadPromise = Promise.resolve();

let domContentLoadedCnt = 1;
function domContentLoadedCheck () {
  if (--domContentLoadedCnt === 0 && !noLoadEventRetriggers && (shimMode || !baselinePassthrough)) {
    if (self.ESMS_DEBUG) console.info(`es-module-shims: DOMContentLoaded refire`);
    document.dispatchEvent(new Event('DOMContentLoaded'));
  }
}
// this should always trigger because we assume es-module-shims is itself a domcontentloaded requirement
if (hasDocument) {
  document.addEventListener('DOMContentLoaded', async () => {
    await initPromise;
    domContentLoadedCheck();
  });
}

let readyStateCompleteCnt = 1;
function readyStateCompleteCheck () {
  if (--readyStateCompleteCnt === 0 && !noLoadEventRetriggers && (shimMode || !baselinePassthrough)) {
    if (self.ESMS_DEBUG) console.info(`es-module-shims: readystatechange complete refire`);
    document.dispatchEvent(new Event('readystatechange'));
  }
}

const hasNext = script => script.nextSibling || script.parentNode && hasNext(script.parentNode);
const epCheck = (script, ready) => script.ep || !ready && (!script.src && !script.innerHTML || !hasNext(script)) || script.getAttribute('noshim') !== null || !(script.ep = true);

function processImportMap (script, ready = readyStateCompleteCnt > 0) {
  if (epCheck(script, ready)) return;
  // we dont currently support multiple, external or dynamic imports maps in polyfill mode to match native
  if (script.src) {
    if (!shimMode)
      return;
    setImportMapSrcOrLazy();
  }
  if (acceptingImportMaps) {
    importMapPromise = importMapPromise
      .then(async () => {
        importMap = resolveAndComposeImportMap(script.src ? await (await doFetch(script.src, getFetchOpts(script))).json() : JSON.parse(script.innerHTML), script.src || pageBaseUrl, importMap);
      })
      .catch(e => {
        console.log(e);
        if (e instanceof SyntaxError)
          e = new Error(`Unable to parse import map ${e.message} in: ${script.src || script.innerHTML}`);
        throwError(e);
      });
    if (!shimMode)
      acceptingImportMaps = false;
  }
}

function processScript (script, ready = readyStateCompleteCnt > 0) {
  if (epCheck(script, ready)) return;
  // does this load block readystate complete
  const isBlockingReadyScript = script.getAttribute('async') === null && readyStateCompleteCnt > 0;
  // does this load block DOMContentLoaded
  const isDomContentLoadedScript = domContentLoadedCnt > 0;
  if (isBlockingReadyScript) readyStateCompleteCnt++;
  if (isDomContentLoadedScript) domContentLoadedCnt++;
  if (self.ESMS_DEBUG) console.info(`es-module-shims: processing ${script.src || '<inline>'}`);
  const loadPromise = topLevelLoad(script.src || pageBaseUrl, getFetchOpts(script), !script.src && script.innerHTML, !shimMode, isBlockingReadyScript && lastStaticLoadPromise)
    .then(() => {
      // if the type of the script tag "module-shim", browser does not dispatch a "load" event
      // see https://github.com/guybedford/es-module-shims/issues/346
      if (shimMode) {
        if (self.ESMS_DEBUG) console.info(`es-module-shims: load even refire ${script.src || '<inline>'}`);
        script.dispatchEvent(new Event('load'));
      }
    })
    .catch(throwError);
  if (isBlockingReadyScript)
    lastStaticLoadPromise = loadPromise.then(readyStateCompleteCheck);
  if (isDomContentLoadedScript)
    loadPromise.then(domContentLoadedCheck);
}

const fetchCache = {};
function processPreload (link) {
  if (link.ep) return;
  link.ep = true;
  if (fetchCache[link.href])
    return;
  fetchCache[link.href] = fetchModule(link.href, getFetchOpts(link));
}
