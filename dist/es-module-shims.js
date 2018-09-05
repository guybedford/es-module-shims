/* ES Module Shims 0.1.0 */
(function () {
  'use strict';

  let baseUrl;
  if (typeof location !== 'undefined') {
    baseUrl = location.href.split('#')[0].split('?')[0];
    const lastSepIndex = baseUrl.lastIndexOf('/');
    if (lastSepIndex !== -1)
      baseUrl = baseUrl.slice(0, lastSepIndex + 1);
  }

  const backslashRegEx = /\\/g;
  function resolveIfNotPlainOrUrl (relUrl, parentUrl) {
    if (relUrl.indexOf('\\') !== -1)
      relUrl = relUrl.replace(backslashRegEx, '/');
    // protocol-relative
    if (relUrl[0] === '/' && relUrl[1] === '/') {
      return parentUrl.slice(0, parentUrl.indexOf(':') + 1) + relUrl;
    }
    // relative-url
    else if (relUrl[0] === '.' && (relUrl[1] === '/' || relUrl[1] === '.' && (relUrl[2] === '/' || relUrl.length === 2 && (relUrl += '/')) ||
        relUrl.length === 1  && (relUrl += '/')) ||
        relUrl[0] === '/') {
      const parentProtocol = parentUrl.slice(0, parentUrl.indexOf(':') + 1);
      // Disabled, but these cases will give inconsistent results for deep backtracking
      //if (parentUrl[parentProtocol.length] !== '/')
      //  throw new Error('Cannot resolve');
      // read pathname from parent URL
      // pathname taken to be part after leading "/"
      let pathname;
      if (parentUrl[parentProtocol.length + 1] === '/') {
        // resolving to a :// so we need to read out the auth and host
        if (parentProtocol !== 'file:') {
          pathname = parentUrl.slice(parentProtocol.length + 2);
          pathname = pathname.slice(pathname.indexOf('/') + 1);
        }
        else {
          pathname = parentUrl.slice(8);
        }
      }
      else {
        // resolving to :/ so pathname is the /... part
        pathname = parentUrl.slice(parentProtocol.length + 1);
      }

      if (relUrl[0] === '/')
        return parentUrl.slice(0, parentUrl.length - pathname.length - 1) + relUrl;

      // join together and split for removal of .. and . segments
      // looping the string instead of anything fancy for perf reasons
      // '../../../../../z' resolved to 'x/y' is just 'z'
      const segmented = pathname.slice(0, pathname.lastIndexOf('/') + 1) + relUrl;

      const output = [];
      let segmentIndex = -1;
      for (let i = 0; i < segmented.length; i++) {
        // busy reading a segment - only terminate on '/'
        if (segmentIndex !== -1) {
          if (segmented[i] === '/') {
            output.push(segmented.slice(segmentIndex, i + 1));
            segmentIndex = -1;
          }
        }

        // new segment - check if it is relative
        else if (segmented[i] === '.') {
          // ../ segment
          if (segmented[i + 1] === '.' && (segmented[i + 2] === '/' || i + 2 === segmented.length)) {
            output.pop();
            i += 2;
          }
          // ./ segment
          else if (segmented[i + 1] === '/' || i + 1 === segmented.length) {
            i += 1;
          }
          else {
            // the start of a new segment as below
            segmentIndex = i;
          }
        }
        // it is the start of a new segment
        else {
          segmentIndex = i;
        }
      }
      // finish reading out the last segment
      if (segmentIndex !== -1)
        output.push(segmented.slice(segmentIndex));
      return parentUrl.slice(0, parentUrl.length - pathname.length) + output.join('');
    }
  }

  /*
   * Package name maps implementation
   *
   * Reduced implementation - only a single scope level is supported
   * 
   * To make lookups fast we pre-resolve the entire package name map
   * and then match based on backtracked hash lookups
   * 
   * path_prefix in scopes not supported
   * nested scopes not supported
   */

  function resolveUrl (relUrl, parentUrl) {
    return resolveIfNotPlainOrUrl(relUrl, parentUrl) ||
        relUrl.indexOf(':') !== -1 && relUrl ||
        resolveIfNotPlainOrUrl('./' + relUrl, parentUrl);
  }

  function createPackageMap (json, baseUrl) {
    if (json.path_prefix) {
      baseUrl = resolveUrl(json.path_prefix, pageBaseUrl);
      if (baseUrl[baseUrl.length - 1] !== '/')
        baseUrl += '/';
    }
      
    const basePackages = json.packages || {};
    const scopes = {};
    if (json.scopes) {
      for (let scopeName in json.scopes) {
        const scope = json.scopes[scopeName];
        if (scope.path_prefix)
          throw new Error('Scope path_prefix not currently supported');
        if (scope.scopes)
          throw new Error('Nested scopes not currently supported');
        let resolvedScopeName = resolveUrl(scopeName, baseUrl);
        if (resolvedScopeName[resolvedScopeName.length - 1] === '/')
          resolvedScopeName = resolvedScopeName.substr(0, resolvedScopeName.length - 1);
        scopes[resolvedScopeName] = scope.packages || {};
      }
    }

    function getMatch (path, matchObj) {
      let sepIndex = path.length;
      do {
        const segment = path.slice(0, sepIndex);
        if (segment in matchObj)
          return segment;
      } while ((sepIndex = path.lastIndexOf('/', sepIndex - 1)) !== -1)
    }

    function applyPackages (id, packages, baseUrl) {
      const pkgName = getMatch(id, packages);
      if (pkgName) {
        const pkg = packages[pkgName];
        if (pkgName === id) {
          if (typeof pkg === 'string')
            return resolveUrl(pkg, baseUrl + pkgName + '/');
          if (!pkg.main)
            throw new Error('Package ' + pkgName + ' has no main');
          return resolveUrl(
            (pkg.path ? pkg.path + (pkg.path[pkg.path.length - 1] === '/' ? '' : '/') : pkgName + '/') + pkg.main,
            baseUrl
          );
        }
        else {
          return resolveUrl(
            (typeof pkg === 'string' || !pkg.path
              ? pkgName + '/'
              : pkg.path + (pkg.path[pkg.path.length - 1] === '/' ? '' : '/')
            ) + id.slice(pkgName.length + 1)
          , baseUrl);
        }
      }
    }

    return function (id, parentUrl) {
      const scopeName = getMatch(parentUrl, scopes);
      if (scopeName) {
        const scopePackages = scopes[scopeName];
        const packageResolution = applyPackages(id, scopePackages, scopeName + '/');
        if (packageResolution)
          return packageResolution;
      }
      return applyPackages(id, basePackages, baseUrl);
    };
  }

  // seeks through comments and multiline comments
  function isWs (charCode) {
    // Note there are even more than this - https://en.wikipedia.org/wiki/Whitespace_character#Unicode
    return charCode === 32/* */ || charCode === 9/*\t*/ || charCode === 12/*\f*/ || charCode === 11/*\v*/ || charCode === 160/*\u00A0*/ || charCode === 65279/*\ufeff*/;
  }
  function isBr (charCode) {
    // (8232 <LS> and 8233 <PS> omitted for now)
    return charCode === 10/*\n*/ || charCode === 13/*\r*/;
  }

  // TODO: update to regex approach which should be faster
  function commentWhitespace (str, index) {
    let inBlockComment = false;
    let inLineComment = false;
    let charCode;
    let nextCharCode = str.charCodeAt(index);
    while (charCode = nextCharCode) {
      nextCharCode = str.charCodeAt(++index);
      if (inLineComment) {
        if (isBr(charCode))
          inLineComment = false;
      }
      else if (inBlockComment) {
        if (charCode === 42/***/ && nextCharCode === 47/*/*/) {
          nextCharCode = str.charCodeAt(++index);
          inBlockComment = false;
        }
      }
      else {
        if (charCode === 47/*/*/) {
          if (nextCharCode === '/') {
            inLineComment = true;
          }
          else if (nextCharCode === 42/***/) {
            inBlockComment = true;
          }
          else continue;
          nextCharCode = str.charCodeAt(++index);
        }
        else if (!isWs(charCode) && !isBr(charCode)) {
          return index - 1;
        }
      }
    }
    return index;
  }

  function singleQuoteString (str, index) {
    let charCode = str.charCodeAt(index);
    while (charCode !== 39/*'*/) {
      charCode = str.charCodeAt(++index);
      if (charCode === 92/*\*/)
        charCode = str.charCodeAt(++index);
      if (isBr(charCode))
        throw new Error('Unexpected newline');
    }
    return index;
  }

  function doubleQuoteString (str, index) {
    let charCode = str.charCodeAt(index);
    while (charCode !== 34/*"*/) {
      charCode = str.charCodeAt(++index);
      if (charCode === 92/*\*/)
        charCode = str.charCodeAt(++index);
      if (isBr(charCode))
        throw new Error('Unexpected newline');
    }
    return index;
  }

  function regexCharacterClass (str, index) {
    let charCode = str.charCodeAt(index);
    while (charCode !== 93/*]*/) {
      charCode = str.charCodeAt(++index);
      if (charCode === 92/*\*/)
        charCode = str.charCodeAt(++index);
      if (isBr(charCode))
        throw new Error('Unexpected newline');
    }
    return index;
  }

  function regularExpression (str, index) {
    let charCode = str.charCodeAt(index);
    while (charCode !== 47/*/*/) {
      charCode = str.charCodeAt(++index);
      if (charCode === 91/*[*/)
        index = regexCharacterClass(str, index + 1);
      else if (charCode === 92/*\*/)
        charCode = str.charCodeAt(++index);
      if (isBr(charCode))
        throw new Error('Unexpected newline');
    }
    return index + 1;
  }

  function readPrecedingKeyword (str, endIndex) {
    let startIndex = endIndex;
    let nextChar = str.charCodeAt(startIndex - 1);
    while (nextChar >= 97/*a*/ && nextChar <= 122/*z*/)
      nextChar = str.charCodeAt(--startIndex - 1);
    // must be preceded by punctuator or whitespace
    if (isBr(nextChar) || isWs(nextChar) || nextChar === NaN || isPunctuator(nextChar))
      return str.slice(startIndex, endIndex);
  }

  function readToWsOrPunctuator (str, startIndex) {
    let endIndex = startIndex;
    let nextChar = str.charCodeAt(endIndex);
    while (nextChar && !isBr(nextChar) && !isWs(nextChar) && !isPunctuator(nextChar))
      nextChar = str.charCodeAt(++endIndex);
    return str.slice(startIndex, endIndex);
  }

  const expressionKeywords = {
    case: 1,
    debugger: 1,
    delete: 1,
    do: 1,
    else: 1,
    in: 1,
    instanceof: 1,
    new: 1,
    return: 1,
    throw: 1,
    typeof: 1,
    void: 1,
    yield: 1,
    await: 1
  };
  function isExpressionKeyword (str, lastTokenIndex) {
    const precedingKeyword = readPrecedingKeyword(str, lastTokenIndex);
    return precedingKeyword && expressionKeywords[precedingKeyword];
  }
  function isParenKeyword  (str, lastTokenIndex) {
    const precedingKeyword = readPrecedingKeyword(str, lastTokenIndex);
    return precedingKeyword && (
      precedingKeyword === 'while' ||
      precedingKeyword === 'for' ||
      precedingKeyword === 'if'
    );
  }
  function isPunctuator (charCode) {
    // 23 possible punctuator endings: !%&()*+,-./:;<=>?[]^{|~
    return charCode === 33 || charCode === 37 || charCode === 38 ||
      charCode > 39 && charCode < 48 || charCode > 57 && charCode < 64 ||
      charCode === 91 || charCode === 93 || charCode === 94;
  }
  function isExpressionPunctuator (charCode) {
    return charCode !== 93/*]*/ && charCode !== 41/*)*/ && isPunctuator(charCode);
  }
  function isExpressionTerminator (str, lastTokenIndex) {
    // detects:
    // ; ) -1 finally while do =>
    // as all of these followed by a { will indicate a statement brace
    switch (str.charCodeAt(lastTokenIndex)) {
      case 59/*;*/:
      case 41/*)*/:
      case NaN:
        return true;
      case 62/*>*/:
        return str.charCodeAt(lastTokenIndex - 1) === 63/*=*/;
      case 121/*y*/:
        return str.slice(lastTokenIndex - 7, lastTokenIndex - 1) === 'finall';
      case 101/*e*/:
        return str.slice(lastTokenIndex - 5, lastTokenIndex - 1) === 'whil';
      case 111/*o*/:
        return str.charCodeAt(lastTokenIndex - 1) === 100/*o*/;
    }
    return false;
  }

  function templateString (str, i, state) {
    let charCode;
    let nextCharCode = str.charCodeAt(i);
    while (charCode = nextCharCode) {
      if (charCode === 92/*\*/) {
        i += 2;
        nextCharCode = str.charCodeAt(i);
        continue;
      }
      else if (charCode === 36/*$*/) {
        nextCharCode = str.charCodeAt(++i);
        if (nextCharCode === 123/*{*/) {
          state.TS = { i: ++state.bD, n: state.TS };
          state.iT = false;
          state.tI = i;
          return i + 1;
        }
      }
      else if (charCode === 96/*`*/) {
        state.iT = false;
        state.tI = i;
        return i + 1;
      }
      nextCharCode = str.charCodeAt(++i);
    }
    throw new Error('Unterminated template string');
  }

  function base (str, index, state) {
    let i = commentWhitespace(str, index, state);
    switch (str.charCodeAt(i)) {
      case 123/*{*/:
        state.bD++;
      // fallthrough
      case 40/*(*/:
        state.tS = { i: state.tI, n: state.tS };
      break;
      
      case 125/*}*/:
        if (state.bD-- === state.TS.i) {
          state.TS = state.TS.n;
          state.iT = true;
          break;
        }
        else if (state.bD < state.TS.i) {
          throw new Error('Template variable brace mismatch');
        }
      // fallthrough
      case 41/*)*/:
        state.otI = state.tS.i;
        state.tS = state.tS.n;
      break;

      case 39/*'*/:
        i = singleQuoteString(str, i + 1);
      break;
      case 34/*"*/:
        i = doubleQuoteString(str, i + 1);
      break;

      case 96/*`*/:
        state.iT = true;
      break;

      case 47/*/*/: {
        /*
         * Division / regex ambiguity handling
         * based on checking backtrack analysis of:
         * - what token came previously (state.tI)
         * - what token came before the opening paren or brace (state.otI)
         * handles all known ambiguities
         */
        const lastTokenIndex = state.tI;
        if (isExpressionKeyword(str, lastTokenIndex) ||
            isExpressionPunctuator(str.charCodeAt(lastTokenIndex)) ||
            lastTokenIndex === 41/*)*/ && isParenKeyword(str, state.otI) ||
            lastTokenIndex === 125/*}*/ && isExpressionTerminator(str, state.otI))
          i = regularExpression(str, i + 1);
      }
      break;

      case 105/*i*/: {
        if (str.substr(i, 6) === 'import' && (readToWsOrPunctuator(str, i) === 'import' || str.charCodeAt(i + 6) === 46/*.*/)) {
          const start = i;
          i = commentWhitespace(str, i + 6);
          const charCode = str.charCodeAt(i);
          // dynamic import
          if (charCode === 40/*(*/) {
            // dynamic import indicated by positive d
            state.iS.push({ s: start, e: start + 6, d: i + 1 });
            state.tS = { i: state.tI, n: state.tS };
          }
          // import.meta
          else if (charCode === 46/*.*/) {
            i = commentWhitespace(str, i + 1);
            // import.meta indicated by d === -2
            if (readToWsOrPunctuator(str, i) === 'meta')
              state.iS.push({ s: start, e: i + 4, d: -2 });
          }
          // import statement (only permitted at base-level)
          else if (state.tS === null) {
            i = readSourceString(str, i, state);
          }
        }
      }
      break;
      case 101/*e*/: {
        if (state.tS === null && readToWsOrPunctuator(str, i) === 'export') {
          i = commentWhitespace(str, i + 6);
          switch (str.charCodeAt(i)) {
            // export default ...
            case 100/*d*/:
              state.eN.push('default');
            break;

            // export async? function*? name () {
            case 97/*a*/:
              i = commentWhitespace(str, i + 5);
            // fallthrough
            case 102/*f*/:
              i = commentWhitespace(str, i + 8);
              if (str.charCodeAt(i) === 42/***/)
                i = commentWhitespace(str, i + 1);
              state.eN.push(readToWsOrPunctuator(str, i));
            break;

            case 99/*c*/:
              if (readToWsOrPunctuator(str, i) === 'class') {
                i = commentWhitespace(str, i + 5);
                state.eN.push(readToWsOrPunctuator(str, i));
                break;
              }
              i += 2;
            // fallthrough

            // export var/let/const name = ...(, name = ...)+
            case 118/*v*/:
            case 108/*l*/:
              /*
               * destructured initializations not currently supported (skipped for { or [)
               * also, lexing names after variable equals is skipped (export var p = function () { ... }, q = 5 skips "q")
               */
              i += 3;
              do {
                i = commentWhitespace(str, i);
                const name = readToWsOrPunctuator(str, i);
                // stops on [ { destructurings
                if (!name.length)
                  break;
                state.eN.push(name);
                i = commentWhitespace(str, i + name.length);
              } while (str.charCodeAt(i) === 44/*,*/);
            break;

            // export {...}
            case 123/*{*/: {
              let name, charCode;
              i = commentWhitespace(str, i + 1);
              do {
                name = readToWsOrPunctuator(str, i);
                i = commentWhitespace(str, i + name.length);
                charCode = str.charCodeAt(i);
                // as
                if (charCode === 97/*a*/) {
                  i = commentWhitespace(str, i + 2);
                  name = readToWsOrPunctuator(str, i);
                  i = commentWhitespace(str, i + name.length);
                  charCode = str.charCodeAt(i);
                }
                state.eN.push(name);
              } while (charCode && charCode !== 125/*}*/);
              if (!charCode)
                throw new Error('Export brace mismatch.');
            } 
            // fallthrough

            // export *
            case 42/***/:
              i = commentWhitespace(str, i + 1);
              if (str.slice(i, i + 4) === 'from')
                i = readSourceString(str, i + 4, state);
          }
        }
      }
      break;
    }
    state.tI = i;
    return i + 1;
  }

  function readSourceString (str, i, state) {
    let charCode, start;
    while (charCode = str.charCodeAt(i)) {
      if (charCode === 39/*'*/) {
        i = singleQuoteString(str, start = i + 1);
        state.iS.push({ s: start, e: i, d: -1 });
        break;
      }
      if (charCode === 34/*"*/) {
        i = doubleQuoteString(str, start = i + 1);
        state.iS.push({ s: start, e: i, d: -1 });
        break;
      }
      i++;
    }
    return i;
  }

  function analyzeModuleSyntax (str) {
    const state = {
      // inTemplate
      iT: false,
      // lastTokenIndex
      tI: -1,
      // lastOpenTokenIndex
      otI: -1,
      // lastTokenIndexStack
      // linked list of the form { i (item): index, n (next): nextInList }
      tS: null,
      // braceDepth
      bD: 0,
      // templateStack
      TS: { i: -1, n: null },
      // importSources
      iS: [],
      // exportNames
      eN: []
    };
    
    const len = str.length;
    let index = 0;
    while (index < len)
      // NB: see if it is an optimization to pass str.charCodeAt(index) as an arg
      // TODO: regex optimization where possible
      if (state.iT)
        index = templateString(str, index, state);
      else
        index = base(str, index, state);
    
    return [state.iS, state.eN];
  }

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
    const parentUrl = arguments.length === 1 ? baseUrl : (id = arguments[1], id);
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
              blobUrl = depLoad.s = createBlob(`
              export function u$_(m){${
                depLoad.a[1].map(
                  n => name === 'default' ? `$_default=m.default` : `${n}=m.${n}`
                ).join(',')
              }}${
                depLoad.a[1].map(name => 
                  name === 'default' ? (`let $_default;export{$_default as default}`) : `export let ${name}`
                ).join(';')
              }
            `);
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
        try {
          load.a = analyzeModuleSyntax(source);
        }
        catch (e) {
          // importShim.error = [source, e];
          load.a = [[], []];
        }
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
        packageMapResolve = createPackageMap(JSON.parse(script.innerHTML), baseUrl);
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
          topLevelLoad(`${baseUrl}anon-${id++}`, script.innerHTML);
      }
    }
  }

  if (!packageMapPromise)
    packageMapResolve = throwBare;

  function throwBare (id, parentUrl) {
    throw new Error('Unable to resolve bare specifier "' + id + (parentUrl ? '" from ' + parentUrl : '"'));
  }

  async function resolve (id, parentUrl) {
    parentUrl = parentUrl || baseUrl;

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

}());
