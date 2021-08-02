export function runMochaTests(suites) {
  mocha.setup({
    ui: 'tdd',
    cleanReferencesAfterRun: false
  });
  mocha.allowUncaught();
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

  function runNextSuite(failures) {
    mocha.suite.suites = [];
    const suite = suites.shift();
    if (suite) {
      importShim('./' + suite + '.js')
        .then(function () {
          mocha.run(runNextSuite);
        }, function (err) {
          console.error('Unable to import test ' + suite);
          console.error(err);
        });
    } else {
      fetch(failures ? '/error?' + failures : '/done');
    }
  }

  runNextSuite();
}
