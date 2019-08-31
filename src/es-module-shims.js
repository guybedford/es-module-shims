import { baseUrl as pageBaseUrl, resolveImportMap, createBlob, resolveUrl, resolveAndComposeImportMap, hasDocument, resolveIfNotPlainOrUrl, emptyImportMap } from './common.js';
import { init, parse } from '../node_modules/es-module-lexer/dist/lexer.js';
import { WorkerShim } from './worker-shims.js';

let id = 0;
const registry = {};

// support browsers without dynamic import support (eg Firefox 6x)
let dynamicImport;
try {
  dynamicImport = (0, eval)('u=>import(u)');
}
catch (e) {
  if (hasDocument) {
    self.addEventListener('error', e => importShim.e = e.error);
    dynamicImport = blobUrl => {
      const topLevelBlobUrl = createBlob(
        `import*as m from'${blobUrl}';self.importShim.l=m;self.importShim.e=null`
      );
      const s = document.createElement('script');
      s.type = 'module';
      s.src = topLevelBlobUrl;
      document.head.appendChild(s);
      return new Promise((resolve, reject) => {
        s.addEventListener('load', () => {
          document.head.removeChild(s);
          importShim.e ? reject(importShim.e) : resolve(importShim.l, pageBaseUrl);
        });
      });
    };
  }
}

async function loadAll (load, seen) {
  if (load.b || seen[load.u])
    return;
  seen[load.u] = 1;
  await load.L;
  return Promise.all(load.d.map(dep => loadAll(dep, seen)));
}

async function topLevelLoad (url, source) {
  await init;
  const load = getOrCreateLoad(url, source);
  const seen = {};
  await loadAll(load, seen);
  lastLoad = undefined;
  resolveDeps(load, seen);
  const module = await dynamicImport(load.b);
  // if the top-level load is a shell, run its update function
  if (load.s)
    (await dynamicImport(load.s)).u$_(module);
  return module;
}

async function importShim (id, parentUrl) {
  return topLevelLoad(await resolve(id, parentUrl || pageBaseUrl));
}

self.importShim = importShim;

const meta = {};
const wasmModules = {};

const edge = navigator.userAgent.match(/Edge\/\d\d\.\d+$/);

Object.defineProperties(importShim, {
  map: { value: emptyImportMap, writable: true },
  m: { value: meta },
  w: { value: wasmModules },
  l: { value: undefined, writable: true },
  e: { value: undefined, writable: true }
});

let lastLoad;
function resolveDeps (load, seen) {
  if (load.b || !seen[load.u])
    return;
  seen[load.u] = 0;

  for (const dep of load.d)
    resolveDeps(dep, seen);

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
    for (const { s: start, e: end, d: dynamicImportIndex } of imports) {
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
        meta[load.r] = { url: load.r };
        resolvedSource += source.slice(lastIndex, start) + 'importShim.m[' + JSON.stringify(load.r) + ']';
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

  const lastNonEmptyLine = resolvedSource.slice(resolvedSource.lastIndexOf('\n') + 1);
  load.b = lastLoad = createBlob(resolvedSource + (lastNonEmptyLine.startsWith('//# sourceMappingURL=') ? '\n//# sourceMappingURL=' + resolveUrl(lastNonEmptyLine.slice(21), load.r) : '') + '\n//# sourceURL=' + load.r);
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
  };

  load.f = (async () => {
    if (!source) {
      const res = await fetch(url);
      if (!res.ok)
        throw new Error(`${res.status} ${res.statusText} ${res.url}`);

      load.r = res.url;

      const contentType = res.headers.get('content-type');
      if (contentType.match(/^(text|application)\/(x-)?javascript(;|$)/)) {
        source = await res.text();
      }
      else if (contentType.match(/^application\/json(;|$)/)) {
        source = `export default JSON.parse(${JSON.stringify(await res.text())})`;
      }
      else if (contentType.match(/^text\/css(;|$)/)) {
        source = `const s=new CSSStyleSheet();s.replaceSync(${JSON.stringify(await res.text())});export default s`;
      }
      else if (contentType.match(/^application\/wasm(;|$)/)) {
        const module = wasmModules[url] = await WebAssembly.compile(await res.arrayBuffer());
        let deps = WebAssembly.Module.imports ? WebAssembly.Module.imports(module).map(impt => impt.module) : [];

        const aDeps = [];
        load.a = [aDeps, WebAssembly.Module.exports(module).map(expt => expt.name)];

        const depStrs = deps.map(dep => JSON.stringify(dep));

        let curIndex = 0;
        load.S = depStrs.map((depStr, idx) => {
            const index = idx.toString();
            const strStart = curIndex + 17 + index.length;
            const strEnd = strStart + depStr.length - 2;
            aDeps.push({
              s: strStart,
              e: strEnd,
              d: -1
            });
            curIndex += strEnd + 3;
            return `import*as m${index} from${depStr};`
          }).join('') +
          `const module=importShim.w[${JSON.stringify(url)}],exports=new WebAssembly.Instance(module,{` +
          depStrs.map((depStr, idx) => `${depStr}:m${idx},`).join('') +
          `}).exports;` +
          load.a[1].map(name => name === 'default' ? `export default exports.${name}` : `export const ${name}=exports.${name}`).join(';');
        return deps;
      }
      else {
        throw new Error(`Unknown Content-Type "${contentType}"`);
      }
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
      const depLoad = getOrCreateLoad(await resolve(depId, load.r || load.u));
      await depLoad.f;
      return depLoad;
    }));
  });

  return load;
}

let importMapPromise;

if (hasDocument) {
  // preload import maps
  for (const script of document.querySelectorAll('script[type="importmap-shim"][src]'))
    script._f = fetch(script.src);
  // load any module scripts
  for (const script of document.querySelectorAll('script[type="module-shim"]'))
    topLevelLoad(script.src || `${pageBaseUrl}?${id++}`, script.src ? null : script.innerHTML);
}

async function resolve (id, parentUrl) {
  if (!importMapPromise) {
    const stdModules = new Set();
    importMapPromise = (async () => {
      // check which standard modules are available
      for (const m of ['std:kv-storage']) {
        try {
          await dynamicImport(m);
          stdModules.add(m);
        }
        catch (e) {}
      }
    })();
    if (hasDocument)
      for (const script of document.querySelectorAll('script[type="importmap-shim"]')) {
        importMapPromise = importMapPromise.then(async () => {
          importShim.map = resolveAndComposeImportMap(script.src ? await (await (script._f || fetch(script.src))).json() : JSON.parse(script.innerHTML), script.src || pageBaseUrl, importShim.map, stdModules);
        });
      }
  }
  await importMapPromise;
  return resolveImportMap(importShim.map, resolveIfNotPlainOrUrl(id, parentUrl) || id, parentUrl) || throwUnresolved(id, parentUrl);
}

function throwUnresolved (id, parentUrl) {
  throw Error("Unable to resolve specifier '" + id + (parentUrl ? "' from " + parentUrl : "'"));
}

self.WorkerShim = WorkerShim;
