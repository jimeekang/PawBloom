import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const repositoryRoot = process.cwd();
const legacyWorkflowPath = join(repositoryRoot, ".eas/workflows/release.yml");
const appRoot = join(repositoryRoot, "apps/mobile");
const workflowPath = join(appRoot, ".eas/workflows/release.yml");
const easConfigPath = join(appRoot, "eas.json");
const packagePath = join(repositoryRoot, "package.json");
const failures = [];

const requireMatch = (text, pattern, message) => {
  if (!pattern.test(text)) failures.push(message);
};

const jobBlock = (workflow, jobId) => {
  const startPattern = new RegExp(`^  ${jobId}:\\s*$`, "m");
  const match = startPattern.exec(workflow);
  if (!match) return "";

  const start = match.index + match[0].length;
  const nextJob = /^  [A-Za-z0-9_-]+:\s*$/gm;
  nextJob.lastIndex = start;
  const nextMatch = nextJob.exec(workflow);
  return workflow.slice(start, nextMatch?.index ?? workflow.length);
};

if (existsSync(legacyWorkflowPath)) {
  failures.push("Release workflow must live beside apps/mobile/eas.json, not at repository .eas/workflows/release.yml");
}

if (!existsSync(workflowPath)) {
  failures.push("Missing apps/mobile/.eas/workflows/release.yml");
} else {
  const workflow = readFileSync(workflowPath, "utf8");
  if (statSync(workflowPath).size > 16 * 1024) {
    failures.push("EAS workflow exceeds the documented 16 KiB limit");
  }

  requireMatch(workflow, /^on:\s*$[\s\S]*?^\s{2}push:\s*$[\s\S]*?^\s{4}tags:\s*$[\s\S]*?^\s{6}-\s+["']v\*["']\s*$/m, "Release workflow must trigger only from version tags");
  requireMatch(workflow, /^jobs:\s*$/m, "Release workflow is missing jobs");

  const jobsSection = workflow.slice(workflow.search(/^jobs:\s*$/m));
  const jobIds = [...jobsSection.matchAll(/^  ([A-Za-z0-9_-]+):\s*$/gm)].map((match) => match[1]);
  const invalidJobIds = jobIds.filter((jobId) => !/^[A-Za-z0-9_]+$/.test(jobId));
  if (invalidJobIds.length) failures.push(`EAS job IDs may contain only alphanumeric characters and underscores: ${invalidJobIds.join(", ")}`);
  if (jobIds.join(",") !== "verify_release,build_ios") {
    failures.push(`Expected only verify_release then build_ios jobs; found ${jobIds.join(", ") || "none"}`);
  }

  const verifyJob = jobBlock(workflow, "verify_release");
  requireMatch(verifyJob, /^\s{4}environment:\s+production\s*$/m, "verify_release must use the production EAS environment");
  requireMatch(verifyJob, /^\s{4}steps:\s*$/m, "verify_release must be a custom steps job");
  const checkoutIndex = verifyJob.indexOf("uses: eas/checkout");
  const installIndex = verifyJob.indexOf("uses: eas/install_node_modules");
  if (checkoutIndex < 0 || installIndex <= checkoutIndex) {
    failures.push("verify_release must check out the repository before installing dependencies");
  }
  requireMatch(verifyJob, /^\s{8}run:\s+npm --prefix \.\.\/\.\. run verify\s*$/m, "verify_release must run the repository verification gate from the app root");

  const buildJob = jobBlock(workflow, "build_ios");
  requireMatch(buildJob, /^\s{4}needs:\s*\[verify_release\]\s*$/m, "build_ios must depend on verify_release");
  requireMatch(buildJob, /^\s{4}environment:\s+production\s*$/m, "build_ios must use the production EAS environment");
  requireMatch(buildJob, /^\s{4}type:\s+build\s*$/m, "build_ios must use the EAS build job");
  requireMatch(buildJob, /^\s{4}params:\s*$/m, "build_ios is missing build params");
  requireMatch(buildJob, /^\s{6}platform:\s+ios\s*$/m, "build_ios must target iOS");
  requireMatch(buildJob, /^\s{6}profile:\s+production\s*$/m, "build_ios must use the production profile");

  if (/^\s+working_directory:\s*/m.test(workflow)) {
    failures.push("Release workflow must not place unsupported working_directory under build params");
  }
  if (/^\s+platform:\s+android\s*$/m.test(workflow) || /^\s+type:\s+(?:submit|testflight)\s*$/m.test(workflow)) {
    failures.push("iOS-first release workflow must not build Android or submit automatically");
  }
}

if (!existsSync(easConfigPath)) {
  failures.push("Missing apps/mobile/eas.json beside the workflow directory");
} else {
  try {
    const easConfig = JSON.parse(readFileSync(easConfigPath, "utf8"));
    const productionProfile = easConfig?.build?.production;
    if (!productionProfile || productionProfile.env?.EXPO_PUBLIC_APP_PROFILE !== "production") {
      failures.push('eas.json production profile must set EXPO_PUBLIC_APP_PROFILE to "production"');
    }
    const iosResourceClass = productionProfile?.ios?.resourceClass;
    if (iosResourceClass && !["default", "medium", "large", "m-medium"].includes(iosResourceClass)) {
      failures.push(`eas.json uses unsupported iOS resourceClass: ${iosResourceClass}`);
    }
  } catch (error) {
    failures.push(`apps/mobile/eas.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

try {
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  if (packageJson?.scripts?.["verify:release"] !== "node scripts/verify-release.mjs") {
    failures.push("package.json must expose the deterministic verify:release command");
  }
  if (!packageJson?.scripts?.verify?.includes("npm run verify:release")) {
    failures.push("npm run verify must include verify:release");
  }
} catch (error) {
  failures.push(`package.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Release verification passed: iOS production build is gated and requires manual submission.");
