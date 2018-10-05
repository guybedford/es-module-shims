/* ES Module Shims 0.1.13 */
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
      baseUrl = resolveUrl(json.path_prefix, baseUrl);
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
      return applyPackages(id, basePackages, baseUrl) || throwBare(id, parentUrl);
    };
  }

  function throwBare (id, parentUrl) {
    throw new Error('Unable to resolve bare specifier "' + id + (parentUrl ? '" from ' + parentUrl : '"'));
  }

  function analyzeModuleSyntax (_str) {
    str = _str;
    let err = null;
    try {
      baseParse();
    }
    catch (e) {
      err = e;
    }
    return [oImports, oExports, err];
  }

  // State:
  // (for perf, works because this runs sync)
  let i, charCode, str,
    lastTokenIndex,
    lastOpenTokenIndex,
    lastTokenIndexStack,
    braceDepth,
    templateDepth,
    templateStack,
    oImports,
    oExports;

  function baseParse () {
    lastTokenIndex = lastOpenTokenIndex = -1;
    oImports = [];
    oExports = [];
    braceDepth = 0;
    templateDepth = 0;
    templateStack = [];
    lastTokenIndexStack = [];
    i = -1;

    /*
     * This is just the simple loop:
     * 
     * while (charCode = str.charCodeAt(++i)) {
     *   // reads into the first non-ws / comment token
     *   commentWhitespace();
     *   // reads one token at a time
     *   parseNext();
     *   // stores the last (non ws/comment) token for division operator backtracking checks
     *   // (including on lastTokenIndexStack as we nest structures)
     *   lastTokenIndex = i;
     * }
     * 
     * Optimized by:
     * - Inlining comment whitespace to avoid repeated "/" checks (minor perf saving)
     * - Inlining the division operator check from "parseNext" into this loop
     * - Having "regularExpression()" start on the initial index (different to other parse functions)
     */
    while (charCode = str.charCodeAt(++i)) {
      // reads into the first non-ws / comment token
      if (isBrOrWs(charCode))
        continue;
      if (charCode === 47/*/*/) {
        charCode = str.charCodeAt(++i);
        if (charCode === 47/*/*/)
          lineComment();
        else if (charCode === 42/***/)
          blockComment();
        else {
          /*
           * Division / regex ambiguity handling
           * based on checking backtrack analysis of:
           * - what token came previously (lastTokenIndex)
           * - what token came before the opening paren or brace (lastOpenTokenIndex)
           *
           * Only known unhandled ambiguities are cases of regexes immediately followed
           * by division, another regex or brace:
           * 
           * /regex/ / x
           * 
           * /regex/
           * {}
           * /regex/
           * 
           * And those cases only show errors when containing "'/` in the regex
           * 
           * Could be fixed tracking stack of last regex, but doesn't seem worth it, and bad for perf
           */
          const lastTokenCode = str.charCodeAt(lastTokenIndex);
          if (!lastTokenCode || isExpressionKeyword(lastTokenIndex) ||
              isExpressionPunctuator(lastTokenCode) ||
              lastTokenCode === 41/*)*/ && isParenKeyword(lastOpenTokenIndex) ||
              lastTokenCode === 125/*}*/ && isExpressionTerminator(lastOpenTokenIndex))
            // TODO: perf improvement
            // it may be possible to precompute isParenKeyword and isExpressionTerminator checks
            // when they are added to the token stack, not here
            // this way we only need to store a stack of "regexTokenDepthStack" and "regexTokenDepth"
            // where depth is the combined brace and paren depth count
            // when leaving a brace or paren, this stack would be cleared automatically (if a match)
            // this check then becomes curDepth === regexTokenDepth for the lastTokenCode )|} case
            regularExpression();
          lastTokenIndex = i;
        }
      }
      else {
        parseNext();
        lastTokenIndex = i;
      }
    }
    if (braceDepth || templateDepth || lastTokenIndexStack.length)
      syntaxError();
  }

  function parseNext () {
    switch (charCode) {
      case 123/*{*/:
        braceDepth++;
      // fallthrough
      case 40/*(*/:
        
        lastTokenIndexStack.push(lastTokenIndex);
        return;
      
      case 125/*}*/:
        if (braceDepth-- === templateDepth) {
          templateDepth = templateStack.pop();
          templateString();
          return;
        }
        if (braceDepth < templateDepth)
          syntaxError();
      // fallthrough
      case 41/*)*/:
        if (!lastTokenIndexStack)
          syntaxError();
        lastOpenTokenIndex = lastTokenIndexStack.pop();
        return;

      case 39/*'*/:
        singleQuoteString();
        return;
      case 34/*"*/:
        doubleQuoteString();
        return;

      case 96/*`*/:
        templateString();
        return;

      case 105/*i*/: {
        if (readPrecedingKeyword(i + 5) !== 'import' || readToWsOrPunctuator(i + 6) !== '' && str.charCodeAt(i + 6) !== 46/*.*/)
          return;
        
        const start = i;
        charCode = str.charCodeAt(i += 6);
        commentWhitespace();
        switch (charCode) {
          // dynamic import
          case 40/*(*/:
            // dynamic import indicated by positive d
            lastTokenIndexStack.push(i + 5);
            oImports.push({ s: start, e: start + 6, d: i + 1 });
            return;
          // import.meta
          case 46/*.*/:
            commentWhitespace();
            // import.meta indicated by d === -2
            if (readToWsOrPunctuator(i + 1) === 'meta')
              oImports.push({ s: start, e: i + 5, d: -2 });
            return;
        }
        // import statement (only permitted at base-level)
        if (lastTokenIndexStack.length === 0) {
          readSourceString();
          return;
        }
      }
      
      case 101/*e*/: {
        if (lastTokenIndexStack.length !== 0 || readPrecedingKeyword(i + 5) !== 'export' || readToWsOrPunctuator(i + 6) !== '')
          return;
        
        let name;
        charCode = str.charCodeAt(i += 6);
        commentWhitespace();
        switch (charCode) {
          // export default ...
          case 100/*d*/:
            oExports.push('default');
            return;

          // export async? function*? name () {
          case 97/*a*/:
            charCode = str.charCodeAt(i += 5);
            commentWhitespace();
          // fallthrough
          case 102/*f*/:
            charCode = str.charCodeAt(i += 8);
            commentWhitespace();
            if (charCode === 42/***/)
              commentWhitespace();
            oExports.push(readToWsOrPunctuator(i));
            return;

          case 99/*c*/:
            if (readToWsOrPunctuator(i) === 'class') {
              charCode = str.charCodeAt(i += 5);
              commentWhitespace();
              oExports.push(readToWsOrPunctuator(i));
              return;
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
            do {
              charCode = str.charCodeAt(i += 3);
              commentWhitespace();
              name = readToWsOrPunctuator(i);
              // stops on [ { destructurings
              if (!name.length)
                return;
              oExports.push(name);
              charCode = str.charCodeAt(i += name.length);
              commentWhitespace();
            } while (charCode === 44/*,*/);
            return;

          // export {...}
          case 123/*{*/:
            charCode = str.charCodeAt(++i);
            commentWhitespace();
            do {
              name = readToWsOrPunctuator(i);
              charCode = str.charCodeAt(i += name.length);
              commentWhitespace();
              // as
              if (charCode === 97/*a*/) {
                charCode = str.charCodeAt(i += 2);
                commentWhitespace();
                name = readToWsOrPunctuator(i);
                charCode = str.charCodeAt(i += name.length);
                commentWhitespace();
              }
              // ,
              if (charCode === 44) {
                charCode = str.charCodeAt(++i);
                commentWhitespace();
              }
              oExports.push(name);
              if (!charCode)
                syntaxError();
            } while (charCode !== 125/*}*/);
          // fallthrough

          // export *
          case 42/***/:
            charCode = str.charCodeAt(++i);
            commentWhitespace();
            if (str.slice(i, i += 4) === 'from')
              readSourceString();
        }
      }
    }
  }


  /*
   * Helper functions
   */

  // seeks through whitespace, comments and multiline comments
  function commentWhitespace () {
    do {
      if (charCode === 47/*/*/) {
        const nextCharCode = str.charCodeAt(i + 1);
        if (nextCharCode === 47/*/*/) {
          charCode = nextCharCode;
          i++;
          lineComment();
        }
        else if (nextCharCode === 42/***/) {
          charCode = nextCharCode;
          i++;
          blockComment();
        }
        else {
          return;
        }
      }
      else if (!isBrOrWs(charCode)) {
        return;
      }
    } while (charCode = str.charCodeAt(++i));
  }

  function templateString () {
    while (charCode = str.charCodeAt(++i)) {
      if (charCode === 36/*$*/) {
        charCode = str.charCodeAt(++i);
        if (charCode === 123/*{*/) {
          templateStack.push(templateDepth);
          templateDepth = ++braceDepth;
          return;
        }
      }
      else if (charCode === 96/*`*/) {
        return;
      }
      else if (charCode === 92/*\*/) {
        charCode = str.charCodeAt(++i);
      }
    }
    syntaxError();
  }

  function readSourceString () {
    let start;
    do {
      if (charCode === 39/*'*/) {
        start = i + 1;
        singleQuoteString();
        oImports.push({ s: start, e: i, d: -1 });
        return;
      }
      if (charCode === 34/*"*/) {
        start = i + 1;
        doubleQuoteString();
        oImports.push({ s: start, e: i, d: -1 });
        return;
      }
    } while (charCode = str.charCodeAt(++i))
    syntaxError();
  }
  function isBr () {
    // (8232 <LS> and 8233 <PS> omitted for now)
    return charCode === 10/*\n*/ || charCode === 13/*\r*/;
  }

  function isBrOrWs (charCode) {
    return charCode > 8 && charCode < 14 || charCode === 32 || charCode === 160 || charCode === 65279;
  }

  function blockComment () {
    charCode = str.charCodeAt(++i);
    while (charCode) {
      if (charCode === 42/***/) {
        charCode = str.charCodeAt(++i);
        if (charCode === 47/*/*/)
          return;
        continue;
      }
      charCode = str.charCodeAt(++i);
    }
  }

  function lineComment () {
    while (charCode = str.charCodeAt(++i)) {
      if (isBr())
        return;
    }
  }

  function singleQuoteString () {
    while (charCode = str.charCodeAt(++i)) {
      if (charCode === 39/*'*/)
        return;
      if (charCode === 92/*\*/)
        i++;
      else if (isBr())
        syntaxError();
    }
    syntaxError();
  }

  function doubleQuoteString () {
    while (charCode = str.charCodeAt(++i)) {
      if (charCode === 34/*"*/)
        return;
      if (charCode === 92/*\*/)
        i++;
      else if (isBr())
        syntaxError();
    }
    syntaxError();
  }

  function regexCharacterClass () {
    while (charCode = str.charCodeAt(++i)) {
      if (charCode === 93/*]*/)
        return;
      if (charCode === 92/*\*/)
        i++;
      else if (isBr())
        syntaxError();
    }
    syntaxError();
  }

  function regularExpression () {
    do {
      if (charCode === 47/*/*/)
        return;
      if (charCode === 91/*[*/)
        regexCharacterClass();
      else if (charCode === 92/*\*/)
        i++;
      else if (isBr())
        syntaxError();
    } while (charCode = str.charCodeAt(++i));
    syntaxError();
  }

  function readPrecedingKeyword (endIndex) {
    let startIndex = endIndex;
    let nextChar = str.charCodeAt(startIndex);
    while (nextChar && nextChar > 96/*a*/ && nextChar < 123/*z*/)
      nextChar = str.charCodeAt(--startIndex);
    // must be preceded by punctuator or whitespace
    if (nextChar && !isBrOrWs(nextChar) && !isPunctuator(nextChar))
      return '';
    return str.slice(startIndex + 1, endIndex + 1);
  }

  function readToWsOrPunctuator (startIndex) {
    let endIndex = startIndex;
    let nextChar = str.charCodeAt(endIndex);
    while (nextChar && !isBrOrWs(nextChar) && !isPunctuator(nextChar))
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
  function isExpressionKeyword (lastTokenIndex) {
    return expressionKeywords[readPrecedingKeyword(lastTokenIndex)];
  }
  function isParenKeyword  (lastTokenIndex) {
    const precedingKeyword = readPrecedingKeyword(lastTokenIndex);
    return precedingKeyword === 'while' || precedingKeyword === 'for' || precedingKeyword === 'if';
  }
  function isPunctuator (charCode) {
    // 23 possible punctuator endings: !%&()*+,-./:;<=>?[]^{}|~
    return charCode === 33 || charCode === 37 || charCode === 38 ||
      charCode > 39 && charCode < 48 || charCode > 57 && charCode < 64 ||
      charCode === 91 || charCode === 93 || charCode === 94 ||
      charCode > 122 && charCode < 127;
  }
  function isExpressionPunctuator (charCode) {
    return isPunctuator(charCode) && charCode !== 93/*]*/ && charCode !== 41/*)*/ && charCode !== 125/*}*/;
  }
  function isExpressionTerminator (lastTokenIndex) {
    // detects:
    // ; ) -1 finally
    // as all of these followed by a { will indicate a statement brace
    // in future we will need: "catch" (optional catch parameters)
    //                         "do" (do expressions)
    switch (str.charCodeAt(lastTokenIndex)) {
      case 59/*;*/:
      case 41/*)*/:
      case NaN:
        return true;
      case 121/*y*/:
        return readPrecedingKeyword(lastTokenIndex) === 'finally';
    }
    return false;
  }

  function syntaxError () {
    // we just need the stack
    // this isn't shown to users, only for diagnostics
    throw new Error();
  }

  let id = 0;
  const registry = {};

  // support browsers without dynamic import support (eg Firefox 6x)
  let dynamicImport;
  try {
    dynamicImport = (0, eval)('u=>import(u)');
  }
  catch (e) {
    if (typeof document !== 'undefined') {
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
            if (importShim.e)
              return reject(importShim.e);
            resolve(importShim.l);
          });
        });
      };
    }  
  }

  async function loadAll (load, loaded) {
    if (load.b || loaded[load.u])
      return;
    loaded[load.u] = true;
    await load.L;
    await Promise.all(load.d.map(dep => loadAll(dep, loaded)));
  }

  async function topLevelLoad (url, source) {
    const load = getOrCreateLoad(url, source);
    await loadAll(load, {});
    resolveDeps(load, {});
    const module = await dynamicImport(load.b);
    // if the top-level load is a shell, run its update function
    if (load.s)
      (await dynamicImport(load.s)).u$_(module);
    return module;
  }

  async function importShim (id) {
    const parentUrl = arguments.length === 1 ? baseUrl : (id = arguments[1], arguments[0]);
    return topLevelLoad(await resolve(id, parentUrl));
  }

  self.importShim = importShim;

  const meta = {};
  const wasmModules = {};

  Object.defineProperties(importShim, {
    m: { value: meta },
    w: { value: wasmModules },
    l: { value: undefined, writable: true },
    e: { value: undefined, writable: true }
  });

  async function resolveDeps (load, seen) {
    if (load.b)
      return;
    seen[load.u] = true;

    let source = load.S;
    let resolvedSource;

    for (const depLoad of load.d)
      if (!seen[depLoad.u])
        resolveDeps(depLoad, seen);
    
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
                  name === 'default' ? (`let $_default;export{$_default as default}`) : `export let ${name}`
                ).join(';')
              }`);
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

    load.b = createBlob(resolvedSource + '\n//# sourceURL=' + load.u);
    load.S = undefined;
  }
  const createBlob = source => URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));

  function getOrCreateLoad (url, source) {
    let load = registry[url];
    if (load)
      return load;

    load = registry[url] = {
      // url
      u: url,
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

        if (res.url.endsWith('.wasm')) {
          const module = wasmModules[url] = await WebAssembly.compileStreaming(res);
      
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

        source = await res.text();
      }
      load.a = analyzeModuleSyntax(source);
      if (load.a[2])
        importShim.err = [source, load.a[2]];
      load.S = source;
      return load.a[0].filter(d => d.d === -1).map(d => source.slice(d.s, d.e));
    })();

    load.L = load.f.then(async deps => {
      load.d = await Promise.all(deps.map(async depId => {
        const load = getOrCreateLoad(await resolve(depId, url));
        await load.f;
        return load;
      }));
    });

    return load;
  }

  let packageMapPromise, packageMapResolve;
  if (typeof document !== 'undefined') {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      if (script.type === 'packagemap-shim' && !packageMapPromise) {
        if (script.src) {
          packageMapPromise = (async function () {
            packageMapResolve = createPackageMap(await (await fetch(script.src)).json(), script.src.slice(0, script.src.lastIndexOf('/') + 1));
            packageMapPromise = undefined;
          })();
        }
        else {
          packageMapPromise = Promise.resolve();
          packageMapResolve = createPackageMap(JSON.parse(script.innerHTML), baseUrl);
        }
      }
      // this works here because there is a .then before resolve
      else if (script.type === 'module-shim') {
        if (script.src)
          topLevelLoad(script.src);
        else
          topLevelLoad(`${baseUrl}?${id++}`, script.innerHTML);
      }
    }
  }

  if (!packageMapPromise)
    packageMapResolve = throwBare$1;

  function throwBare$1 (id, parentUrl) {
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
    
    return packageMapResolve(id, parentUrl);
  }

}());
