import fs from 'fs';
import replace from '@rollup/plugin-replace';
import path from 'path';

const version = JSON.parse(fs.readFileSync('package.json')).version;

export default [
  config(true, false),
  config(false, false),
  config(false, true),
];

function config (isWasm, isDebug) {
  const name = 'es-module-shims'

  return {
    input: `src/${name}.js`,
    output: {
      file: `dist/${name}${isWasm ? '.wasm' : ''}${isDebug ? '.debug' : ''}.js`,
      format: 'iife',
      strict: false,
      sourcemap: false,
      banner: `/* ES Module Shims ${isWasm ? 'Wasm ' : ''}${isDebug ? 'DEBUG BUILD ' : ''}${version} */`
    },
    plugins: [
      {
        resolveId (id) {
          if (isWasm && id === '../node_modules/es-module-lexer/dist/lexer.asm.js')
            return path.resolve('node_modules/es-module-lexer/dist/lexer.js');
        }
      },
      replace({
        'self.ESMS_DEBUG': isDebug.toString(),
        preventAssignment: true
      }),
    ]
  };
}
