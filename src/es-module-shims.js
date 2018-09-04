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
        `import * as m from '${load.blobUrl}'; self.importShim.lastModule = m;`
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
URL.revokeObjectURL(testBlob);

async function topLevelLoad (url, source) {
  const load = await resolveDeps(getOrCreateLoad(url, source), {});
  return dynamicImport(
    !load.shellUrl
    ? load.blobUrl
    // create a dummy head importer for top-level cycle import
    : createBlob(renderShellExec(0, load.blobUrl, load.shellUrl) + ';\n')
  );
}

async function importShim (id) {
  const parentUrl = arguments.length === 1 ? pageBaseUrl : (id = arguments[1], id);
  return topLevelLoad(await resolve(id, parentUrl));
}

Object.defineProperty(self, 'importShim', { value: importShim });

const meta = Object.create(null);
Object.defineProperty(importShim, 'meta', { value: meta });

async function resolveDeps (load, seen) {
  seen[load.url] = true;

  const depLoads = await load.depsPromise;

  let source = await load.fetchPromise;
  let resolvedSource;

  if (depLoads.length)
    await Promise.all(depLoads.map(depLoad => {
      if (!seen[depLoad.url])
        return resolveDeps(depLoad, seen);
    }));

  if (!load.analysis[0].length) {
    resolvedSource = source;
  }
  else {
    // once all deps have loaded we can inline the dependency resolution blobs
    // and define this blob
    let lastIndex = 0;
    resolvedSource = '';
    let depIndex = 0;
    for (let i = 0; i < load.analysis[0].length; i++) {
      const { s: start, e: end, d: dynamicImportIndex } = load.analysis[0][i];
      // dependency source replacements
      if (dynamicImportIndex === -1) {
        const depLoad = depLoads[depIndex++];
        let blobUrl = depLoad.blobUrl;
        if (!blobUrl) {
          // circular shell creation
          if (!(blobUrl = depLoad.shellUrl)) {
            depLoad.shellDeps = [];
            blobUrl = depLoad.shellUrl = createBlob(
              `export let ${depLoad.analysis[1].join(',')};export function u$_(m){${depLoad.analysis[1].map(n => `${n}=m.${n}`).join(',')}}`
            );
          }
        }
        // circular shell execution
        else if (depLoad.shellUrl) {
          resolvedSource += source.slice(lastIndex, start) + blobUrl + source[end] + ';\n' + renderShellExec(depIndex, depLoad.blobUrl, depLoad.shellUrl);
          lastIndex = end + 1;
          depLoad.shellUrl = undefined;
          continue;
        }
        resolvedSource += source.slice(lastIndex, start) + blobUrl;
        lastIndex = end;
      }
      // import.meta
      else if (dynamicImportIndex === -2) {
        meta[load.url] = { url: load.url };
        resolvedSource += source.slice(lastIndex, start) + 'importShim.meta[' + JSON.stringify(load.url) + ']';
        lastIndex = end;
      }
      // dynamic import
      else {
        resolvedSource += source.slice(lastIndex, start) + 'importShim' + source.slice(end, dynamicImportIndex) + JSON.stringify(load.url) + ', ';
        lastIndex = dynamicImportIndex;
      }
    }
    resolvedSource += source.slice(lastIndex);
  }

  load.blobUrl = createBlob(resolvedSource);
  return load;
}
function createBlob (source) {
  // TODO: test if it is faster to use combined string, or array of uncombined strings here
  return URL.createObjectURL(new Blob([source], {type : 'application/javascript'}));
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
  
  const fetchPromise = source ? Promise.resolve(source) : fetch(url).then(res => res.text());

  const depsPromise = async () => {
    const source = await fetchPromise;
    try {
      load.analysis = analyzeModuleSyntax(source);
    }
    catch (e) {
      importShim.error = [source, e];
      load.analysis = [[], []];
    }
    load.deps = load.analysis[0].filter(d => d.d === -1).map(d => source.slice(d.s, d.e));
    return Promise.all(
      load.deps.map(async depId => {
        const load = getOrCreateLoad(await resolve(depId, url));
        await load.fetchPromise
        return load;
      })
    );
  };

  return load = registry[url] = {
    url,
    fetchPromise,
    depsPromise: depsPromise(),
    cycleDeps: undefined,
    analysis: undefined,
    deps: undefined,
    blobUrl: undefined,
    shellUrl: undefined,
    shellDeps: undefined
  };
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