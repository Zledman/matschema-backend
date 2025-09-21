// ESLint Flat Config (CommonJS for Node without setting package type=module)
// If you later add "type": "module" to package.json you can switch back to ESM import/export.
// This configuration enforces consistent style and Node/Jest globals.
const js = require("@eslint/js");

const nodeGlobals = {
  require: "readonly",
  module: "readonly",
  process: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  Buffer: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  console: "readonly"
};

const jestGlobals = {
  describe: "readonly",
  test: "readonly",
  it: "readonly",
  expect: "readonly",
  beforeAll: "readonly",
  afterAll: "readonly",
  beforeEach: "readonly",
  afterEach: "readonly",
  jest: "readonly"
};

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "coverage/**",
      "logs/**"
    ]
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...nodeGlobals
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-console": ["warn", { allow: ["error", "warn"] }],
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "prefer-const": "warn",
      "no-var": "error",
      "object-shorthand": ["warn", "always"],
      "arrow-body-style": ["warn", "as-needed"]
    }
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      globals: {
        ...nodeGlobals,
        ...jestGlobals
      }
    },
    rules: {
      "no-console": "off"
    }
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: {
        ...nodeGlobals
      }
    },
    rules: {
      "no-console": "off"
    }
  }
];