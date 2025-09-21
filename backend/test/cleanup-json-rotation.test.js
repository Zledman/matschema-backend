const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

// Helper to run the cleanup script with environment overrides
function runCleanup(args = [], envExtra = {}) {
  const scriptPath = path.join(__dirname, "..", "scripts", "cleanup.js");
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    env: {
      ...process.env,
      CLEANUP_SKIP_DB: "1", // avoid real DB connection
      CLEANUP_LOG_DIR: path.join(__dirname, "logs-test"),
      ...envExtra,
    },
    encoding: "utf8",
  });
  return result;
}

function parseJson(line) {
  try {
    return JSON.parse(line.trim());
  } catch {
    return null;
  }
}

describe("cleanup.js --json & log rotation", () => {
  const logsDir = path.join(__dirname, "logs-test");
  const logFile = path.join(logsDir, "cleanup.log");

  beforeEach(() => {
    if (fs.existsSync(logsDir)) {
      fs.rmSync(logsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(logsDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(logsDir)) {
      fs.rmSync(logsDir, { recursive: true, force: true });
    }
  });

  test("JSON mode outputs single valid JSON line with expected fields", () => {
    const mock = { removedCount: 3 };
    const res = runCleanup(["--json"], {
      MOCK_CLEANUP_RET: JSON.stringify(mock),
    });
    expect(res.status).toBe(0);
    const stdout = res.stdout.trim();
    const obj = parseJson(stdout);
    expect(obj).toBeTruthy();
    expect(Object.keys(obj).sort()).toEqual(
      expect.arrayContaining(["ts", "mode", "daysOlder", "removedCount"])
    );
    expect(obj.removedCount).toBe(3);
    // Should not contain extra newlines / lines
    expect(stdout.split("\n").length).toBe(1);
    // Log file should exist
    expect(fs.existsSync(logFile)).toBe(true);
  });

  test("Log rotation occurs when file exceeds 5MB", () => {
    // Create a dummy log >5MB
    const fiveMbPlus = Buffer.alloc(5 * 1024 * 1024 + 2000, "A");
    fs.writeFileSync(logFile, fiveMbPlus);

    const mock = { removedCount: 1 };
    const res = runCleanup([], { MOCK_CLEANUP_RET: JSON.stringify(mock) });
    expect(res.status).toBe(0);

    // After rotation: original should be renamed, new cleanup.log should be small
    const files = fs.readdirSync(logsDir);
    const rotated = files.filter(
      (f) => f.startsWith("cleanup-") && f.endsWith(".log")
    );
    expect(rotated.length).toBe(1);
    const newStat = fs.statSync(logFile);
    expect(newStat.size).toBeLessThan(1024 * 1024); // new file should just have one line
  });

  test("Dry-run + JSON includes tokens array and still rotates if oversized", () => {
    // Pre-create oversized log to trigger rotation
    const fiveMbPlus = Buffer.alloc(5 * 1024 * 1024 + 5000, "B");
    fs.writeFileSync(logFile, fiveMbPlus);

    const mock = {
      removedCount: 2,
      removedTokens: [
        {
          tokenId: "t1",
          tokenType: "access",
          revokedAt: new Date().toISOString(),
        },
        {
          tokenId: "t2",
          tokenType: "refresh",
          revokedAt: new Date().toISOString(),
        },
      ],
    };

    const res = runCleanup(["--dry-run", "--json"], {
      MOCK_CLEANUP_RET: JSON.stringify(mock),
    });
    expect(res.status).toBe(0);
    const obj = parseJson(res.stdout);
    expect(obj.mode).toBe("dry-run");
    expect(obj.tokens).toBeTruthy();
    expect(Array.isArray(obj.tokens)).toBe(true);
    expect(obj.tokens.length).toBe(2);

    const files = fs.readdirSync(logsDir);
    const rotated = files.filter(
      (f) => f.startsWith("cleanup-") && f.endsWith(".log")
    );
    expect(rotated.length).toBe(1);
  });
});
