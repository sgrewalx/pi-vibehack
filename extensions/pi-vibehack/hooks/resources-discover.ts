// resources_discover hook — surfaces EXTRA, per-session resources to pi-mono.
//
// Package prompts/ are source templates only. Config-driven runtime prompts
// live under ~/.pi/agent/vibehack/prompts/ and are registered once through
// settings.json.
//
// This hook therefore returns only dynamic resources that cannot be declared
// statically:
//   • per-engagement prompts/ and skills/
//   • global learned/user skills
//
// It deliberately does NOT return the global runtime prompts directory,
// because doing so would register those prompts twice.

import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "../lib/typed-pi.ts";
import { activeEngagementId, engagementDir, vibehackRoot } from "../lib/engagement.ts";

async function dirExists(p: string): Promise<boolean> {
  try { const st = await fs.stat(p); return st.isDirectory(); } catch { return false; }
}

export async function computeResourcePaths(): Promise<{ skillPaths: string[]; promptPaths: string[] }> {
  const promptPaths: string[] = [];
  const skillPaths: string[] = [];

  // Per-engagement extras
  try {
    const eng = await activeEngagementId();
    if (eng) {
      const engPrompts = join(engagementDir(eng), "prompts");
      const engSkills = join(engagementDir(eng), "skills");
      if (await dirExists(engPrompts)) promptPaths.push(engPrompts);
      if (await dirExists(engSkills)) skillPaths.push(engSkills);
    }
  } catch {}

  // Global learned/user skills. Runtime prompts are already registered
  // through settings.json and must not be returned here a second time.
  try {
    const userSkills = join(vibehackRoot(), "skills");
    if (await dirExists(userSkills)) skillPaths.push(userSkills);
  } catch {}

  return { skillPaths, promptPaths };
}

export function registerResourcesDiscoverHook(pi: ExtensionAPI) {
  pi.on("resources_discover", async () => {
    return await computeResourcePaths();
  });
}
