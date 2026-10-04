import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { listTargets, type CdpTarget } from "./cdp-client.ts";
import { vibehackRoot } from "./engagement.ts";

export const MANAGED_CDP_HOST = "127.0.0.1";
export const MANAGED_CDP_PORT = 9334;

export interface ManagedBrowserResult {
  host: string;
  port: number;
  launched: boolean;
  executable?: string;
  targets: CdpTarget[];
}

function commandOnPath(name: string): string | null {
  try {
    const command = process.platform === "win32" ? "where" : "which";
    const r = spawnSync(command, [name], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell: process.platform === "win32",
    });
    if (r.status !== 0) return null;
    return r.stdout.split(/\r?\n/)[0]?.trim() || null;
  } catch {
    return null;
  }
}

export function findChromiumExecutable(): string | null {
  const configured = process.env.VIBEHACK_CHROME_BIN;
  if (configured && existsSync(configured)) return configured;

  if (process.platform === "darwin") {
    const candidates = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    ];
    return candidates.find(existsSync) ?? null;
  }

  if (process.platform === "win32") {
    const roots = [
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
      process.env.LOCALAPPDATA,
    ].filter((v): v is string => !!v);

    const relativePaths = [
      ["Google", "Chrome", "Application", "chrome.exe"],
      ["Microsoft", "Edge", "Application", "msedge.exe"],
      ["BraveSoftware", "Brave-Browser", "Application", "brave.exe"],
    ];

    for (const root of roots) {
      for (const parts of relativePaths) {
        const candidate = join(root, ...parts);
        if (existsSync(candidate)) return candidate;
      }
    }
    return null;
  }

  for (const name of [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "microsoft-edge",
    "brave-browser",
  ]) {
    const found = commandOnPath(name);
    if (found) return found;
  }

  return null;
}

export function managedBrowserArgs(
  profileDir: string,
  host = MANAGED_CDP_HOST,
  port = MANAGED_CDP_PORT,
): string[] {
  return [
    "--headless=new",
    `--remote-debugging-address=${host}`,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ];
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCdp(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<CdpTarget[]> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      return await listTargets(host, port);
    } catch (e) {
      lastError = e;
      await sleep(150);
    }
  }

  throw new Error(
    `managed Chrome did not expose CDP at ${host}:${port}` +
      (lastError ? ` (${String((lastError as any)?.message ?? lastError)})` : ""),
  );
}

export async function ensureManagedBrowser({
  host = MANAGED_CDP_HOST,
  port = MANAGED_CDP_PORT,
  timeoutMs = 10_000,
}: {
  host?: string;
  port?: number;
  timeoutMs?: number;
} = {}): Promise<ManagedBrowserResult> {
  // Reuse an existing healthy managed browser.
  try {
    const targets = await listTargets(host, port);
    return { host, port, launched: false, targets };
  } catch {
    // No usable CDP endpoint yet — launch one below.
  }

  const executable = findChromiumExecutable();
  if (!executable) {
    throw new Error(
      "Chrome/Chromium not found; set VIBEHACK_CHROME_BIN to a Chromium executable",
    );
  }

  const profileDir =
    process.env.VIBEHACK_CHROME_PROFILE ??
    join(vibehackRoot(), "chrome-managed-profile");

  await fs.mkdir(profileDir, { recursive: true });

  const child = spawn(
    executable,
    managedBrowserArgs(profileDir, host, port),
    {
      stdio: "ignore",
      detached: true,
      shell: false,
    },
  );

  child.unref();

  const targets = await waitForCdp(host, port, timeoutMs);

  return {
    host,
    port,
    launched: true,
    executable,
    targets,
  };
}
