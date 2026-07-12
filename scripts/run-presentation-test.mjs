import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { relative, resolve, sep } from "node:path";

const root = process.cwd();
const requestedTest = process.argv[2];
const testFile = resolve(root, requestedTest ?? "");
const testRoot = resolve(root, "apps/mobile/src");
const testTimeoutMs = positiveInteger(process.env.PAWBLOOM_TEST_FILE_TIMEOUT_MS, 12_000);

if (!requestedTest || !existsSync(testFile) || (!testFile.startsWith(`${testRoot}${sep}`) && testFile !== testRoot) || !/\.test\.(ts|tsx)$/.test(testFile)) {
  console.error("Expected a test file inside apps/mobile/src.");
  process.exit(2);
}

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;
const ts = require(resolve(root, "apps/mobile/node_modules/typescript"));
const platform = testFile.endsWith(".web.test.ts") || testFile.endsWith(`${sep}confirmAction.test.ts`) ? "web" : "ios";
const reactNativeMock = createReactNativeMock(platform);

Module._load = function loadWithMobileMocks(request, parent, isMain) {
  if (request === "react-native") return reactNativeMock;
  if (request === "react-native-url-polyfill/auto") return {};
  if (request === "expo-secure-store") return createSecureStoreMock();
  if (request === "expo-sqlite") return createSQLiteMock();
  if (request === "@react-native-community/datetimepicker") return passthroughComponent;
  if (request.startsWith("@expo/vector-icons")) return createIconMock();
  return originalLoad.call(this, request, parent, isMain);
};

function transpileTypeScriptModule(module, filename) {
  const source = readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  if (resolve(filename) !== testFile) {
    module._compile(output.outputText, filename);
    return;
  }

  module._compile(
    `const __testExecution = (async () => {\n${output.outputText}\nif (exports.default && typeof exports.default.then === "function") await exports.default;\n})();\nmodule.exports.__testExecution = __testExecution;`,
    filename,
  );
}

require.extensions[".ts"] = transpileTypeScriptModule;
require.extensions[".tsx"] = transpileTypeScriptModule;

try {
  const loaded = require(testFile);
  await withTimeout(loaded.__testExecution, testTimeoutMs);
  console.log(`PASS ${relative(root, testFile)}`);
} catch (error) {
  console.error(`FAIL ${relative(root, testFile)}`);
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
}

async function withTimeout(execution, timeoutMs) {
  let timeout;
  const expired = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`Test timed out after ${timeoutMs}ms: ${relative(root, testFile)}`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(execution), expired]);
  } finally {
    clearTimeout(timeout);
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createReactNativeMock(os) {
  const defaultAlert = (_title, _message, buttons) => buttons?.[0]?.onPress?.();
  let alertImplementation = defaultAlert;
  const alert = (...args) => {
    const implementation = alertImplementation;
    queueMicrotask(() => implementation(...args));
  };
  const Alert = {};

  Object.defineProperty(Alert, "alert", {
    enumerable: true,
    get: () => alert,
    set: (implementation) => {
      alertImplementation = implementation === alert ? defaultAlert : implementation;
    },
  });

  const knownExports = {
    Alert,
    Platform: {
      OS: os,
      select: (values) => values[os] ?? values.default,
    },
    StyleSheet: {
      create: (styles) => styles,
    },
  };

  return new Proxy(knownExports, {
    get: (target, property) => property in target ? target[property] : passthroughComponent,
  });
}

function passthroughComponent() {
  return null;
}

function createIconMock() {
  return new Proxy({}, { get: () => passthroughComponent });
}

function createSecureStoreMock() {
  return {
    getItemAsync: async () => null,
    setItemAsync: async () => undefined,
    deleteItemAsync: async () => undefined,
  };
}

function createSQLiteMock() {
  return {
    openDatabaseSync: () => ({
      execAsync: async () => undefined,
      runAsync: async () => undefined,
      getAllAsync: async () => [],
    }),
  };
}
