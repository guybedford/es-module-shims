setup({ single_test: true });

import { constant } from "../resources/string-constants-module.wasm";

// the imported string constant global evaluates to its own import name
assert_equals(constant, "hello world");

done();
