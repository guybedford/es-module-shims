import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { join, sep } from 'path';
import rimraf from 'rimraf';

// GENERATE CASES
{
  const preact = await readFile(new URL('../node_modules/preact/dist/preact.module.js', import.meta.url));

  try {
    rimraf.sync(new URL('./generated', import.meta.url));
  }
  catch {}

  try {
    await mkdir(new URL('./generated', import.meta.url));
  }
  catch {}

  await writeFile(new URL('./generated/preact.js', import.meta.url), preact);

  for (let i = 1; i <= 10000; i++) {
    await writeFile(new URL(`./generated/app${i}.js`, import.meta.url), `\
  import { h, Component, render } from './preact.js?n=${i}';

  export class App extends Component {
    render() {
      return h('h1', null, 'Hello, world ${i}!');
    }
  }

  const el = document.createElement('div');
  render(h(App), el);
  `);
  }

  for (let i = 1; i <= 10000; i++) {
    await writeFile(new URL(`./generated/app.mapped${i}.js`, import.meta.url), `\
  import { h, Component, render } from 'lib/preact.js?n=${i}';

  export class App extends Component {
    render() {
      return h('h1', null, 'Hello, world ${i}!');
    }
  }

  const el = document.createElement('div');
  render(h(App), el);
  `);
  }

  // GENERATE ALLMAPPED TESTS
  for (const n of [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 1000]) {
    const imports = {};
    for (let i = 1; i <= n; i++) {
      imports[`lib/app.mapped${i}.js`] = `/bench/generated/app.mapped${i}.js`;
      imports[`lib/preact.js?n=${i}`] = `/bench/generated/preact.js?n=${i}`;
    }

    await writeFile(new URL(`./generated/parallel-allmapped-${n}.html`, import.meta.url), `\
<script type="importmap">
{
  "imports": ${JSON.stringify(imports)}
}
</script>
<script type="module">
  let promises = Array(${n});
  for (let i = 1; i <= ${n}; i++)
    promises.push(import(\`lib/app.mapped\${i}.js\`));
  Promise.all(promises).then(() => parent.postMessage('done', '*'));
</script>
`);

    await writeFile(new URL(`./generated/parallel-allmapped-esms-${n}.html`, import.meta.url), `\
<script type="importmap">
{
  "imports": ${JSON.stringify(imports)}
}
</script>
<script async src="/dist/es-module-shims.js"></script>
<script type="module">
  import 'lib/app.mapped1.js';
  let promises = Array(${n});
  for (let i = 1; i <= ${n}; i++)
    promises.push(import(\`lib/app.mapped\${i}.js\`));
  Promise.all(promises).then(() => parent.postMessage('done', '*'));
</script>
`);
  }
}

// GENERATE BENCHMARKS

{
  try { await mkdir(new URL('./results', import.meta.url)) }
  catch {}

  try { rimraf.sync(new URL('./benchmarks', import.meta.url)) }
  catch {}

  try { await mkdir(new URL('./benchmarks', import.meta.url)) }
  catch {}

  const ports = {
    'fastest': 8000,
    'fastest-cached': 8001,
    'slow': 8002,
    // 'slow-uncompressed': 8003
  };

  for (const browser of ['safari', 'firefox', 'chrome']) {
    let firefoxProfilePath;
    if (browser === 'firefox' && process.env.APPDATA) {
      // TODO: Firefox profile path for other platforms
      const profileDir = join(process.env.APPDATA, 'Mozilla', 'Firefox', 'Profiles');
      const profiles = await readdir(profileDir);
      firefoxProfilePath = profileDir + sep + profiles.sort()[0];
    }
    for (const type of Object.keys(ports)) {
      for (const name of [
        'parallel',
        'parallel-mapped-esms',
        'parallel-allmapped-esms',
        ...browser === 'chrome' ? ['parallel-mapped', 'parallel-allmapped'] : [],
      ]) {
        const fullName = `${browser}.${type}.${name}`;
        const port = ports[type];
        await writeFile(new URL(`./benchmarks/${fullName}.bench.json`, import.meta.url), `\
        {
          "$schema": "https://raw.githubusercontent.com/Polymer/tachometer/master/config.schema.json",
          "sampleSize": 20,
          "timeout": 0,
          "autoSampleConditions": ["0%"],
          "benchmarks": [
            {
              "name": "${fullName}-10",
              "url": "runner.html?type=${name}&n=10&port=${port}",
              "browser": {
                "name": "${browser}"${browser === 'firefox' ? `,
                "profile": ${JSON.stringify(firefoxProfilePath)}` : ''}
              }
            },
            {
              "name": "${fullName}-20",
              "url": "runner.html?type=${name}&n=20&port=${port}",
              "browser": {
                "name": "${browser}"${browser === 'firefox' ? `,
                "profile": ${JSON.stringify(firefoxProfilePath)}` : ''}
              }
            },
            {
              "name": "${fullName}-30",
              "url": "runner.html?type=${name}&n=30&port=${port}",
              "browser": {
                "name": "${browser}"${browser === 'firefox' ? `,
                "profile": ${JSON.stringify(firefoxProfilePath)}` : ''}
              }
            },
            {
              "name": "${fullName}-40",
              "url": "runner.html?type=${name}&n=40&port=${port}",
              "browser": {
                "name": "${browser}"${browser === 'firefox' ? `,
                "profile": ${JSON.stringify(firefoxProfilePath)}` : ''}
              }
            },
            {
              "name": "${fullName}-50",
              "url": "runner.html?type=${name}&n=50&port=${port}",
              "browser": {
                "name": "${browser}"${browser === 'firefox' ? `,
                "profile": ${JSON.stringify(firefoxProfilePath)}` : ''}
              }
            },
            {
              "name": "${fullName}-60",
              "url": "runner.html?type=${name}&n=60&port=${port}",
              "browser": {
                "name": "${browser}"${browser === 'firefox' ? `,
                "profile": ${JSON.stringify(firefoxProfilePath)}` : ''}
              }
            },
            {
              "name": "${fullName}-70",
              "url": "runner.html?type=${name}&n=70&port=${port}",
              "browser": {
                "name": "${browser}"${browser === 'firefox' ? `,
                "profile": ${JSON.stringify(firefoxProfilePath)}` : ''}
              }
            },
            {
              "name": "${fullName}-80",
              "url": "runner.html?type=${name}&n=80&port=${port}",
              "browser": {
                "name": "${browser}"${browser === 'firefox' ? `,
                "profile": ${JSON.stringify(firefoxProfilePath)}` : ''}
              }
            },
            {
              "name": "${fullName}-90",
              "url": "runner.html?type=${name}&n=90&port=${port}",
              "browser": {
                "name": "${browser}"${browser === 'firefox' ? `,
                "profile": ${JSON.stringify(firefoxProfilePath)}` : ''}
              }
            },
            {
              "name": "${fullName}-100",
              "url": "runner.html?type=${name}&n=100&port=${port}",
              "browser": {
                "name": "${browser}"${browser === 'firefox' ? `,
                "profile": ${JSON.stringify(firefoxProfilePath)}` : ''}
              }
            }${type.startsWith('slow') ? '' : `,
            {
              "name": "${fullName}-1000",
              "url": "runner.html?type=${name}&n=1000&port=${port}",
              "browser": {
                "name": "${browser}"${browser === 'firefox' ? `,
                "profile": ${JSON.stringify(firefoxProfilePath)}` : ''}
              }
            }`}
          ]
        }
        `);
      }
    }
  }
}
