/**
 * Optional smoke test against a real USPTO proxy. Runs only when
 * USPTO_LIVE_TEST_URL_TEMPLATE is set — matches the env var name the
 * live connector reads in production.
 *
 * Set it to your proxy URL with the `{term}` / `{termEncoded}` placeholder,
 * e.g.:
 *
 *   USPTO_LIVE_TEST_URL_TEMPLATE=https://your-proxy.example/marks?q={termEncoded} \
 *     USPTO_LIVE_TEST_TERM=nike \
 *     pnpm vitest run tests/tools/uspto-live-smoke.test.ts
 *
 * Without the env, the describe block is skipped so CI stays green.
 */
import { describe, expect, it } from "vitest";
import { LiveUsptoTrademarkConnector } from "../../packages/tools/src/connectors/live-uspto-trademark-connector.js";

const LIVE_URL = process.env.USPTO_LIVE_TEST_URL_TEMPLATE;
const LIVE_TERM = process.env.USPTO_LIVE_TEST_TERM ?? "nike";
const LIVE_AUTH = process.env.USPTO_LIVE_TEST_AUTH_HEADER;

describe.skipIf(!LIVE_URL)(
  "USPTO live connector smoke (requires USPTO_LIVE_TEST_URL_TEMPLATE)",
  () => {
    it("returns an array of marks with recognizable fields", async () => {
      const connector = new LiveUsptoTrademarkConnector({
        urlTemplate: LIVE_URL as string,
        authHeader: LIVE_AUTH,
      });

      const result = await connector.searchMarks(LIVE_TERM);
      expect(result).toHaveProperty("marks");
      expect(Array.isArray(result.marks)).toBe(true);
      // Can't assert specific counts — real world depends on the term.
      // But if anything comes back, at least one recognizable field
      // must be populated on each row.
      for (const mark of result.marks.slice(0, 3)) {
        expect(typeof mark).toBe("object");
        expect(mark.owner || mark.mark).toBeTruthy();
      }
    }, 30_000);
  },
);
