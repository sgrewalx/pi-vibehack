import { describe, expect, it } from "vitest";
import { CdpSession } from "../extensions/pi-vibehack/lib/cdp-client.ts";

describe("CdpSession", () => {
  it("times out an unanswered CDP command instead of hanging indefinitely", async () => {
    const session = new CdpSession("ws://127.0.0.1:9222/devtools/page/test");

    // send() only needs an attached socket. Use a minimal fake so this test
    // exercises command timeout behavior without starting Chrome or a WS server.
    (session as any).socket = {
      write() {},
      end() {},
    };

    await expect(
      session.send("Page.captureScreenshot", {}, 25),
    ).rejects.toThrow(
      "CDP command timed out: Page.captureScreenshot (25ms)",
    );

    expect((session as any).pending.size).toBe(0);

    session.close();
  });
});
