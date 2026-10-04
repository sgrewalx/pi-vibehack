import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { defaultConfig, writeConfig } from "../bin/lib/config.js";
import { readSettings } from "../bin/lib/settings.js";
import { syncPrompts } from "../bin/vibehack-config-sync.js";

describe("vibehack config sync", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vibehack-config-sync-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("generates runtime prompts without modifying source prompts", async () => {
    const source = join(tmp, "source-prompts");
    const runtime = join(tmp, "runtime-prompts");
    const configPath = join(tmp, "config.yaml");
    const settingsPath = join(tmp, "settings.json");

    await fs.mkdir(source, { recursive: true });

    const original = `---
description: test planner prompt
model: claude-haiku-4-5
---

Test body.
`;

    await fs.writeFile(join(source, "vibehack-start.md"), original);

    const cfg = defaultConfig("hybrid");
    cfg.models.planner = "ollama/test-model:latest";
    writeConfig(configPath, cfg);

    await syncPrompts({
      profile: "hybrid",
      sourcePromptsDir: source,
      runtimePromptsDir: runtime,
      configPath,
      settingsPath,
    });

    expect(await fs.readFile(join(source, "vibehack-start.md"), "utf8"))
      .toBe(original);

    expect(await fs.readFile(join(runtime, "vibehack-start.md"), "utf8"))
      .toMatch(/^model: ollama\/test-model:latest$/m);

    const settings = await readSettings(settingsPath);
    expect(settings.prompts).toEqual([runtime]);
  });
});
