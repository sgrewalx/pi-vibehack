import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  ensureManagedBrowser,
  findChromiumExecutable,
  managedBrowserArgs,
} from "../extensions/pi-vibehack/lib/managed-browser.ts";

const originalChromeBin = process.env.VIBEHACK_CHROME_BIN;

afterEach(() => {
  if (originalChromeBin === undefined) {
    delete process.env.VIBEHACK_CHROME_BIN;
  } else {
    process.env.VIBEHACK_CHROME_BIN = originalChromeBin;
  }
});

describe("managed browser", () => {
  it("builds isolated headless CDP launch arguments", () => {
    expect(
      managedBrowserArgs("/tmp/vh-browser", "127.0.0.1", 9334),
    ).toEqual([
      "--headless=new",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=9334",
      "--user-data-dir=/tmp/vh-browser",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ]);
  });

  it("honours VIBEHACK_CHROME_BIN when it points to an existing file", () => {
    const dir = mkdtempSync(join(tmpdir(), "vh-chrome-"));
    const fakeChrome = join(dir, "chrome");
    writeFileSync(fakeChrome, "");

    try {
      process.env.VIBEHACK_CHROME_BIN = fakeChrome;
      expect(findChromiumExecutable()).toBe(fakeChrome);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reuses an existing healthy CDP endpoint without launching Chrome", async () => {
    const server = createServer((req, res) => {
      if (req.url === "/json/list") {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end("[]");
        return;
      }

      res.statusCode = 404;
      res.end();
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    try {
      const address = server.address() as AddressInfo;

      const result = await ensureManagedBrowser({
        host: "127.0.0.1",
        port: address.port,
        timeoutMs: 500,
      });

      expect(result.host).toBe("127.0.0.1");
      expect(result.port).toBe(address.port);
      expect(result.launched).toBe(false);
      expect(result.targets).toEqual([]);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
