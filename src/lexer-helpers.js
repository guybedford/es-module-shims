// seeks through comments and multiline comments
export function isWs (charCode) {
  // Note there are even more than this - https://en.wikipedia.org/wiki/Whitespace_character#Unicode
  return charCode === 32/* */ || charCode === 9/*\t*/ || charCode === 12/*\f*/ || charCode === 11/*\v*/ || charCode === 160/*\u00A0*/ || charCode === 65279/*\ufeff*/;
}
export function isBr (charCode) {
  // (8232 <LS> and 8233 <PS> omitted for now)
  return charCode === 10/*\n*/ || charCode === 13/*\r*/;
}

export function isBrOrWs (charCode) {
  return charCode > 8 && charCode < 14 || charCode === 32 || charCode === 160 || charCode === 65279;
}

export function blockComment (str, i) {
  let charCode = str.charCodeAt(i++);
  while (charCode) {
    if (charCode === 42/***/) {
      const nextCharCode = str.charCodeAt(i++);
      if (nextCharCode === 47/*/*/)
        return i;
      charCode = nextCharCode;
    }
    else {
      charCode = str.charCodeAt(i++);
    }
  }
  return i;
}

export function lineComment (str, i) {
  let charCode;
  while (charCode = str.charCodeAt(i++)) {
    if (isBr(charCode))
      return i;
  }
  return i;
}

export function singleQuoteString (str, i) {
  let charCode;
  while (charCode = str.charCodeAt(i++)) {
    if (charCode === 39/*'*/)
      return i;
    if (charCode === 92/*\*/)
      i++;
    else if (isBr(charCode))
      syntaxError();
  }
  syntaxError();
}

export function doubleQuoteString (str, i) {
  let charCode;
  while (charCode = str.charCodeAt(i++)) {
    if (charCode === 34/*"*/)
      return i;
    if (charCode === 92/*\*/)
      i++;
    else if (isBr(charCode))
      syntaxError();
  }
  syntaxError();
}

export function regexCharacterClass (str, i) {
  let charCode;
  while (charCode = str.charCodeAt(i++)) {
    if (charCode === 93/*]*/)
      return i;
    if (charCode === 92/*\*/)
      i++;
    else if (isBr(charCode))
      syntaxError();
  }
  syntaxError();
}

export function regularExpression (str, i) {
  let charCode;
  while (charCode = str.charCodeAt(i++)) {
    if (charCode === 47/*/*/)
      return i;
    if (charCode === 91/*[*/)
      i = regexCharacterClass(str, i);
    else if (charCode === 92/*\*/)
      i++;
    else if (isBr(charCode))
      syntaxError();
  }
  syntaxError();
}

export function readPrecedingKeyword (str, endIndex) {
  let startIndex = endIndex;
  let nextChar = str.charCodeAt(startIndex);
  while (nextChar && nextChar > 96/*a*/ && nextChar < 123/*z*/)
    nextChar = str.charCodeAt(--startIndex);
  // must be preceded by punctuator or whitespace
  if (!nextChar || isBrOrWs(nextChar) || isPunctuator(nextChar))
    return str.slice(startIndex + 1, endIndex + 1);
}

export function readToWsOrPunctuator (str, startIndex) {
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
export function isExpressionKeyword (str, lastTokenIndex) {
  const precedingKeyword = readPrecedingKeyword(str, lastTokenIndex);
  return precedingKeyword && expressionKeywords[precedingKeyword];
}
export function isParenKeyword  (str, lastTokenIndex) {
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
    charCode === 91 || charCode === 93 || charCode === 94 ||
    charCode === 123 || charCode === 124 || charCode === 126;
}
export function isExpressionPunctuator (charCode) {
  return charCode !== 93/*]*/ && charCode !== 41/*)*/ && isPunctuator(charCode);
}
export function isExpressionTerminator (str, lastTokenIndex) {
  // detects:
  // ; ) -1 finally while
  // as all of these followed by a { will indicate a statement brace
  // in future we will need: "catch" (optional catch parameters)
  //                         "do" (do expressions)
  switch (str.charCodeAt(lastTokenIndex)) {
    case 59/*;*/:
    case 41/*)*/:
    case NaN:
      return true;
    case 121/*y*/:
      return str.slice(lastTokenIndex - 6, lastTokenIndex) === 'finall';
    case 101/*e*/:
      return str.slice(lastTokenIndex - 4, lastTokenIndex) === 'whil';
  }
  return false;
}

export function syntaxError () {
  // we just need the stack
  // this isn't shown to users, only for diagnostics
  throw new Error();
}