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

  it("allows no external sources except the opt-in exchange-rate API", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"] ?? "";
    const directives = Object.fromEntries(
      csp.split(";").map((d) => {
        const [name = "", ...values] = d.trim().split(/\s+/);
        return [name, values];
      }),
    );
    expect(directives["default-src"]).toEqual(["'self'"]);
    expect(directives["connect-src"]).toEqual(["'self'", "https://open.er-api.com"]);
    const withoutConnect = csp.replace(/connect-src[^;]*/, "");
    expect(withoutConnect).not.toMatch(/https?:|\*|unsafe-inline|unsafe-eval|data:|blob:/);
    expect(directives["connect-src"]?.join(" ")).not.toMatch(/\*|data:|blob:/);
  });
});
