main();
async function main() {
    // Append a dynamic import map containing resolution for "react-dom".
    document.body.appendChild(Object.assign(document.createElement('script'), {
        type: 'importmap-shim',
        innerHTML: JSON.stringify({
            "imports": {
                "react-dom": "https://ga.jspm.io/npm:react-dom@17.0.2/dev.index.js"
            },
            "scopes": {
                "https://ga.jspm.io/": {
                    "scheduler": "https://ga.jspm.io/npm:scheduler@0.20.2/dev.index.js",
                    "scheduler/tracing": "https://ga.jspm.io/npm:scheduler@0.20.2/dev.tracing.js"
                }
            }
        })
    }));

    const reactStart = performance.now();
    const [React, ReactDOM] = await Promise.all([
        importShim('react'),
        importShim('react-dom'),
    ]);
    const reactEnd = performance.now();

    console.log(`React and ReactDOM loaded in ${(reactEnd - reactStart).toFixed(2)}ms`);
    console.log({ React, ReactDOM });
}
