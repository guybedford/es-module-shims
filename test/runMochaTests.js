export function runMochaTests(suites) {
    mocha.setup('tdd');
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
            import('./' + suite + '.js')
                .then(function () {
                    mocha.run(runNextSuite);
                });
        } else {
            fetch(failures ? '/error' : '/done');
        }
    }

    runNextSuite();
}