import fs from 'fs';
import replace from '@rollup/plugin-replace';
import { terser } from 'rollup-plugin-terser';

const version = JSON.parse(fs.readFileSync('package.json')).version;

const terserOptions = {
    mangle: {
        eval: true,
        module: true,
        safari10: true,
        toplevel: true
    },
    parse: {
    },
    compress: {
        unsafe: true,
        arguments: true,
        hoist_funs: true,
        hoist_props: true,
        keep_fargs: false,
        negate_iife: true,
        module: true,
        pure_getters: true,
        passes: 2,
        sequences: 400,
        toplevel: true,
        unsafe_proto: true,
        unsafe_regexp: true,
        unsafe_math: true,
        unsafe_symbols: true,
        unsafe_comps: true,
        unsafe_Function: true,
        unsafe_undefined: true
    },
    output: {
        comments(node, comment) {
            return /^\* ES Module Shims [0-9]\./.test(comment.value.trim());
        },
        safari10: true
    },
    ecma: 5, // specify one of: 5, 2015, 2016, 2017 or 2018
    keep_classnames: false,
    keep_fnames: false,
    ie8: false,
    module: true,
    nameCache: null, // or specify a name cache object
    safari10: true,
    toplevel: true,
    warnings: false
};

export default [
    config(true),
    config(false),
].filter(Boolean);

function config(isMin) {
    const name = 'es-module-shims'

    return {
        input: `src/${name}.js`,
        output: {
            file: `dist/${name}${isMin ? '.min' : ''}.js`,
            format: 'iife',
            strict: false,
            sourcemap: isMin,
            banner: `/* ES Module Shims ${version} */`
        },
        plugins: [
            replace({
                'globalThis.ES_MODULE_SHIMS_TEST': process.env.test ? 'true' : 'false',
                preventAssignment: true
            }),
            isMin && terser(terserOptions)
        ]
    };
}
