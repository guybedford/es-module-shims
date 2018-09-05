import { commentWhitespace, isParenKeyword, isExpressionKeyword, isExpressionPunctuator, isExpressionTerminator, readToWsOrPunctuator, singleQuoteString, doubleQuoteString, regularExpression, isBr } from './lexer-helpers.js';

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
  throw new Error('Unterminated string');
}
let depth = 0;

function base (str, index, state) {
  let i = commentWhitespace(str, index, state);
  switch (str.charCodeAt(i)) {
    case 123/*{*/:
      state.bD++;
    // fallthrough
    case 40/*(*/:
      depth++;
      state.tS = { i: state.tI, n: state.tS };
    break;
    
    case 125/*}*/:
      if (state.bD === 0)
        throw new Error('Brace mismatch');
      if (state.bD-- === state.TS.i) {
        state.TS = state.TS.n;
        state.iT = true;
        break;
      }
      else if (state.bD < state.TS.i) {
        throw new Error('Brace mismatch');
      }
    // fallthrough
    case 41/*)*/:
      depth--;
      if (!state.tS)
        throw new Error('Brace mismatch');
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
      const lastTokenCode = str.charCodeAt(lastTokenIndex);
      if (!lastTokenCode ||
          isExpressionKeyword(str, lastTokenIndex) ||
          isExpressionPunctuator(lastTokenCode) ||
          lastTokenCode === 41/*)*/ && isParenKeyword(str, state.otI) ||
          lastTokenCode === 125/*}*/ && isExpressionTerminator(str, state.otI))
        i = regularExpression(str, i + 1);
      
    }
    break;

    case 105/*i*/: {
      if (str.substr(i, 6) === 'import' && (readToWsOrPunctuator(str, i) === 'import' || str.charCodeAt(i + 6) === 46/*.*/)) {
        const start = i;
        const index = commentWhitespace(str, i + 6);
        const charCode = str.charCodeAt(index);
        // dynamic import
        if (charCode === 40/*(*/) {
          i = index;
          // dynamic import indicated by positive d
          state.iS.push({ s: start, e: start + 6, d: index + 1 });
          state.tS = { i: state.tI, n: state.tS };
          depth++;
        }
        // import.meta
        else if (charCode === 46/*.*/) {
          i = commentWhitespace(str, index + 1);
          // import.meta indicated by d === -2
          if (readToWsOrPunctuator(str, i) === 'meta')
            state.iS.push({ s: start, e: i + 4, d: -2 });
        }
        // import statement (only permitted at base-level)
        else if (state.tS === null) {
          i = readSourceString(str, i, state);
        }
        // important that we don't bump i for non-match
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
              // ,
              if (charCode === 44) {
                i = commentWhitespace(str, i + 1)
                charCode = str.charCodeAt(i);
              }
              state.eN.push(name);
            } while (charCode && charCode !== 125/*}*/);
            if (!charCode)
              throw new Error('Brace mismatch');
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

function parse (str, state) {
  const len = str.length;
  let index = 0;
  while (index < len)
    // NB: see if it is an optimization to pass str.charCodeAt(index) as an arg
    // TODO: regex optimization where possible
    if (state.iT)
      index = templateString(str, index, state);
    else
      index = base(str, index, state);
  if (state.bD > 0 || state.TS.i !== -1 || state.iT || state.tS)
    throw new Error('Brace mismatch');
}

export function analyzeModuleSyntax (str) {
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
  
  let err = null;
  try {
    parse(str, state);
  }
  catch (e) {
    err = e;
  }
  
  return [state.iS, state.eN, err];
}