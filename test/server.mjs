import http from "http";
import fs from "fs";
import {once} from "events";
import path from "path";
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
  '.wasm': 'application/wasm',
  '.ts': 'application/typescript'
};

const shouldExit = process.env.WATCH_MODE !== 'true';
const testName = process.argv[2] ?? 'test-shim';

let retry = 0;

// Dont run Chrome tests on Firefox
if (testName.startsWith('test-chrome') && process.env.CI_BROWSER && !process.env.CI_BROWSER.includes('chrome'))
  process.exit(0);

let failTimeout, browserTimeout;

function setBrowserTimeout () {
  if (!shouldExit)
    return;
  if (browserTimeout)
    clearTimeout(browserTimeout);
  browserTimeout = setTimeout(() => {
    retry += 1;
    if (retry > 1) {
      console.log('No browser requests made to server for 10s, closing.');
      process.exit(failTimeout || process.env.CI_BROWSER ? 1 : 0);
    }
    else {
      console.log('Retrying...');
      setBrowserTimeout();
      start();
    }
  }, 60_000);
}

setBrowserTimeout();

let latestStartTitle;
const server = http.createServer(async function (req, res) {
  // Helps CI debugging:
  if (process.env.CI_BROWSER)
    console.log("REQ: " + req.url);
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
    if (shouldExit) {
      if (spawnPs)
        spawnPs.kill('SIGKILL');
      setTimeout(() => process.exit(), 500);
    }
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
    if (shouldExit) {
      failTimeout = setTimeout(() => process.exit(1), 30000);
    }
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
  else if (failTimeout) {
    clearTimeout(failTimeout);
    failTimeout = null;
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
  if (process.env.CI_BROWSER) {
    const args = process.env.CI_BROWSER_FLAGS ? process.env.CI_BROWSER_FLAGS.split(' ') : [];
    if (process.env.CI_BROWSER_FLUSH) {
      console.log('Flushing browser: ' + process.env.CI_BROWSER_FLUSH);
      try { execSync(process.env.CI_BROWSER_FLUSH) } catch (e) {
        console.log(e);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.log('Spawning browser: ' + process.env.CI_BROWSER + ' ' + args.join(' '));
    spawnPs = spawn(process.env.CI_BROWSER, [...args, `${baseURL}/test/${testName}.html`]);
  }
  else {
    open(`${baseURL}/test/${testName}.html`, { app: { name: open.apps[process.env.BROWSER || 'chrome'] } });
  }
}

server.listen(port, 'localhost', function() {
  baseURL = `http://localhost:${server.address().port}`;
  start();
});
