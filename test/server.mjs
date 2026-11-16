import http from "http";
import fs from "fs";
import {once} from "events";
import path from "path";
import os from "os";
import {fileURLToPath} from "url";
import open from "open";
import kleur from 'kleur';
import { spawn, execSync } from 'child_process';

const port = parseInt(process.env.CI_PORT || '8080');

const rootURL = new URL("..", import.meta.url);

const mimes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.jsonld': 'application/ld+json',
  '.wasm': 'application/wasm',
  '.ts': 'application/typescript'
};

const shouldExit = process.env.WATCH_MODE !== 'true';
const testName = process.argv[2] ?? 'test-shim';

let retry = 0;

// Dont run Chrome tests on Firefox
if (testName.startsWith('test-chrome') && process.env.CI_BROWSER && !process.env.CI_BROWSER.includes('chrome'))
  process.exit(0);

const LAUNCH_TIMEOUT = 20_000;
// must exceed the mocha test timeout, since a running test makes no requests
const IDLE_TIMEOUT = 25_000;
const PAGE_TIMEOUT = 90_000;

let browserTimeout, connected = false;

// the browser must be killed as a process tree before exiting, as otherwise
// its children outlive this process and keep the parent task open
function killBrowser () {
  if (!spawnPs) return;
  if (process.platform !== 'win32') return spawnPs.kill('SIGKILL');
  // by image name as well, since a browser relaunched by its own launcher process is not in the tree
  for (const target of [`/PID ${spawnPs.pid}`, `/IM ${path.basename(process.env.CI_BROWSER)}`]) {
    try {
      execSync(`taskkill /F /T ${target}`, { stdio: 'ignore' });
    } catch {}
  }
}

function exit (code) {
  killBrowser();
  process.exit(code);
}

function setBrowserTimeout () {
  if (!shouldExit)
    return;
  if (browserTimeout)
    clearTimeout(browserTimeout);
  browserTimeout = setTimeout(() => {
    if (!connected && retry++ === 0) {
      console.log(`No browser connection after ${LAUNCH_TIMEOUT / 1000}s, relaunching...`);
      setBrowserTimeout();
      start();
      return;
    }
    console.log(`No browser requests made to server for ${(connected ? IDLE_TIMEOUT : LAUNCH_TIMEOUT) / 1000}s, closing.`);
    exit(1);
  }, connected ? IDLE_TIMEOUT : LAUNCH_TIMEOUT);
}

setBrowserTimeout();

if (shouldExit)
  setTimeout(() => {
    console.log(`Test page did not complete within ${PAGE_TIMEOUT / 1000}s, closing.`);
    exit(1);
  }, PAGE_TIMEOUT);

let latestStartTitle;
const server = http.createServer(async function (req, res) {
  // Helps CI debugging:
  if (process.env.CI_BROWSER)
    console.log("REQ: " + req.url);
  connected = true;
  setBrowserTimeout();
  if (req.url.startsWith('/done')) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('');
    if (latestStartTitle) {
      console.log(kleur.yellow('Starting ') + latestStartTitle);
    }
    console.log(kleur.green('Tests completed successfully.'));
    if (browserTimeout)
      clearTimeout(browserTimeout);
    const message = new URL(req.url, rootURL).searchParams.get('message');
    if (message) console.log(message);
    if (shouldExit) setTimeout(() => exit(0), 500);
    return;
  }
  else if (req.url.startsWith('/error?')) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('');
    if (latestStartTitle) {
      console.log(kleur.yellow('Starting ') + latestStartTitle);
    }
    const msg = decodeURIComponent(req.url.slice(7));
    console.log(kleur.red('Test failures: ') + msg);
    if (shouldExit) setTimeout(() => exit(1), 500);
    return;
  }
  else if (req.url.startsWith('/mocha/start?')) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('');
    latestStartTitle = decodeURIComponent(req.url.slice(15));
    return;
  }
  else if (req.url.startsWith('/mocha/pass?')) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('');
    const fullTitle = decodeURIComponent(req.url.slice(14));
    console.log(kleur.green('Pass ') + fullTitle);
    latestStartTitle = undefined;
    return;
  }
  else if (req.url.startsWith('/mocha/fail?')) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('');
    const u = new URL(req.url, `http://${req.headers.host}`);
    const fullTitle = u.searchParams.get('t');
    const msg = u.searchParams.get('e');
    console.log(kleur.red('Fail ') + fullTitle + ': ' + msg);
    latestStartTitle = undefined;
    return;
  }

  const url = new URL(req.url[0] === '/' ? req.url.slice(1) : req.url, rootURL);
  const filePath = fileURLToPath(url);

  // redirect to test/test.html file by default
  if (url.href === rootURL.href) {
    res.writeHead(301, {
      'location': '/test/test.html'
    });
    res.end();
    return;
  }

  const fileStream = fs.createReadStream(filePath);
  try {
    await once(fileStream, 'readable');
  }
  catch (e) {
    if (e.code === 'EISDIR' || e.code === 'ENOENT') {
      res.writeHead(404, {
        'content-type': 'text/html'
      });
      res.end(`File not found.`);
    }
    return;
  }

  let mime;
  if (filePath.endsWith('javascript.css'))
    mime = 'application/javascript';
  else if (filePath.endsWith('content-type-xml.json'))
    mime = 'application/xml';
  else
    mime = mimes[path.extname(filePath)] || 'text/plain';

  const headers = filePath.endsWith('content-type-none.json') ?
    {} : { 'Access-Control-Allow-Origin': '*', 'Content-Type': mime, 'Cache-Control': 'no-cache' }

  res.writeHead(200, headers);
  fileStream.pipe(res);
  await once(fileStream, 'end');
  res.end();
});

let spawnPs;
let baseURL;
async function start () {
  killBrowser();
  if (process.env.CI_BROWSER) {
    const args = process.env.CI_BROWSER_FLAGS ? process.env.CI_BROWSER_FLAGS.split(' ') : [];
    if (process.env.CI_BROWSER_FLUSH) {
      console.log('Flushing browser: ' + process.env.CI_BROWSER_FLUSH);
      try { execSync(process.env.CI_BROWSER_FLUSH) } catch (e) {
        console.log(e);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    // a fresh profile per launch avoids state from the runner's own browser installs
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'esms-profile-'));
    if (/firefox/i.test(process.env.CI_BROWSER)) args.push('-profile', profile);
    else
      args.push(`--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--no-sandbox', '--disable-gpu');
    console.log('Spawning browser: ' + process.env.CI_BROWSER + ' ' + args.join(' '));
    spawnPs = spawn(process.env.CI_BROWSER, [...args, `${baseURL}/test/${testName}.html`], {
      env: {
        ...process.env,
        MOZ_DISABLE_CONTENT_SANDBOX: '1',
        MOZ_DISABLE_GPU_SANDBOX: '1',
        MOZ_DISABLE_RDD_SANDBOX: '1',
        MOZ_DISABLE_SOCKET_PROCESS_SANDBOX: '1',
        MOZ_DISABLE_UTILITY_SANDBOX: '1'
      }
    });
    const ps = spawnPs;
    ps.on('error', err => console.log('Browser spawn error: ' + err));
    ps.on('exit', (code, signal) => console.log(`Browser exited: code ${code}, signal ${signal}`));
    ps.stdout.on('data', data => console.log('Browser stdout: ' + data));
    ps.stderr.on('data', data => console.log('Browser stderr: ' + data));
  }
  else {
    open(`${baseURL}/test/${testName}.html`, { app: { name: open.apps[process.env.BROWSER || 'chrome'] } });
  }
}

// CI listens on both IPv4 and IPv6 since older browsers may only try one for localhost
server.listen(port, process.env.CI_BROWSER ? undefined : 'localhost', function() {
  baseURL = `http://localhost:${server.address().port}`;
  if (process.env.CI_BROWSER) console.log('Listening on ' + JSON.stringify(server.address()));
  start();
});
