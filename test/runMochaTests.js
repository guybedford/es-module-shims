export function runMochaTests(suite) {
  mocha.setup({
    timeout: 20000,
    ui: 'tdd',
    reporter: multiReporter([Mocha.reporters.HTML, ServerReporter]),
  });
  // mocha.allowUncaught();
  self.assert = function (val) {
    equal(!!val, true);
  };
  assert.equal = equal;
  assert.ok = assert;
  function equal (a, b) {
    if (a !== b)
      throw new Error('Expected "' + a + '" to be "' + b + '"');
  }
  self.fail = function (msg) {
    throw new Error(msg);
  };

  importShim('./' + suite + '.js')
  .then(() => mocha.run());
}

function multiReporter(reporters) {
  return function(runner) {
    for (const reporter of reporters) {
      new reporter(runner);
    }
  }
}

function ServerReporter(runner) {
  Mocha.reporters.Base.call(this, runner);

  runner.on('test', test => {
    return fetch('/mocha/start?t=' + encodeURIComponent(test.fullTitle()), { method: 'POST' });
  });

  runner.on('pass', test => {
    return fetch('/mocha/pass?t=' + encodeURIComponent(test.fullTitle()), { method: 'POST' });
  });

  runner.on('fail', (test, err) => {
    return fetch(`/mocha/fail?t=${encodeURIComponent(test.fullTitle())}&e=${encodeURIComponent(err.message)}`, { method: 'POST' });
  });

  runner.on('end', () => {
    return fetch(this.stats.failures ? `/error?${this.stats.failures}` : `/done?${this.stats.passes}/${this.stats.passes + this.stats.failures}`, { method: 'POST' });
  });
}
Mocha.utils.inherits(ServerReporter, Mocha.reporters.Base);
