import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { expandSchema } from "../extensions/pi-vibehack/tools/expand.ts";

describe("vibehack-start prompt/tool contract", () => {
  it("only instructs vibehack_expand kinds accepted by expandSchema", () => {
    const prompt = readFileSync("prompts/vibehack-start.md", "utf8");

    const allowedKinds = new Set(
      (expandSchema.properties.kind as any).anyOf.map(
        (entry: any) => entry.const,
      ),
    );

    const instructedKinds = [
      ...prompt.matchAll(/kind:\s*"([^"]+)"/g),
    ].map((match) => match[1]);

    expect(instructedKinds.length).toBeGreaterThan(0);

    for (const kind of instructedKinds) {
      expect(
        allowedKinds.has(kind),
        `prompt instructs invalid vibehack_expand kind "${kind}"`,
      ).toBe(true);
    }
  });

  it("uses surface nodes for named attack surfaces", () => {
    const prompt = readFileSync("prompts/vibehack-start.md", "utf8");

    expect(prompt).toContain('use `kind: "surface"`');
    expect(prompt).toContain('using `kind: "hypothesis"`');
    expect(prompt).toContain(
      'The only valid `kind` values are `"root"`, `"surface"`, `"hypothesis"`, and `"leaf"`',
    );
  });
});
