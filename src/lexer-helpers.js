// seeks through comments and multiline comments
export function isWs (charCode) {
  // Note there are even more than this - https://en.wikipedia.org/wiki/Whitespace_character#Unicode
  return charCode === 32/* */ || charCode === 9/*\t*/ || charCode === 12/*\f*/ || charCode === 11/*\v*/ || charCode === 160/*\u00A0*/ || charCode === 65279/*\ufeff*/;
}
export function isBr (charCode) {
  // (8232 <LS> and 8233 <PS> omitted for now)
  return charCode === 10/*\n*/ || charCode === 13/*\r*/;
}

// TODO: update to regex approach which should be faster
export function commentWhitespace (str, index) {
  let inBlockComment = false;
  let inLineComment = false;
  let charCode;
  let nextCharCode = str.charCodeAt(index);
  while (charCode = nextCharCode) {
    nextCharCode = str.charCodeAt(index + 1);
    if (inLineComment) {
      if (isBr(charCode))
        inLineComment = false;
    }
    else if (inBlockComment) {
      if (charCode === 42/***/ && nextCharCode === 47/*/*/) {
        nextCharCode = str.charCodeAt(++index + 1);
        inBlockComment = false;
      }
    }
    else {
      if (charCode === 47/*/*/) {
        if (nextCharCode === 47/*/*/) {
          inLineComment = true;
        }
        else if (nextCharCode === 42/***/) {
          inBlockComment = true;
        }
        else return index;
        nextCharCode = str.charCodeAt(++index + 1);
      }
      else if (!isWs(charCode) && !isBr(charCode)) {
        return index;
      }
    }
    index++;
  }
  if (inLineComment)
    throw new Error('Unterminated comment');
  return index;
}

export function singleQuoteString (str, index) {
  let charCode;
  while (charCode = str.charCodeAt(index)) {
    if (charCode === 39/*'*/)
      return index;
    if (charCode === 92/*\*/)
      index++;
    else if (isBr(charCode))
      throw new Error('Unexpected newline');
    index++;
  }
  throw new Error('Unterminated string');
}

export function doubleQuoteString (str, index) {
  let charCode;
  while (charCode = str.charCodeAt(index)) {
    if (charCode === 34/*"*/)
      return index;
    if (charCode === 92/*\*/)
      index++;
    else if (isBr(charCode))
      throw new Error('Unexpected newline');
    index++;
  }
  throw new Error('Unterminated string');
}

export function regexCharacterClass (str, index) {
  let charCode;
  while (charCode = str.charCodeAt(index)) {
    if (charCode === 93/*]*/)
      return index;
    if (charCode === 92/*\*/)
      index++;
    else if (isBr(charCode))
      throw new Error('Unexpected newline');
    index++;
  }
  throw new Error('Unterminated regex');
}

export function regularExpression (str, index) {
  let charCode;
  while (charCode = str.charCodeAt(index)) {
    if (charCode === 47/*/*/)
      return index;
    if (charCode === 91/*[*/)
      index = regexCharacterClass(str, index + 1);
    else if (charCode === 92/*\*/)
      index++;
    else if (isBr(charCode))
      throw new Error('Unexpected newline');
    index++;
  }
  throw new Error('Unterminated regex');
}

export function readPrecedingKeyword (str, endIndex) {
  let startIndex = endIndex;
  let nextChar = str.charCodeAt(startIndex);
  while (nextChar && nextChar >= 97/*a*/ && nextChar <= 122/*z*/)
    nextChar = str.charCodeAt(--startIndex);
  // must be preceded by punctuator or whitespace
  if (!nextChar || isBr(nextChar) || isWs(nextChar) || isPunctuator(nextChar))
    return str.slice(startIndex + 1, endIndex + 1);
}

export function readToWsOrPunctuator (str, startIndex) {
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
  // ; ) -1 finally while do =>
  // as all of these followed by a { will indicate a statement brace
  switch (str.charCodeAt(lastTokenIndex)) {
    case 59/*;*/:
    case 41/*)*/:
    case NaN:
      return true;
    case 62/*>*/:
      return str.charCodeAt(lastTokenIndex - 1) === 61/*=*/;
    case 121/*y*/:
      return str.slice(lastTokenIndex - 6, lastTokenIndex) === 'finall';
    case 101/*e*/:
      return str.slice(lastTokenIndex - 4, lastTokenIndex) === 'whil';
    case 111/*o*/:
      return str.charCodeAt(lastTokenIndex - 1) === 100/*d*/;
  }
  return false;
}