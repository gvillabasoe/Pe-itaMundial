import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import os from "node:os";
import { fileURLToPath } from "node:url";

const require = Module.createRequire(import.meta.url);
const ts = require("typescript");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverOnlyStub = path.join(os.tmpdir(), "penita-server-only-stub.cjs");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request === "server-only") {
    return serverOnlyStub;
  }
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(projectRoot, request.slice(2)), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

if (!fs.existsSync(serverOnlyStub)) {
  fs.writeFileSync(serverOnlyStub, "module.exports = {};\n");
}

function registerTsExtension(extension) {
  require.extensions[extension] = function compileTypescript(module, filename) {
    const source = fs.readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        resolveJsonModule: true,
        skipLibCheck: true,
        strict: false,
      },
      fileName: filename,
    }).outputText;
    module._compile(output, filename);
  };
}

registerTsExtension(".ts");
registerTsExtension(".tsx");

require(path.join(projectRoot, "lib", "__tests__", "critical-regressions.test.ts"));

const previousAdminSecret = process.env.ADMIN_SESSION_SECRET;
process.env.ADMIN_SESSION_SECRET = "critical-test-admin-secret-with-enough-entropy";
try {
  const { createAdminSessionCookieValue, isValidAdminSessionValue } = require(path.join(projectRoot, "lib", "admin-session.ts"));
  const value = await createAdminSessionCookieValue(new Date("2026-01-01T00:00:00.000Z").getTime());
  assert.ok(value, "admin session cookie is generated");
  assert.equal(await isValidAdminSessionValue(value, new Date("2026-01-01T00:00:01.000Z").getTime()), true);
  assert.equal(await isValidAdminSessionValue(`${value}x`, new Date("2026-01-01T00:00:01.000Z").getTime()), false);
  console.log("ok - admin session cookie is signed and tamper-resistant");
} finally {
  if (previousAdminSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = previousAdminSecret;
}

const previousUserSecret = process.env.USER_SESSION_SECRET;
process.env.USER_SESSION_SECRET = "critical-test-user-secret-with-enough-entropy";
try {
  const { createUserSessionCookieValue, parseUserSessionCookie } = require(path.join(projectRoot, "lib", "user-session.ts"));
  const value = createUserSessionCookieValue({ userId: "u1", username: "alice", role: "user" });
  assert.ok(value, "user session cookie is generated");
  assert.equal(parseUserSessionCookie(value)?.userId, "u1");
  assert.equal(parseUserSessionCookie(`${value}x`), null);
  console.log("ok - user session cookie is signed and tamper-resistant");
} finally {
  if (previousUserSecret === undefined) delete process.env.USER_SESSION_SECRET;
  else process.env.USER_SESSION_SECRET = previousUserSecret;
}
