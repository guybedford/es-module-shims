suite('Get import map API tests', () => {
  test("should compute initial import map state correctly", async () => {
    const importMap = await self.getCurrentImportMap();

    assert.equal(
      JSON.stringify(importMap),
      JSON.stringify({
        imports: {
          test: "http://localhost:8080/test/fixtures/es-modules/es6-file.js",
          "test/": "http://localhost:8080/test/fixtures/",
          global1: "http://localhost:8080/test/fixtures/es-modules/global1.js",
          "bare-dynamic-import":
            "http://localhost:8080/test/fixtures/es-modules/bare-dynamic-import.js",
          react: "https://ga.jspm.io/npm:react@17.0.2/dev.index.js",
          "react-dom": "https://ga.jspm.io/npm:react-dom@17.0.2/dev.index.js",
        },
        scopes: {
          "http://localhost:8080/": {
            "test-dep": "http://localhost:8080/test/fixtures/test-dep.js",
          },
          "http://localhost:8080/test/fixtures/es-modules/import-relative-path.js":
            {
              "http://localhost:8080/test/fixtures/es-modules/relative-path":
                "http://localhost:8080/test/fixtures/es-modules/es6-dep.js",
            },
          "https://ga.jspm.io/": {
            "object-assign":
              "https://ga.jspm.io/npm:object-assign@4.1.1/index.js",
            scheduler: "https://ga.jspm.io/npm:scheduler@0.20.2/dev.index.js",
            "scheduler/tracing":
              "https://ga.jspm.io/npm:scheduler@0.20.2/dev.tracing.js",
          },
        },
      })
    );
  });

  test("should compute next import map state correctly", async () => {
    const importMap = {
      imports: {
        test: "http://localhost:8080/test/fixtures/es-modules/es6-file.js",
        "test/": "http://localhost:8080/test/fixtures/",
        global1: "http://localhost:8080/test/fixtures/es-modules/global1.js",
        "bare-dynamic-import":
          "http://localhost:8080/test/fixtures/es-modules/bare-dynamic-import.js",
        react: "https://ga.jspm.io/npm:react@17.0.2/dev.index.js",
        "react-dom": "https://ga.jspm.io/npm:react-dom@17.0.2/dev.index.js",
      },
      scopes: {
        "http://localhost:8080/": {
          "test-dep": "http://localhost:8080/test/fixtures/test-dep.js",
        },
        "http://localhost:8080/test/fixtures/es-modules/import-relative-path.js":
          {
            "http://localhost:8080/test/fixtures/es-modules/relative-path":
              "http://localhost:8080/test/fixtures/es-modules/es6-dep.js",
          },
        "https://ga.jspm.io/": {
          "object-assign":
            "https://ga.jspm.io/npm:object-assign@4.1.1/index.js",
          scheduler: "https://ga.jspm.io/npm:scheduler@0.20.2/dev.index.js",
          "scheduler/tracing":
            "https://ga.jspm.io/npm:scheduler@0.20.2/dev.tracing.js",
        },
      },
    }

    const script = Object.assign(document.createElement("script"), {
      type: "importmap-shim",
      innerHTML: JSON.stringify({
        imports: {
          lodash: "https://ga.jspm.io/npm:lodash-es@4.17.21/lodash.js",
        },
      }),
    });

    assert.equal(
      JSON.stringify(await self.getNextImportMap(script, importMap)),
      JSON.stringify({
        imports: {
          test: "http://localhost:8080/test/fixtures/es-modules/es6-file.js",
          "test/": "http://localhost:8080/test/fixtures/",
          global1: "http://localhost:8080/test/fixtures/es-modules/global1.js",
          "bare-dynamic-import":
            "http://localhost:8080/test/fixtures/es-modules/bare-dynamic-import.js",
          react: "https://ga.jspm.io/npm:react@17.0.2/dev.index.js",
          "react-dom": "https://ga.jspm.io/npm:react-dom@17.0.2/dev.index.js",
          lodash: "https://ga.jspm.io/npm:lodash-es@4.17.21/lodash.js",
        },
        scopes: {
          "http://localhost:8080/": {
            "test-dep": "http://localhost:8080/test/fixtures/test-dep.js",
          },
          "http://localhost:8080/test/fixtures/es-modules/import-relative-path.js":
            {
              "http://localhost:8080/test/fixtures/es-modules/relative-path":
                "http://localhost:8080/test/fixtures/es-modules/es6-dep.js",
            },
          "https://ga.jspm.io/": {
            "object-assign":
              "https://ga.jspm.io/npm:object-assign@4.1.1/index.js",
            scheduler: "https://ga.jspm.io/npm:scheduler@0.20.2/dev.index.js",
            "scheduler/tracing":
              "https://ga.jspm.io/npm:scheduler@0.20.2/dev.tracing.js",
          },
        },
      })
    );
  })
});