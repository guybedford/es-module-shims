/* ES Module Shims 0.3.1 */
(function () {
  'use strict';

  let baseUrl;

  if (typeof document !== 'undefined') {
    const baseEl = document.querySelector('base[href]');
    if (baseEl)
      baseUrl = baseEl.href;
  }

  if (!baseUrl && typeof location !== 'undefined') {
    baseUrl = location.href.split('#')[0].split('?')[0];
    const lastSepIndex = baseUrl.lastIndexOf('/');
    if (lastSepIndex !== -1)
      baseUrl = baseUrl.slice(0, lastSepIndex + 1);
  }

  let esModuleShimsSrc;
  if (typeof document !== 'undefined') {
    esModuleShimsSrc = document.currentScript && document.currentScript.src;
  }

  const backslashRegEx = /\\/g;
  function resolveIfNotPlainOrUrl (relUrl, parentUrl) {
    // strip off any trailing query params or hashes
    parentUrl = parentUrl && parentUrl.split('#')[0].split('?')[0];
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
        pathname = parentUrl.slice(parentProtocol.length + (parentUrl[parentProtocol.length] === '/'));
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
   * Import maps implementation
   *
   * To make lookups fast we pre-resolve the entire import map
   * and then match based on backtracked hash lookups
   *
   */

  function resolveUrl (relUrl, parentUrl) {
    return resolveIfNotPlainOrUrl(relUrl, parentUrl) ||
        relUrl.indexOf(':') !== -1 && relUrl ||
        resolveIfNotPlainOrUrl('./' + relUrl, parentUrl);
  }

  function resolvePackages(pkgs, baseUrl) {
    var outPkgs = {};
    for (var p in pkgs) {
      var value = pkgs[p];
      if (Array.isArray(value))
        value = value.find(v => !v.startsWith('std:'));
      if (typeof value === 'string')
        outPkgs[resolveIfNotPlainOrUrl(p, baseUrl) || p] = resolveUrl(value, baseUrl);
    }
    return outPkgs;
  }

  function parseImportMap (json, baseUrl) {
    const imports = resolvePackages(json.imports, baseUrl) || {};
    const scopes = {};
    if (json.scopes) {
      for (let scopeName in json.scopes) {
        const scope = json.scopes[scopeName];
        let resolvedScopeName = resolveUrl(scopeName, baseUrl);
        if (resolvedScopeName[resolvedScopeName.length - 1] !== '/')
          resolvedScopeName += '/';
        scopes[resolvedScopeName] = resolvePackages(scope, baseUrl) || {};
      }
    }

    return { imports: imports, scopes: scopes };
  }

  function getMatch (path, matchObj) {
    if (matchObj[path])
      return path;
    let sepIndex = path.length;
    do {
      const segment = path.slice(0, sepIndex + 1);
      if (segment in matchObj)
        return segment;
    } while ((sepIndex = path.lastIndexOf('/', sepIndex - 1)) !== -1)
  }

  function applyPackages (id, packages) {
    const pkgName = getMatch(id, packages);
    if (pkgName) {
      const pkg = packages[pkgName];
      if (pkg === null) return;
      if (id.length > pkgName.length && pkg[pkg.length - 1] !== '/')
        console.warn("Invalid package target " + pkg + " for '" + pkgName + "' should have a trailing '/'.");
      return pkg + id.slice(pkgName.length);
    }
  }

  const protocolre = /^[a-z][a-z0-9.+-]*\:/i;
  function resolveImportMap (id, parentUrl, importMap) {
    const urlResolved = resolveIfNotPlainOrUrl(id, parentUrl) || id.indexOf(':') !== -1 && id;
    if (urlResolved){
      id = urlResolved;
    } else if (protocolre.test(id)) { // non-relative URL with protocol
      return id;
    }
    const scopeName = importMap.scopes && getMatch(parentUrl, importMap.scopes);
    if (scopeName) {
      const scopePackages = importMap.scopes[scopeName];
      const packageResolution = applyPackages(id, scopePackages);
      if (packageResolution)
        return packageResolution;
    }
    return importMap.imports && applyPackages(id, importMap.imports) || urlResolved || throwBare(id, parentUrl);
  }

  function throwBare (id, parentUrl) {
    throw new Error('Unable to resolve bare specifier "' + id + (parentUrl ? '" from ' + parentUrl : '"'));
  }

  function createBlob (source) {
    return URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
  }

  /* es-module-lexer 0.3.11 */
  function parse(Q,B="@"){if(!A)return init.then(()=>parse(Q));const C=(A.__heap_base.value||A.__heap_base)+4*Q.length+-A.memory.buffer.byteLength;if(C>0&&A.memory.grow(Math.ceil(C/65536)),function(A,Q){const B=A.length;let C=0;for(;C<B;)Q[C]=A.charCodeAt(C++);}(Q,new Uint16Array(A.memory.buffer,A.sa(Q.length),Q.length+1)),!A.parse())throw Object.assign(new Error(`Parse error ${B}:${Q.slice(0,A.e()).split("\n").length}:${A.e()-Q.lastIndexOf("\n",A.e()-1)}`),{idx:A.e()});const E=[],g=[];for(;A.ri();)E.push({s:A.is(),e:A.ie(),d:A.id()});for(;A.re();)g.push(Q.slice(A.es(),A.ee()));return [E,g]}let A;const init=WebAssembly.compile((A=>"function"==typeof atob?Uint8Array.from(atob(A),A=>A.charCodeAt(0)):Buffer.from(A,"base64"))("AGFzbQEAAAABWw1gAABgAX8Bf2ADf39/AGACf38AYAABf2AGf39/f39/AX9gBH9/f38Bf2ADf39/AX9gB39/f39/f38Bf2ACf38Bf2AIf39/f39/f38Bf2AFf39/f38Bf2ABfwADLCsAAQIDBAQEBAQEBAQBAQUAAAAAAAAAAQEBAQAAAQUGBwgJCgsEDAEBBAgKBAUBcAEBAQUDAQABBhUDfwFB4MgAC38AQeDIAAt/AEHcCAsHWQ0GbWVtb3J5AgALX19oZWFwX2Jhc2UDAQpfX2RhdGFfZW5kAwICc2EAAQFlAAQCaXMABQJpZQAGAmlkAAcCZXMACAJlZQAJAnJpAAoCcmUACwVwYXJzZQAMCqkqKwIAC2gBAX9BACAANgK0CEEAKAKMCCIBIABBAXRqIgBBADsBAEEAIABBAmoiADYCuAhBACAANgK8CEEAQQA2ApQIQQBBADYCpAhBAEEANgKcCEEAQQA2ApgIQQBBADYCrAhBAEEANgKgCCABC1cBAn9BACgCpAgiA0EMakGUCCADG0EAKAK8CCIENgIAQQAgBDYCpAhBACADNgKoCEEAIARBEGo2ArwIIARBADYCDCAEIAI2AgggBCABNgIEIAQgADYCAAtIAQF/QQAoAqwIIgJBCGpBmAggAhtBACgCvAgiAjYCAEEAIAI2AqwIQQAgAkEMajYCvAggAkEANgIIIAIgATYCBCACIAA2AgALCABBACgCwAgLFQBBACgCnAgoAgBBACgCjAhrQQF1CxUAQQAoApwIKAIEQQAoAowIa0EBdQs7AQF/AkACQEEAKAKcCCgCCCIAQQAoAoAIRg0AIABBACgChAhGDQEgAEEAKAKMCGtBAXUPC0F/DwtBfgsVAEEAKAKgCCgCAEEAKAKMCGtBAXULFQBBACgCoAgoAgRBACgCjAhrQQF1CyUBAX9BAEEAKAKcCCIAQQxqQZQIIAAbKAIAIgA2ApwIIABBAEcLJQEBf0EAQQAoAqAIIgBBCGpBmAggABsoAgAiADYCoAggAEEARwuSBwEFfyMAQYAoayIBJABBAEH/AToAxghBAEEAKAKICDYCyAhBAEEAKAKMCEF+aiICNgLUCEEAIAJBACgCtAhBAXRqIgM2AtgIQQBBADoAxQhBAEEAOgDECEEAQQA2AsAIQQBBADoAsAhBACABQYAgajYCzAhBACABNgLQCAN/QQAgAkECaiIENgLUCAJAAkACQAJAAkACQCACIANPDQAgBC8BACIDQXdqQQVJDQUCQAJAAkACQAJAAkACQAJAAkACQAJAAkACQCADQWBqIgVBCU0NACADQS9GDQEgA0HgAEYNAyADQf0ARg0CIANB6QBGDQQgA0H7AEYNBSADQeUARw0RQQAtAMUIDREgBBANRQ0RIAJBBGpB+ABB8ABB7wBB8gBB9AAQDkUNERAPDBELAkACQAJAAkAgBQ4KFRQAFBQUFAECAxULEBAMEwsQEQwSC0EAQQAsAMUIIgJBAWo6AMUIQQAoAtAIIAJBAnRqQQAoAsgINgIADBELQQAtAMUIIgJFDQ1BACACQX9qIgM6AMUIQQAoAqQIIgJFDRAgAigCCEEAKALQCCADQRh0QRh1QQJ0aigCAEcNECACIAQ2AgQMEAsgAi8BBCICQSpGDQUgAkEvRw0GEBIMEAtBAEEALQDFCCICQX9qIgM6AMUIIAJBACwAxggiBEH/AXFHDQNBAEEALQDECEF/aiICOgDECEEAQQAoAswIIAJBGHRBGHVqLQAAOgDGCAsQEwwNCyAEEA1FDQwgAkEEakHtAEHwAEHvAEHyAEH0ABAORQ0MEBQMDAtBACgCyAgiAi8BAEEpRw0EQQAoAqQIIgNFDQQgAygCBCACRw0EQQBBACgCqAgiAzYCpAggA0UNAyADQQA2AgwMBAsgA0EYdEEYdSAETg0KDAcLEBUMCgtBACgCyAgiAy8BACICEBYNByACQf0ARg0CIAJBKUcNA0EAKALQCEEALADFCEECdGooAgAQFw0HDAMLQQBBADYClAgLQQBBACwAxQgiA0EBajoAxQhBACgC0AggA0ECdGogAjYCAAwGC0EAKALQCEEALADFCEECdGooAgAQGA0ECyADEBkhAyACRQ0DIANFDQQMAwtBAC0AxghB/wFGQQAtALAIQQAtAMUIckVxIQIMAQsQGkEAIQILIAFBgChqJAAgAg8LEBsLQQBBACgC1Ag2AsgIC0EAKALYCCEDQQAoAtQIIQIMAAsLHQACQEEAKAKMCCAARg0AIABBfmovAQAQHA8LQQELPwEBf0EAIQYCQCAALwEIIAVHDQAgAC8BBiAERw0AIAAvAQQgA0cNACAALwECIAJHDQAgAC8BACABRiEGCyAGC9EFAQN/QQBBACgC1AhBDGoiADYC1AgQJCEBAkACQAJAAkBBACgC1AgiAiAARw0AIAEQJkUNAQsCQAJAAkACQAJAIAFBn39qIgBBC0sNAAJAAkAgAA4MAAcDBAcBBwcHBwcGAAtBACACQQpqNgLUCBAkGkEAKALUCCECC0EAIAJBEGo2AtQIAkAQJCICQSpHDQBBAEEAKALUCEECajYC1AgQJCECC0EAKALUCCEBIAIQJxogAUEAKALUCBADQQBBACgC1AhBfmo2AtQIDwsCQCABQSpGDQAgAUH2AEYNBCABQfsARw0FQQAgAkECajYC1AgQJCEBQQAoAtQIIQADQCABQf//A3EQJxpBACgC1AghAgJAECQiAUHhAEcNAEEAQQAoAtQIQQRqNgLUCBAkIQJBACgC1AghACACECcaQQAoAtQIIQIQJCEBCwJAIAFBLEcNAEEAQQAoAtQIQQJqNgLUCBAkIQELIAAgAhADQQAoAtQIIgIgAEYNCCACQQAoAtgISw0IIAIhACABQf0ARw0ACwtBACACQQJqNgLUCBAkQeYARw0EQQAoAtQIIgIvAQZB7QBHDQQgAi8BBEHvAEcNBCACQQJqLwEAQfIARw0EQQAgAkEIajYC1AgQJBAlDwsgAi8BCEHzAEcNASACLwEGQfMARw0BIAIvAQRB4QBHDQEgAkECai8BAEHsAEcNASACLwEKEBxFDQFBACACQQpqNgLUCBAkIQJBACgC1AghASACECcaIAFBACgC1AgQA0EAQQAoAtQIQX5qNgLUCA8LIAIgAkEOahADDwtBACACQQRqIgI2AtQIC0EAIAJBBmo2AtQIA0AQJCEBQQAoAtQIIQIgARAnIgFBIHJB+wBGDQJBACgC1AgiACACRg0BIAIgABADQQBBACgC1AhBAmo2AtQIIAFBLEYNAAsLDwtBAEEAKALUCEF+ajYC1AgPCxAaC3IBBH9BACgC1AghAEEAKALYCCEBAkACQANAIABBAmohAiAAIAFPDQECQCACLwEAIgNB3ABGDQAgA0EKRg0CIANBDUYNAiACIQAgA0EiRw0BDAMLIABBBGohAAwACwtBACACNgLUCBAaDwtBACACNgLUCAtyAQR/QQAoAtQIIQBBACgC2AghAQJAAkADQCAAQQJqIQIgACABTw0BAkAgAi8BACIDQdwARg0AIANBCkYNAiADQQ1GDQIgAiEAIANBJ0cNAQwDCyAAQQRqIQAMAAsLQQAgAjYC1AgQGg8LQQAgAjYC1AgLSwEEf0EAKALUCEECaiEAQQAoAtgIIQECQANAIAAiAkF+aiABTw0BIAIvAQAiA0ENRg0BIAJBAmohACADQQpHDQALC0EAIAI2AtQIC8ABAQR/QQAoAtQIIQBBACgC2AghAQJAAkADQCAAIgJBAmohACACIAFPDQECQCAALwEAIgNBJEYNAAJAIANB3ABGDQAgA0HgAEcNAgwECyACQQRqIQAMAQsgAi8BBEH7AEcNAAtBACACQQRqNgLUCEEAQQAsAMQIIgBBAWo6AMQIIABBACgCzAhqQQAtAMYIOgAAQQBBAC0AxQhBAWoiADoAxghBACAAOgDFCA8LQQAgADYC1AgQGg8LQQAgADYC1AgL5gIBBH9BAEEAKALUCCIAQQxqIgE2AtQIAkACQAJAAkACQAJAAkAQJCICQVlqIgNBB0sNAAJAIAMOCAMAAgMCAgIEAwtBACgC0AhBACwAxQgiA0ECdGogADYCAEEAIANBAWo6AMUIQQAoAsgILwEAQS5GDQRBACgC1AhBAmpBACAAEAIPCyACQSJGDQEgAkH7AEYNAQtBACgC1AggAUYNAgsCQEEALQDFCEUNAEEAQQAoAtQIQX5qNgLUCA8LQQAoAtQIIQNBACgC2AghAAJAA0AgAyAATw0BIAMvAQAiAkEnRg0EIAJBIkYNBEEAIANBAmoiAzYC1AgMAAsLEBoPC0EAQQAoAtQIQQJqNgLUCBAkQe0ARw0AQQAoAtQIIgMvAQZB4QBHDQAgAy8BBEH0AEcNACADQQJqLwEAQeUARw0AQQAoAsgILwEAQS5HDQILDwsgAhAlDwsgACADQQhqQQAoAoQIEAILeQECf0EAQQAoAtQIIgBBAmo2AtQIIABBBmohAEEAKALYCCEBAkACQAJAA0AgAEF8aiABTw0BAkAgAEF+ai8BAEEqRw0AIAAvAQBBL0YNAwsgAEECaiEADAALCyAAQX5qIQAMAQtBACAAQX5qNgLUCAtBACAANgLUCAtsAQF/AkACQCAAQV9qIgFBBUsNAEEBIAF0QTFxDQELIABBRmpB//8DcUEGSQ0AIABBWGpB//8DcUEHSSAAQSlHcQ0AIABB2wBGDQAgAEHeAEYNACAAQf0ARyAAQYV/akH//wNxQQRJcQ8LQQELPQEBf0EBIQECQCAAQfcAQegAQekAQewAQeUAEB0NACAAQeYAQe8AQfIAEB4NACAAQekAQeYAEB8hAQsgAQtJAQJ/QQEhAQJAIAAvAQAiAkEpRg0AIAJBO0YNAAJAIAJB+QBHDQAgAEF+akHmAEHpAEHuAEHhAEHsAEHsABAgDwtBACEBCyABC+EDAQJ/QQAhAQJAAkACQAJAIAAvAQBBnH9qIgJBE0sNAAJAAkACQAJAAkACQAJAAkACQAJAIAIOFAABAwoKCgoKCgoEBQoKAgoGCgoHAAsgAEF+ai8BACICQewARg0KIAJB6QBHDQkgAEF8akH2AEHvABAfDwsgAEF+ai8BACICQfQARg0GIAJB8wBHDQggAEF8ai8BACICQeEARg0KIAJB7ABHDQggAEF6akHlABAhDwsgAEF+akHkAEHlAEHiAEH1AEHnAEHnAEHlABAiDwsgAEF+ai8BAEHvAEcNBiAAQXxqLwEAQeUARw0GIABBemovAQAiAkHwAEYNCSACQeMARw0GIABBeGpB6QBB7gBB8wBB9ABB4QBB7gAQIA8LQQEhASAAQX5qIgBB6QAQIQ0FIABB8gBB5QBB9ABB9QBB8gAQHQ8LIABBfmpB5AAQIQ8LIABBfmpB4QBB9wBB4QBB6QAQIw8LIABBfmovAQAiAkHvAEYNASACQeUARw0CIABBfGpB7gAQIQ8LIABBfGpB5ABB5QBB7ABB5QAQIw8LIABBfGpB9ABB6ABB8gAQHiEBCyABDwsgAEF8akH5AEHpAEHlABAeDwsgAEF6akHjABAhDwsgAEF4akH0AEH5ABAfCzUBAX9BAEEBOgCwCEEAKALUCCEAQQBBACgC2AhBAmo2AtQIQQAgAEEAKAKMCGtBAXU2AsAIC3EBAn8CQAJAA0BBAEEAKALUCCIBQQJqIgA2AtQIIAFBACgC2AhPDQECQAJAIAAvAQAiAEHbAEYNACAAQdwARg0BIABBCkYNAyAAQQ1GDQMgAEEvRw0CDAQLECgaDAELQQAgAUEEajYC1AgMAAsLEBoLCzUBAX8CQAJAIABBd2pB//8DcSIBQRhPDQBBn4CABCABdkEBcQ0BCyAAQS5HIAAQJnEPC0EBC0kBA39BACEGAkACQCAAQXhqIgdBACgCjAgiCEkNACAHIAEgAiADIAQgBRAORQ0AIAcgCEYNASAAQXZqLwEAEBwhBgsgBg8LQQELWQEDf0EAIQQCQAJAIABBfGoiBUEAKAKMCCIGSQ0AIAAvAQAgA0cNACAAQX5qLwEAIAJHDQAgBS8BACABRw0AIAUgBkYNASAAQXpqLwEAEBwhBAsgBA8LQQELTAEDf0EAIQMCQAJAIABBfmoiBEEAKAKMCCIFSQ0AIAAvAQAgAkcNACAELwEAIAFHDQAgBCAFRg0BIABBfGovAQAQHCEDCyADDwtBAQtLAQN/QQAhBwJAAkAgAEF2aiIIQQAoAowIIglJDQAgCCABIAIgAyAEIAUgBhApRQ0AIAggCUYNASAAQXRqLwEAEBwhBwsgBw8LQQELPQECf0EAIQICQAJAQQAoAowIIgMgAEsNACAALwEAIAFHDQAgAyAARg0BIABBfmovAQAQHCECCyACDwtBAQtNAQN/QQAhCAJAAkAgAEF0aiIJQQAoAowIIgpJDQAgCSABIAIgAyAEIAUgBiAHECpFDQAgCSAKRg0BIABBcmovAQAQHCEICyAIDwtBAQtmAQN/QQAhBQJAAkAgAEF6aiIGQQAoAowIIgdJDQAgAC8BACAERw0AIABBfmovAQAgA0cNACAAQXxqLwEAIAJHDQAgBi8BACABRw0AIAYgB0YNASAAQXhqLwEAEBwhBQsgBQ8LQQELbgEDf0EAKALUCCEAAkADQAJAIAAvAQAiAUF3akEFSQ0AIAFBIEYNACABQS9HDQICQCAALwECIgBBKkYNACAAQS9HDQMQEgwBCxAVC0EAQQAoAtQIIgJBAmoiADYC1AggAkEAKALYCEkNAAsLIAELYAACQAJAIABBIkYNACAAQSdHDQFBAEEAKALUCEECaiIANgLUCBARIABBACgC1AhBACgCgAgQAg8LQQBBACgC1AhBAmoiADYC1AgQECAAQQAoAtQIQQAoAoAIEAIPCxAaC2MBAX8CQAJAIABBX2oiAUEFSw0AQQEgAXRBMXENAQsgAEH4/wNxQShGDQAgAEFGakH//wNxQQZJDQACQCAAQaV/aiIBQQNLDQAgAUEBRw0BCyAAQYV/akH//wNxQQRJDwtBAQtlAQJ/AkACQANAAkAgAEH//wNxIgFBd2oiAkEXSw0AQQEgAnRBn4CABHENAgsgACECIAEQJg0CQQAhAkEAQQAoAtQIIgBBAmo2AtQIIAAvAQIiAA0ADAILCyAAIQILIAJB//8DcQt4AQR/QQAoAtQIIQBBACgC2AghAQJAAkADQCAAQQJqIQIgACABTw0BAkAgAi8BACIDQdwARg0AIANBCkYNAiADQQ1GDQIgAiEAIANB3QBHDQEMAwsgAEEEaiEADAALC0EAIAI2AtQIEBpBAA8LQQAgAjYC1AhB3QALSQEBf0EAIQcCQCAALwEKIAZHDQAgAC8BCCAFRw0AIAAvAQYgBEcNACAALwEEIANHDQAgAC8BAiACRw0AIAAvAQAgAUYhBwsgBwtTAQF/QQAhCAJAIAAvAQwgB0cNACAALwEKIAZHDQAgAC8BCCAFRw0AIAAvAQYgBEcNACAALwEEIANHDQAgAC8BAiACRw0AIAAvAQAgAUYhCAsgCAsLbQMAQYAICxABAAAAAgAAABAEAABgJAAAAEGQCAsCAAAAQZQIC0gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")).then(WebAssembly.instantiate).then(({exports:Q})=>{A=Q;});

  class WorkerShim {
    constructor(aURL, options = {}) {
      if (options.type !== 'module')
        return new Worker(aURL, options);

      if (!esModuleShimsSrc)
        throw new Error('es-module-shims.js must be loaded with a script tag for WorkerShim support.');

      const workerScriptUrl = createBlob(
        `importScripts('${esModuleShimsSrc}');importShim.map=${JSON.stringify(options.importMap || {})};importShim('${new URL(aURL, baseUrl).href}').catch(e=>setTimeout(()=>{throw e}))`
      );

      return new Worker(workerScriptUrl, Object.assign({}, options, { type: undefined }));
    }
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
            importShim.e ? reject(importShim.e) : resolve(importShim.l, baseUrl);
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
    await init;
    const load = getOrCreateLoad(url, source);
    await loadAll(load, {});
    resolveDeps(load, {});
    const module = await dynamicImport(load.b);
    // if the top-level load is a shell, run its update function
    if (load.s)
      (await dynamicImport(load.s)).u$_(module);
    return module;
  }

  async function importShim (id, parentUrl) {
    return topLevelLoad(await resolve(id, parentUrl || baseUrl));
  }

  self.importShim = importShim;

  const meta = {};
  const wasmModules = {};

  Object.defineProperties(importShim, {
    map: { value: {}, writable: true },
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

    const lastNonEmptyLine = resolvedSource.slice(resolvedSource.trimEnd().lastIndexOf('\n') + 1);
    load.b = createBlob(resolvedSource + (lastNonEmptyLine.startsWith('//# sourceMappingURL=') ? '\n//# sourceMappingURL=' + resolveUrl(lastNonEmptyLine.slice(21), load.r) : '') + '\n//# sourceURL=' + load.r);
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

        if (res.url.endsWith('.wasm')) {
          const module = wasmModules[url] = await (WebAssembly.compileStreaming ? WebAssembly.compileStreaming(res) : WebAssembly.compile(await res.arrayBuffer()));

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
        if (res.url.endsWith('.json'))
          source = `export default JSON.parse(${JSON.stringify(source)})`;
        if (res.url.endsWith('.css'))
          source = `const s=new CSSStyleSheet();s.replaceSync(${JSON.stringify(source)});export default s`;
      }
      try {
        load.a = parse(source, load.u);
      }
      catch (e) {
        console.warn(e);
        console.warn(e.idx);
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
  if (typeof document !== 'undefined') {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      if (script.type === 'importmap-shim' && !importMapPromise) {
        if (script.src) {
          importMapPromise = (async function () {
            importShim.map = parseImportMap(await (await fetch(script.src)).json(), script.src.slice(0, script.src.lastIndexOf('/') + 1));
          })();
        }
        else {
          importShim.map = parseImportMap(JSON.parse(script.innerHTML), baseUrl);
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

  async function resolve (id, parentUrl) {
    if (importMapPromise)
      return importMapPromise
      .then(function () {
        return resolveImportMap(id, parentUrl, importShim.map);
      });

    return resolveImportMap(id, parentUrl, importShim.map);
  }

  self.WorkerShim = WorkerShim;

}());
