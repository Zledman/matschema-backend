const path = require("path");
const fs = require("fs");

// We'll import the script in embedded mode to avoid process.exit
const scriptPath = path.join(__dirname, "..", "scripts", "cleanup.js");

function setEnv(overrides = {}) {
  Object.entries(overrides).forEach(([k, v]) => (process.env[k] = v));
}

describe("cleanup.js rotation error handling", () => {
  const logsDir = path.join(__dirname, "logs-test-error");
  const logFile = path.join(logsDir, "cleanup.log");
  const { logger } = require("../utils/logger");
  let warnMessages = [];
  let errorMessages = [];
  let warnSpy;
  let errorSpy;

  beforeEach(() => {
    // fresh env
    delete require.cache[require.resolve(scriptPath)];
    warnMessages = [];
    errorMessages = [];
    warnSpy = jest.spyOn(logger, "warn").mockImplementation((obj, msg) => {
      if (typeof obj === "string") {warnMessages.push(obj);}
      else if (msg) {warnMessages.push(msg);}
      else {warnMessages.push(JSON.stringify(obj));}
    });
    errorSpy = jest.spyOn(logger, "error").mockImplementation((obj, msg) => {
      if (typeof obj === "string") {errorMessages.push(obj);}
      else if (msg) {errorMessages.push(msg);}
      else {errorMessages.push(JSON.stringify(obj));}
    });

    if (fs.existsSync(logsDir))
      {fs.rmSync(logsDir, { recursive: true, force: true });}
    fs.mkdirSync(logsDir, { recursive: true });
    setEnv({
      CLEANUP_EMBED: "1",
      CLEANUP_SKIP_DB: "1",
      CLEANUP_LOG_DIR: logsDir,
      MOCK_CLEANUP_RET: JSON.stringify({ removedCount: 0 }),
    });
  });

  afterEach(async () => {
    if (warnSpy) {warnSpy.mockRestore();}
    if (errorSpy) {errorSpy.mockRestore();}
    // Allow pino file stream to flush before deleting directory
    await new Promise((r) => setTimeout(r, 50));
    if (fs.existsSync(logsDir)) {
      fs.rmSync(logsDir, { recursive: true, force: true });
    }
    // Clear test env vars
    [
      "CLEANUP_EMBED",
      "CLEANUP_SKIP_DB",
      "CLEANUP_LOG_DIR",
      "MOCK_CLEANUP_RET",
    ].forEach((k) => delete process.env[k]);
    jest.restoreAllMocks();
  });

  test("Scenario A: rename error during rotation is handled", async () => {
    fs.writeFileSync(logFile, "initial");
    // Require script first (no rotation yet since file is tiny)
    const { runCleanupScript } = require(scriptPath);
    // Now enlarge size via stat mock and simulate failing rename only during cleanup run
    const origStat = fs.statSync;
    const statSpy = jest.spyOn(fs, "statSync").mockImplementation((p) => {
      if (p === logFile) {
        const s = origStat(p);
        return { ...s, size: 6 * 1024 * 1024 };
      }
      return origStat(p);
    });
    let callCount = 0;
    const renameSpy = jest
      .spyOn(fs, "renameSync")
      .mockImplementation((...args) => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Simulated rename failure");
        }
        return fs.renameSync.mockOriginalValue
          ? fs.renameSync.mockOriginalValue(...args)
          : undefined;
      });
    await runCleanupScript();
    expect(statSpy).toHaveBeenCalled();
    expect(renameSpy).toHaveBeenCalled();
    expect(fs.existsSync(logFile)).toBe(true);
    expect(warnMessages.join("\n")).toMatch(/rotation rename failed/);
  });

  test("Scenario B: mkdir failure is handled", async () => {
    // Remove directory and mock mkdirSync to throw
    if (fs.existsSync(logsDir))
      {fs.rmSync(logsDir, { recursive: true, force: true });}
    const mkdirSpy = jest.spyOn(fs, "mkdirSync").mockImplementation(() => {
      throw new Error("Cannot create directory");
    });

    const { runCleanupScript } = require(scriptPath);
    await runCleanupScript();

    expect(mkdirSpy).toHaveBeenCalled();
    // Directory should still not exist
    expect(fs.existsSync(logsDir)).toBe(false);
    // Script handled error without throwing
    const combined = [...warnMessages, ...errorMessages].join("\n");
    expect(combined).not.toMatch(/Unhandled/);
  });
});
