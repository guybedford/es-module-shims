export function runMochaTests(suite) {
  mocha.setup({ ui: 'tdd' });
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
  .then(async () => {
    const failures = await new Promise(resolve => mocha.run(resolve));
    fetch(failures ? '/error?' + failures : '/done');
  }, err => {
    console.error('Unable to import test ' + suite);
    console.error(err);
  });
}
