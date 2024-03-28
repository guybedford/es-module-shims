const adder = await import.source('./test.wasm?unique');
const { exports: { addTwo } } = await WebAssembly.instantiate(adder, {});
export { addTwo as add }
