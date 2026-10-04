// vibehack_browser_verify — raw-CDP browser verifier.
//
// With no host/port override, vibehack reuses or launches a dedicated headless
// Chromium instance. Explicit host/port arguments preserve the original
// operator-managed CDP behavior.
//
// Why not Patchright? Per v1.2 plan: keep the dependency footprint tiny. The
// minimal CDP client lives in lib/cdp-client.ts (~200 LoC, no deps).

import { Type } from "@sinclair/typebox";
import { listTargets, CdpSession } from "../lib/cdp-client.ts";
import {
  ensureManagedBrowser,
  MANAGED_CDP_HOST,
  MANAGED_CDP_PORT,
} from "../lib/managed-browser.ts";
import { normalizeArgs, safePrepare } from "../lib/prepare-args.ts";

export const browserVerifySchema = Type.Object({
  url: Type.String(),
  expectation: Type.Optional(Type.String()),
  port: Type.Optional(Type.Integer({ minimum: 1, maximum: 65535 })),
  host: Type.Optional(Type.String()),
  timeout_ms: Type.Optional(Type.Integer({ minimum: 1000, maximum: 60000 })),
}, { additionalProperties: false });

export const browserVerifyTool = {
  name: "vibehack_browser_verify",
  label: "Verify finding in browser",
  description:
    "Navigate a managed headless Chromium browser to <url>, optionally evaluate " +
    "<expectation> as JS, and return its value + a screenshot. Supplying host or " +
    "port uses that explicit CDP endpoint instead of launching a managed browser.",
  parameters: browserVerifySchema,

  prepareArguments: safePrepare((args: unknown) =>
    normalizeArgs(args, {
      target: "url",
      href: "url",
      expect: "expectation",
      assertion: "expectation",
      timeoutMs: "timeout_ms",
      timeout: "timeout_ms",
    }),
  ) as any,

  async execute(
    _callId: string,
    params: { url: string; expectation?: string; port?: number; host?: string; timeout_ms?: number },
    _signal?: any,
    _onUpdate?: any,
    _ctx?: any,
  ): Promise<any> {
    const timeoutMs = params.timeout_ms ?? 15_000;
    const explicitEndpoint =
      params.host !== undefined || params.port !== undefined;

    const host = params.host ??
      (explicitEndpoint ? "127.0.0.1" : MANAGED_CDP_HOST);
    const port = params.port ??
      (explicitEndpoint ? 9222 : MANAGED_CDP_PORT);

    let targets;
    try {
      if (explicitEndpoint) {
        targets = await listTargets(host, port);
      } else {
        const managed = await ensureManagedBrowser({
          host,
          port,
          timeoutMs: Math.min(timeoutMs, 10_000),
        });
        targets = managed.targets;
      }
    } catch (e: any) {
      if (explicitEndpoint) {
        return {
          error: "no-chrome-attached",
          hint: `start Chrome with --remote-debugging-port=${port} (got: ${e?.message ?? String(e)})`,
        };
      }

      return {
        error: "managed-browser-unavailable",
        hint: String(e?.message ?? e),
      };
    }
    const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
    if (!page?.webSocketDebuggerUrl) {
      return { error: "no-page-target", hint: "open a tab in the attached Chrome and retry" };
    }

    const session = new CdpSession(page.webSocketDebuggerUrl);
    try {
      await session.open(timeoutMs);
      await session.send("Page.enable", {}, timeoutMs);
      await session.send("Runtime.enable", {}, timeoutMs);

      const loaded = new Promise<void>((resolve) => {
        const off = session.on("Page.loadEventFired", () => { off(); resolve(); });
        setTimeout(() => { off(); resolve(); }, timeoutMs);
      });
      await session.send("Page.navigate", { url: params.url }, timeoutMs);
      await loaded;

      let evalResult: any = undefined;
      if (params.expectation) {
        try {
          const r = await session.send("Runtime.evaluate", {
            expression: params.expectation,
            returnByValue: true,
            awaitPromise: true,
            timeout: Math.min(timeoutMs, 10_000),
          }, timeoutMs);
          evalResult = r.exceptionDetails
            ? { error: r.exceptionDetails.text ?? "exception", details: r.exceptionDetails }
            : { value: r.result?.value };
        } catch (e: any) {
          evalResult = { error: String(e?.message ?? e) };
        }
      }

      let screenshot: string | undefined;
      try {
        const r = await session.send(
          "Page.captureScreenshot",
          { format: "png" },
          timeoutMs,
        );
        screenshot = r.data; // base64 PNG
      } catch {
        screenshot = undefined;
      }

      return {
        url: params.url,
        target_id: page.id,
        evaluation: evalResult,
        screenshot_b64: screenshot,
      };
    } catch (e: any) {
      return { error: "cdp-failed", reason: String(e?.message ?? e) };
    } finally {
      try { session.close(); } catch {}
    }
  },
};
