import assert from 'assert';
import { analyzeModuleSyntax } from '../src/lexer.js';

suite('Lexer', () => {
  test('Simple import', () => {
    const source = `
      import test from "test";
      console.log(test);
    `;
    const [imports, exports] = analyzeModuleSyntax(source);
    assert.equal(imports.length, 1);
    const { s, e, d } = imports[0];
    assert.equal(d, -1);
    assert.equal(source.slice(s, e), 'test');

    assert.equal(exports.length, 0);
  });

  test('Simple reexport', () => {
    const source = `
      export { hello as default } from "test-dep";
    `;
    const [imports, exports] = analyzeModuleSyntax(source);
    assert.equal(imports.length, 1);
    const { s, e, d } = imports[0];
    assert.equal(d, -1);
    assert.equal(source.slice(s, e), 'test-dep');

    assert.equal(exports.length, 1); 
    assert.equal(exports[0], 'default');
  });

  test('import.meta', () => {
    const source = `
      export var hello = 'world';
      console.log(import.meta.url);
    `;
    const [imports, exports] = analyzeModuleSyntax(source);
    assert.equal(imports.length, 1);
    const { s, e, d } = imports[0];
    assert.equal(d, -2);
    assert.equal(source.slice(s, e), 'import.meta');
  });

  test('import after code', () => {
    const source = `
      export function f () {
        g();
      }
      
      import { g } from './test-circular2.js';
    `;
    const [imports, exports] = analyzeModuleSyntax(source);
    assert.equal(imports.length, 1);
    const { s, e, d } = imports[0];
    assert.equal(d, -1);
    assert.equal(source.slice(s, e), './test-circular2.js');

    assert.equal(exports.length, 1);
    assert.equal(exports[0], 'f');
  });

  // TODO pad out string, template (variable nesting), comment, etc cases tests
  // including division operator distinguishing of if (x) /as`df/ sort of thing
  /*

  Can also test the bounds of openLastTokenIndex with nested brackets, parsings, inbetween:

    x-/a/g
    finally{}/a/g
    =>{}/a/g
    ){}/a/g
    ;{}/a/g
    {}/a/g
    +{}/a/g
    ('a')/a/g
    if //x
    ('a')/a/g
  */
});