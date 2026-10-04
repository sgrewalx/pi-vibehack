#!/usr/bin/env node
// vibehack-config-sync: regenerate prompt frontmatter from ~/.pi/agent/vibehack/config.yaml.
//
// Invoked by the /vibehack-config sync slash command. Runs from any CWD —
// resolves the prompts directory relative to this script's own location via
// import.meta.url (NOT process.cwd()).

import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import * as os from "node:os";
import { rewritePromptsForProfile } from "./lib/rewrite-prompts.js";
import { addPromptPath } from "./lib/settings.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PROMPTS_DIR = path.resolve(HERE, "..", "prompts");
const VIBEHACK_DIR = path.join(os.homedir(), ".pi", "agent", "vibehack");
const RUNTIME_PROMPTS_DIR = path.join(VIBEHACK_DIR, "prompts");
const CONFIG_PATH = path.join(VIBEHACK_DIR, "config.yaml");
const SETTINGS_PATH = path.join(os.homedir(), ".pi", "agent", "settings.json");

export async function syncPrompts({
  profile = "hybrid",
  sourcePromptsDir = SOURCE_PROMPTS_DIR,
  runtimePromptsDir = RUNTIME_PROMPTS_DIR,
  configPath = CONFIG_PATH,
  settingsPath = SETTINGS_PATH,
} = {}) {
  await fs.rm(runtimePromptsDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(runtimePromptsDir), { recursive: true });
  await fs.cp(sourcePromptsDir, runtimePromptsDir, { recursive: true });

  await rewritePromptsForProfile(profile, {
    configPath,
    promptsDir: runtimePromptsDir,
  });

  await addPromptPath(settingsPath, runtimePromptsDir);

  return { runtimePromptsDir, configPath };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log("Usage: vibehack-config-sync [--profile <hybrid|local|frontier>]");
    console.log("");
    console.log(`  Reads ${CONFIG_PATH} (if present), copies package prompts to`);
    console.log(`  ${RUNTIME_PROMPTS_DIR}, and rewrites model frontmatter there.`);
    console.log("  The package source prompts remain unchanged.");
    console.log("  Falls back to the named profile when config.yaml is absent.");
    process.exit(0);
  }

  const profileIdx = process.argv.indexOf("--profile");
  const profile = profileIdx >= 0 ? process.argv[profileIdx + 1] : "hybrid";

  syncPrompts({ profile })
    .then(({ runtimePromptsDir, configPath }) => {
      console.log(
        `vibehack-config-sync: generated runtime prompts in ${runtimePromptsDir} ` +
        `(profile=${profile}, config=${configPath})`,
      );
    })
    .catch((e) => {
      console.error(`vibehack-config-sync failed: ${e?.message ?? String(e)}`);
      process.exit(1);
    });
}
