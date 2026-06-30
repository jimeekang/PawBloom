import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRef = "xgvbtabedbocrebqilsh";
const expectedGitRemote = "git@github.com:jimeekang/PawBloom.git";
const expectedMcpUrl = `https://mcp.supabase.com/mcp?project_ref=${projectRef}&read_only=true`;
const localhostUrl = process.env.CODEX_LOCALHOST_URL ?? "http://localhost:3200";
const simulatorOpenUrl = process.env.CODEX_SIMULATOR_OPEN_URL;

const checks = [];

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: resolve(import.meta.dirname, ".."),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function parseJson(command, args) {
  return JSON.parse(run(command, args));
}

function record(name, fn) {
  try {
    const detail = fn();
    checks.push({ name, ok: true, detail });
  } catch (error) {
    const stderr = error.stderr?.toString().trim();
    const stdout = error.stdout?.toString().trim();
    checks.push({
      name,
      ok: false,
      detail: stderr || stdout || error.message,
    });
  }
}

function chooseIosDevice() {
  const output = parseJson("xcrun", ["simctl", "list", "devices", "available", "--json"]);
  const devices = Object.entries(output.devices ?? {})
    .filter(([runtime]) => runtime.includes("iOS"))
    .flatMap(([, runtimeDevices]) => runtimeDevices)
    .filter((device) => device.isAvailable && device.name.startsWith("iPhone"));

  const preferredNames = ["iPhone 17 Pro", "iPhone 16 Pro", "iPhone 15 Pro"];
  return (
    devices.find((device) => device.state === "Booted") ??
    preferredNames.map((name) => devices.find((device) => device.name === name)).find(Boolean) ??
    devices[0]
  );
}

function bootIosDevice(device) {
  if (!device) {
    throw new Error("No available iPhone simulator was found.");
  }

  if (device.state !== "Booted") {
    try {
      run("xcrun", ["simctl", "boot", device.udid], { timeout: 60_000 });
    } catch (error) {
      const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
      if (!output.includes("current state: Booted")) {
        throw error;
      }
    }
  }

  run("xcrun", ["simctl", "bootstatus", device.udid, "-b"], { timeout: 90_000 });
}

record("Host is macOS", () => {
  if (process.platform !== "darwin") {
    throw new Error(`Expected darwin, got ${process.platform}.`);
  }
  return process.platform;
});

record("Node.js version is available", () => process.version);

record("Git CLI is installed", () => run("git", ["--version"]).trim());

record("Supabase CLI is installed", () => run("supabase", ["--version"]).trim());

record("Supabase project is linked", () => {
  const parsed = JSON.parse(
    run("supabase", [
      "projects",
      "list",
      "--output-format",
      "json",
      "--agent",
      "no",
    ]),
  );
  const projects = Array.isArray(parsed) ? parsed : (parsed.projects ?? []);
  const project = projects.find((candidate) => candidate.ref === projectRef);
  if (!project) {
    throw new Error(`Project ${projectRef} was not returned by Supabase.`);
  }
  if (!project.linked) {
    throw new Error(`Project ${projectRef} is visible but not linked.`);
  }
  return `${project.name} (${project.status})`;
});

record("Supabase linked database responds", () =>
  run("supabase", [
    "db",
    "query",
    "--linked",
    "select current_database() as database_name, current_user as user_name;",
    "--agent",
    "no",
  ])
    .trim()
    .replace(/\s+/g, " "),
);

record("Supabase MCP config is project-scoped", () => {
  const configPath = resolve(import.meta.dirname, "..", ".mcp.json");
  if (!existsSync(configPath)) {
    throw new Error(".mcp.json is missing.");
  }
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const url = config.mcpServers?.supabase?.url;
  if (url !== expectedMcpUrl) {
    throw new Error(`Unexpected Supabase MCP URL: ${url}`);
  }
  return url;
});

record("Supabase MCP endpoint is reachable", () => {
  const status = run("curl", [
    "-so",
    "/dev/null",
    "-w",
    "%{http_code}",
    "https://mcp.supabase.com/mcp",
  ]).trim();
  if (status !== "401") {
    throw new Error(`Expected unauthenticated 401, got ${status}.`);
  }
  return "401 unauthenticated response";
});

record("Localhost 3200 responds on this Mac", () => {
  const status = run("curl", [
    "-fsS",
    "--max-time",
    "3",
    "-o",
    "/dev/null",
    "-w",
    "%{http_code}",
    localhostUrl,
  ], {
    timeout: 5_000,
  }).trim();
  return `${localhostUrl} returned HTTP ${status}`;
});

record("Xcode iOS simulator tooling is available", () =>
  run("xcrun", ["simctl", "help"]).split("\n")[0].trim(),
);

record("iOS Simulator is open for localhost 3200 preview", () => {
  run("open", ["-a", "Simulator"]);
  const device = chooseIosDevice();
  bootIosDevice(device);
  if (simulatorOpenUrl) {
    run("xcrun", ["simctl", "openurl", device.udid, simulatorOpenUrl]);
    return `${device.name} opened ${simulatorOpenUrl}`;
  }
  return `${device.name} is running; ${localhostUrl} stays in the Mac browser preview`;
});

record("Git origin uses SSH", () => {
  const remote = run("git", ["config", "--get", "remote.origin.url"]).trim();
  if (remote !== expectedGitRemote) {
    throw new Error(`Expected ${expectedGitRemote}, got ${remote}`);
  }
  return remote;
});

record("GitHub SSH auth works", () => {
  try {
    run("ssh", ["-T", "-o", "BatchMode=yes", "git@github.com"]);
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    if (output.includes("successfully authenticated")) {
      return output.trim();
    }
    throw error;
  }
  return "authenticated";
});

for (const check of checks) {
  const mark = check.ok ? "PASS" : "FAIL";
  console.log(`${mark} ${check.name}: ${check.detail}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  process.exitCode = 1;
}
