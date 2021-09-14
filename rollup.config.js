import fs from 'fs';
import replace from '@rollup/plugin-replace';
import path from 'path';

const version = JSON.parse(fs.readFileSync('package.json')).version;

export default [
    config(true),
    config(false),
].filter(Boolean);

function config (isWasm) {
    const name = 'es-module-shims'

    return {
        input: `src/${name}.js`,
        output: {
            file: `dist/${name}${isWasm ? '' : '.csp'}.js`,
            format: 'iife',
            strict: false,
            sourcemap: false,
            banner: `/* ES Module Shims ${isWasm ? '' : 'CSP '}${version} */`
        },
        plugins: [
            {
                resolveId (id) {
                    if (!isWasm && id === '../node_modules/es-module-lexer/dist/lexer.js')
                        return path.resolve('node_modules/es-module-lexer/lexer.js');
                    if (!isWasm && id === './dynamic-import.js')
                        return path.resolve('src/dynamic-import-csp.js');
                }
            },
            replace({
                'self.ESMS_DEBUG': 'false',
                preventAssignment: true
            }),
        ]
    };
}
