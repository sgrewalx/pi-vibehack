// browser-verify behaviour for an explicitly supplied CDP endpoint.
//
// We don't bring up a real Chrome here; instead we assert that an explicit
// unavailable port returns { error: 'no-chrome-attached' } rather than falling
// back to the managed-browser launcher.

import { describe, it, expect } from "vitest";
import { browserVerifyTool } from "../extensions/pi-vibehack/tools/browser-verify.ts";

describe("browser-verify graceful failure", () => {
  it("returns no-chrome-attached when no listener on the chosen port", async () => {
    // Pick a port unlikely to be open. 1 is privileged on most systems, but
    // node:http will get ECONNREFUSED in the listTargets fetch either way.
    const r: any = await (browserVerifyTool as any).execute(
      "cid",
      { url: "http://example.com", port: 59999, timeout_ms: 1500 },
    );
    expect(r.error).toBe("no-chrome-attached");
    expect(r.hint).toMatch(/--remote-debugging-port=59999/);
  });

  it("normalizes alias arg names via prepareArguments", () => {
    const prepare: any = (browserVerifyTool as any).prepareArguments;
    const out = prepare({ target: "https://x", expect: "1+1", timeoutMs: 5000 });
    expect(out.url).toBe("https://x");
    expect(out.expectation).toBe("1+1");
    expect(out.timeout_ms).toBe(5000);
  });
});
