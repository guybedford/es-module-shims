import source adder from './test.wasm';
const { exports: { addTwo } } = await WebAssembly.instantiate(adder, {});
export { addTwo as add }
