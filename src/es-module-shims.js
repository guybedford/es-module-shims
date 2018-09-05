import { resolveIfNotPlainOrUrl, baseUrl as pageBaseUrl, createPackageMap } from './common.js';
import { analyzeModuleSyntax } from './lexer.js';

let id = 0;
const registry = {};

// support browsers without dynamic import support (eg Firefox 6x)
let dynamicImport;
const testBlob = createBlob('');
try {
  import(testBlob);
  dynamicImport = id => import(id);
}
catch (e) {
  if (typeof document !== 'undefined') {
    let errUrl, err;
    self.addEventListener('error', e => errUrl = e.filename, err = e.error);
    dynamicImport = (blobUrl) => {
      const topLevelBlobUrl = createBlob(
        `import*as m from'${load.b}';self.importShim.lastModule=m;`
      );
  
      const s = document.createElement('script');
      s.type = 'module';
      s.src = topLevelBlobUrl;
      document.head.appendChild(s);
      return new Promise((resolve, reject) => {
        document.addEventListener(s, 'load', () => {
          if (errUrl === blobUrl)
            return reject(err);
          document.removeChild(s);
          resolve(importShim.lastModule);
        });
        document.addEventListener(s, 'error', e => {
          document.removeChild(s);
          reject(e);
        });
      });
    };
  }  
}
// URL.revokeObjectURL(testBlob);

async function topLevelLoad (url, source) {
  const load = await resolveDeps(getOrCreateLoad(url, source), {});
  return dynamicImport(
    !load.s
    ? load.b
    // create a dummy head importer for top-level cycle import
    : createBlob(renderShellExec(0, load.b, load.s))
  );
}

async function importShim (id) {
  const parentUrl = arguments.length === 1 ? pageBaseUrl : (id = arguments[1], id);
  return topLevelLoad(await resolve(id, parentUrl));
}

Object.defineProperty(self, 'importShim', { value: importShim });

const meta = Object.create(null);
Object.defineProperty(importShim, 'm', { value: meta });

const wasmModules = {};
Object.defineProperty(importShim, 'w', { value: wasmModules });

async function resolveDeps (load, seen) {
  seen[load.u] = true;

  const depLoads = await load.dP;

  let source = await load.f;
  let resolvedSource;

  if (depLoads.length)
    await Promise.all(depLoads.map(depLoad => seen[depLoad.u] || resolveDeps(depLoad, seen)));
  
  if (!load.a[0].length) {
    resolvedSource = source;
  }
  else {
    // once all deps have loaded we can inline the dependency resolution blobs
    // and define this blob
    let lastIndex = 0;
    resolvedSource = '';
    let depIndex = 0;
    for (let i = 0; i < load.a[0].length; i++) {
      const { s: start, e: end, d: dynamicImportIndex } = load.a[0][i];
      // dependency source replacements
      if (dynamicImportIndex === -1) {
        const depLoad = depLoads[depIndex++];
        let blobUrl = depLoad.b;
        if (!blobUrl) {
          // circular shell creation
          if (!(blobUrl = depLoad.s)) {
            let hasDefault = false;
            blobUrl = depLoad.s = createBlob(`export function u$_(m){${
                depLoad.a[1].map(
                  n => name === 'default' ? `$_default=m.default` : `${n}=m.${n}`
                ).join(',')
              }}${
                depLoad.a[1].map(name => 
                  name === 'default' ? (hasDefault = true, `let $_default;export{$_default as default}`) : `export let ${name}`
                ).join(';')
              }`);
          }
        }
        // circular shell execution
        else if (depLoad.s) {
          resolvedSource += source.slice(lastIndex, start) + blobUrl + source[end] + ';\n' + renderShellExec(depIndex, depLoad.b, depLoad.s);
          lastIndex = end + 1;
          depLoad.s = undefined;
          continue;
        }
        resolvedSource += source.slice(lastIndex, start) + blobUrl;
        lastIndex = end;
      }
      // import.meta
      else if (dynamicImportIndex === -2) {
        meta[load.u] = { url: load.u };
        resolvedSource += source.slice(lastIndex, start) + 'importShim.m[' + JSON.stringify(load.u) + ']';
        lastIndex = end;
      }
      // dynamic import
      else {
        resolvedSource += source.slice(lastIndex, start) + 'importShim' + source.slice(end, dynamicImportIndex) + JSON.stringify(load.u) + ', ';
        lastIndex = dynamicImportIndex;
      }
    }
    resolvedSource += source.slice(lastIndex);
  }

  load.b = createBlob(resolvedSource);
  return load;
}
function createBlob (source) {
  // TODO: test if it is faster to use combined string, or array of uncombined strings here
  return URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
}
function renderShellExec (index, blobUrl, shellUrl) {
  return `import * as m$_${index} from '${blobUrl}';
import { u$_ as u$_${index} } from '${shellUrl}';
u$_${index}(m$_${index})`;
}
function getOrCreateLoad (url, source) {
  let load = registry[url];
  if (load)
    return load;

  load = registry[url] = {
    // url
    u: url,
    // fetchPromise
    fP: undefined,
    // depsPromise
    dP: undefined,
    // analysis
    a: undefined,
    // deps
    d: undefined,
    // blobUrl
    b: undefined,
    // shellUrl
    s: undefined,
  };

  if (url.endsWith('.wasm')) {
    load.f = (async () => {
      const res = await fetch(url);
      const module = await WebAssembly.compileStreaming(res);

      wasmModules[url] = module;
      
      if (WebAssembly.Module.imports)
        load.d = WebAssembly.Module.imports(module).map(impt => impt.module);
      else
        load.d = [];

      const aDeps = [];
      load.a = [aDeps, WebAssembly.Module.exports(module).map(expt => expt.name)];

      const depStrs = load.d.map(dep => JSON.stringify(dep));

      let curIndex = 0;
      return depStrs.map((depStr, idx) => {
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
        `const module=importShim.w[${JSON.stringify(url)}];` +
        `const exports=new WebAssembly.Instance(module,{` +
        depStrs.map((depStr, idx) => `${depStr}:m${idx},`).join('') +
        `}).exports;` +
        load.a[1].map(name => name === 'default' ? `export default exports.${name}` : `export const ${name}=exports.${name}`).join(';')
    })();
  }
  else {
    load.f = (async () => {
      if (!source) {
        const res = await fetch(url);
        source = await res.text();
      }
      load.a = analyzeModuleSyntax(source);
      if (load.a[2])
        importShim.e = [source, load.a[2]];
      load.d = load.a[0].filter(d => d.d === -1).map(d => source.slice(d.s, d.e));
      
      return source;
    })();
  }

  load.dP = load.f.then(() => Promise.all(
    load.d.map(async depId => {
      const load = getOrCreateLoad(await resolve(depId, url));
      await load.f;
      return load;
    })
  ));

  return load;
}

let packageMapPromise, packageMapResolve;
if (typeof document !== 'undefined') {
  const scripts = document.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];
    if (script.type !== 'packagemap-shim')
      continue;
    if (packageMapResolve)
      break;
    if (!script.src) {
      packageMapResolve = createPackageMap(JSON.parse(script.innerHTML), pageBaseUrl);
      packageMapPromise = Promise.resolve();
    }
    else
      packageMapPromise = (async function () {
        const res = await fetch(script.src);
        try {
          const json = await res.json();
          packageMapResolve = createPackageMap(json, script.src);
          packageMapPromise = undefined;
        }
        catch (e) {
          packageMapResolve = throwBare;
          packageMapPromise = undefined;
          setTimeout(() => { throw e });
        }
      })();
  }

  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];
    if (script.type === 'module-shim') {
      if (script.src)
        topLevelLoad(script.src);
      else
        topLevelLoad(`${pageBaseUrl}anon-${id++}`, script.innerHTML);
    }
  }
}

if (!packageMapPromise)
  packageMapResolve = throwBare;

function throwBare (id, parentUrl) {
  throw new Error('Unable to resolve bare specifier "' + id + (parentUrl ? '" from ' + parentUrl : '"'));
}

async function resolve (id, parentUrl) {
  parentUrl = parentUrl || pageBaseUrl;

  const resolvedIfNotPlainOrUrl = resolveIfNotPlainOrUrl(id, parentUrl);
  if (resolvedIfNotPlainOrUrl)
    return resolvedIfNotPlainOrUrl;
  if (id.indexOf(':') !== -1)
    return id;

  // now just left with plain
  // (if not package map, packageMapResolve just throws)
  if (packageMapPromise)
    await packageMapPromise;
  
  return packageMapResolve(id, parentUrl) || throwBare(id, parentUrl);
}