// Phase 7 of v1.2: /vibehack handler should call pi.setSessionName so /resume
// shows the engagement target instead of an encoded cwd.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import vibehack from "../extensions/pi-vibehack/index.ts";

describe("vibehack engagement session naming", () => {
  let tmp: string;
  let origDataDir: string | undefined;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-name-"));
    origDataDir = process.env.VIBEHACK_DATA_DIR;
    process.env.VIBEHACK_DATA_DIR = tmp;
  });

  afterEach(async () => {
    if (origDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = origDataDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("calls pi.setSessionName('vibehack: <target>') after bootstrap", async () => {
    const setSessionName = vi.fn();
    let captured: any = null;
    const fakePi: any = {
      events: { emit: vi.fn(), on: vi.fn() },
      on: vi.fn(),
      registerTool: vi.fn(),
      registerCommand: (name: string, opts: any) => {
        if (name === "vibehack") captured = opts.handler;
      },
      registerMessageRenderer: vi.fn(),
      setSessionName,
      setActiveTools: vi.fn(),
    };
    vibehack(fakePi);
    expect(captured).toBeTruthy();
    const ctx: any = { ui: { notify: vi.fn() } };
    await captured("example.com", ctx);
    const calls = setSessionName.mock.calls.map((c) => c[0]);
    expect(calls.some((s: string) => s === "vibehack: example.com")).toBe(true);
  });



  it("compares stored target metadata instead of engagement-id suffixes", async () => {
    const { setActiveEngagement, engagementDir, activeEngagementId } =
      await import("../extensions/pi-vibehack/lib/engagement.ts");
    const { appendEvent, nowIso, readEvents } =
      await import("../extensions/pi-vibehack/lib/events.ts");

    const existing = "2026-10-04-https-example-com";
    await fs.mkdir(engagementDir(existing), { recursive: true });
    await setActiveEngagement(existing);
    await appendEvent(engagementDir(existing), {
      ts: nowIso(),
      engagement_id: existing,
      event: "engagement_start",
      metadata: { target: "https://example.com" },
    } as any);

    const setSessionName = vi.fn();
    let captured: any = null;

    const fakePi: any = {
      events: { emit: vi.fn(), on: vi.fn() },
      on: vi.fn(),
      registerTool: vi.fn(),
      registerCommand: (name: string, opts: any) => {
        if (name === "vibehack") captured = opts.handler;
      },
      registerMessageRenderer: vi.fn(),
      setSessionName,
      setActiveTools: vi.fn(),
    };

    vibehack(fakePi);

    const ctx: any = { ui: { notify: vi.fn() } };
    await captured("example.com", ctx);

    expect(setSessionName).toHaveBeenCalledWith("vibehack: example.com");

    const active = await activeEngagementId();
    expect(active).not.toBe(existing);

    const events = await readEvents(engagementDir(active!));
    const start = events.find((event: any) => event.event === "engagement_start");
    expect((start as any)?.metadata?.target).toBe("example.com");
  });

  it("does not mistake a --loop value for the engagement target", async () => {
    const setSessionName = vi.fn();
    let captured: any = null;

    const fakePi: any = {
      events: { emit: vi.fn(), on: vi.fn() },
      on: vi.fn(),
      registerTool: vi.fn(),
      registerCommand: (name: string, opts: any) => {
        if (name === "vibehack") captured = opts.handler;
      },
      registerMessageRenderer: vi.fn(),
      setSessionName,
      setActiveTools: vi.fn(),
    };

    vibehack(fakePi);

    const ctx: any = { ui: { notify: vi.fn() } };
    await captured("--loop 3 http://127.0.0.1:3000", ctx);

    expect(setSessionName).toHaveBeenCalledWith(
      "vibehack: http://127.0.0.1:3000",
    );
  });

  it("keeps prompt runtime flags out of the engagement target and invokes vibehack-start", async () => {
    const setSessionName = vi.fn();
    const emit = vi.fn();
    let captured: any = null;

    const fakePi: any = {
      events: { emit, on: vi.fn() },
      on: vi.fn(),
      registerTool: vi.fn(),
      registerCommand: (name: string, opts: any) => {
        if (name === "vibehack") captured = opts.handler;
      },
      registerMessageRenderer: vi.fn(),
      setSessionName,
      setActiveTools: vi.fn(),
    };

    vibehack(fakePi);

    const ctx: any = { ui: { notify: vi.fn() } };
    const args =
      "--model=ollama/qwen3-coder-64k:latest http://127.0.0.1:3000";

    await captured(args, ctx);

    expect(setSessionName).toHaveBeenCalledWith(
      "vibehack: http://127.0.0.1:3000",
    );

    expect(emit).toHaveBeenCalledWith(
      "prompt-template:prompt:invoke",
      expect.objectContaining({
        protocolVersion: 1,
        name: "vibehack-start",
        args,
      }),
    );
  });

});
