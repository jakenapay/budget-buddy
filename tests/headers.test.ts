import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS } from "../security-headers";
import vercelJson from "../vercel.json";

interface VercelConfig {
  headers: { source: string; headers: { key: string; value: string }[] }[];
}

describe("vercel.json", () => {
  it("serves exactly the headers in security-headers.ts on every path", () => {
    const config: VercelConfig = vercelJson;
    const all = config.headers.find((h) => h.source === "/(.*)");
    expect(all).toBeDefined();
    const served = Object.fromEntries((all?.headers ?? []).map((h) => [h.key, h.value]));
    expect(served).toEqual(SECURITY_HEADERS);
  });

  it("allows no external sources", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"] ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toMatch(/https?:|\*|unsafe-inline|unsafe-eval|data:|blob:/);
  });
});
