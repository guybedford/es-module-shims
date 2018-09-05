import fs from 'fs';
import assert from 'assert';
import { analyzeModuleSyntax } from '../src/lexer.js';

const source = fs.readFileSync('node_modules/rollup/dist/rollup.es.js').toString();

test('Parsing Rollup source', () => {
  const [imports, exports] = analyzeModuleSyntax(source);
  const importNames = imports.map(impt => source.slice(impt.s, impt.e)).sort();
  assert.deepEqual(importNames, [
    'crypto',
    'events',
    'fs',
    'module',
    'path',
    'util'
  ]);
  assert.equal(exports.length, 3);
});