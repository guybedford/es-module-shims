import fs from 'fs';
import replace from '@rollup/plugin-replace';
import path from 'path';

const version = JSON.parse(fs.readFileSync('package.json')).version;

export default [
  config(true, true),
  config(true, false),
  config(false, true),
  config(false, false),
];

function config (isWasm, isShim) {
  const name = 'es-module-shims'

  return {
    input: `src/${name}.js`,
    output: {
      file: `dist/${name}${isWasm ? '.wasm' : ''}${isShim ? '.shim' : '.polyfill'}.js`,
      format: 'iife',
      strict: false,
      sourcemap: false,
      banner: `/* ES Module Shims ${isWasm ? 'Wasm ' : ''}${isShim ? 'Shim ' : 'Polyfill'}${version} */`
    },
    plugins: [
      {
        resolveId (id) {
          if (isWasm && id === '../node_modules/es-module-lexer/dist/lexer.asm.js')
            return path.resolve('node_modules/es-module-lexer/dist/lexer.js');
          if (isWasm && id === './dynamic-import-csp.js')
            return path.resolve('src/dynamic-import.js');
        }
      },
      replace({
        'self.ESMS_DEBUG': 'false',
        'self.SHIM_MODE': isShim,
        preventAssignment: true
      }),
    ]
  };
}
