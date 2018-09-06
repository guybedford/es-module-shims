import { commentWhitespace, isParenKeyword, isExpressionKeyword, isExpressionPunctuator, isExpressionTerminator, readToWsOrPunctuator, singleQuoteString, doubleQuoteString, regularExpression, syntaxError } from './lexer-helpers.js';

function templateString (str, i, state) {
  let charCode;
  let nextCharCode = str.charCodeAt(i++);
  while (charCode = nextCharCode) {
    if (charCode === 92/*\*/) {
      nextCharCode = str.charCodeAt(i += 1);
      continue;
    }
    else if (charCode === 36/*$*/) {
      nextCharCode = str.charCodeAt(i++);
      if (nextCharCode === 123/*{*/) {
        state.t = { i: ++state.b, n: state.t };
        return i;
      }
    }
    else if (charCode === 96/*`*/) {
      return i;
    }
    nextCharCode = str.charCodeAt(i++);
  }
  syntaxError();
}

function parseNext (str, i, state) {
  switch (str.charCodeAt(i++)) {
    case 123/*{*/:
      state.b++;
    // fallthrough
    case 40/*(*/:
      state.s = { i: state.l, n: state.s };
      return i;
    
    case 125/*}*/:
      if (state.b-- === state.t.i) {
        state.t = state.t.n;
        return templateString(str, i, state);
      }
      if (state.b < state.t.i)
        syntaxError();
    // fallthrough
    case 41/*)*/:
      if (!state.s)
        syntaxError();
      state.o = state.s.i;
      state.s = state.s.n;
      return i;

    case 39/*'*/:
      return singleQuoteString(str, i);
    case 34/*"*/:
      return doubleQuoteString(str, i);

    case 96/*`*/:
      return templateString(str, i, state);

    case 47/*/*/: {
      /*
       * Division / regex ambiguity handling
       * based on checking backtrack analysis of:
       * - what token came previously (state.l)
       * - what token came before the opening paren or brace (state.o)
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
      const lastTokenCode = str.charCodeAt(state.l);
      if (!lastTokenCode || isExpressionKeyword(str, state.l) ||
          isExpressionPunctuator(lastTokenCode) ||
          lastTokenCode === 41/*)*/ && isParenKeyword(str, state.o) ||
          lastTokenCode === 125/*}*/ && isExpressionTerminator(str, state.o))
        return regularExpression(str, i);
      
      return i;
    }

    case 105/*i*/: {
      if (str.slice(i, i + 5) !== 'mport' || readToWsOrPunctuator(str, i) !== 'mport' && str.charCodeAt(i + 5) !== 46/*.*/)
        return i;
      
      const start = i - 1;
      const index = commentWhitespace(str, i + 5);
      switch (str.charCodeAt(index)) {
        // dynamic import
        case 40/*(*/:
          // dynamic import indicated by positive d
          state.i.push({ s: start, e: start + 6, d: index + 1 });
          return index;
        // import.meta
        case 46/*.*/:
          i = commentWhitespace(str, index + 1);
          // import.meta indicated by d === -2
          if (readToWsOrPunctuator(str, i) === 'meta')
            state.i.push({ s: start, e: i + 4, d: -2 });
          return i + 1;
      }
      // import statement (only permitted at base-level)
      if (state.s === null)
        return readSourceString(str, i, state);
      return i;
    }
    
    case 101/*e*/: {
      if (state.s !== null || readToWsOrPunctuator(str, i) !== 'xport')
        return i;
      
      let name, charCode;
      switch (str.charCodeAt(i = commentWhitespace(str, i + 5))) {
        // export default ...
        case 100/*d*/:
          state.e.push('default');
          return i + 1;

        // export async? function*? name () {
        case 97/*a*/:
          i = commentWhitespace(str, i + 5);
        // fallthrough
        case 102/*f*/:
          i = commentWhitespace(str, i + 8);
          if (str.charCodeAt(i) === 42/***/)
            i = commentWhitespace(str, i + 1);
          state.e.push(readToWsOrPunctuator(str, i));
          return i + 1;

        case 99/*c*/:
          if (readToWsOrPunctuator(str, i) === 'class') {
            state.e.push(readToWsOrPunctuator(str, i = commentWhitespace(str, i + 5)));
            return i + 1;
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
            name = readToWsOrPunctuator(str, i = commentWhitespace(str, i + 3));
            // stops on [ { destructurings
            if (!name.length)
              return i + 1;
            state.e.push(name);
            i = commentWhitespace(str, i + name.length);
          } while (str.charCodeAt(i) === 44/*,*/);
          return i + 1;

        // export {...}
        case 123/*{*/:
          i = commentWhitespace(str, i + 1);
          do {
            name = readToWsOrPunctuator(str, i);
            charCode = str.charCodeAt(i = commentWhitespace(str, i + name.length));
            // as
            if (charCode === 97/*a*/) {;
              name = readToWsOrPunctuator(str, i = commentWhitespace(str, i + 2));
              charCode = str.charCodeAt(i = commentWhitespace(str, i + name.length));
            }
            // ,
            if (charCode === 44)
              charCode = str.charCodeAt(i = commentWhitespace(str, i + 1));
            state.e.push(name);
            if (!charCode)
              syntaxError();
          } while (charCode !== 125/*}*/);
        // fallthrough

        // export *
        case 42/***/:
          i = commentWhitespace(str, i + 1);
          if (str.slice(i, i += 4) === 'from')
            i = readSourceString(str, i, state);
          return i + 1;

        // default: return i fallthrough
      }
    }
    // default: return i fallthrough
  }
  return i;
}

function readSourceString (str, i, state) {
  let charCode, start;
  while (charCode = str.charCodeAt(i++)) {
    if (charCode === 39/*'*/) {
      i = singleQuoteString(str, start = i);
      state.i.push({ s: start, e: i - 1, d: -1 });
      return i;
    }
    if (charCode === 34/*"*/) {
      i = doubleQuoteString(str, start = i);
      state.i.push({ s: start, e: i - 1, d: -1 });
      return i;
    }
  }
  syntaxError();
}

function baseParse (str, index, state) {
  const len = str.length;
  let i = index;
  while (i < len) {
    i = parseNext(str, commentWhitespace(str, i, state), state);
    state.l = i - 1;
  }
  if (state.b > 0 || state.t.i !== 0 || state.s)
    syntaxError();
}

export function analyzeModuleSyntax (str) {
  const state = {
    // lastTokenIndex
    l: -1,
    // lastOpenTokenIndex
    o: -1,
    // lastTokenIndexStack
    // linked list of the form { i (item): index, n (next): nextInList }
    s: null,
    // braceDepth
    b: 0,
    // templateStack
    t: { i: 0, n: null },
    // imports
    i: [],
    // exports
    e: []
  };

  let err = null;
  try {
    baseParse(str, 0, state);
  }
  catch (e) {
    err = e;
  }
  return [state.i, state.e, err];
}