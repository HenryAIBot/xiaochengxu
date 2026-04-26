import { LiveCourtListenerConnector } from "@xiaochengxu/tools";
import { describe, expect, it, vi } from "vitest";

function mockFetch(
  handlers: Array<
    (url: string) => { ok: boolean; status?: number; body: unknown }
  >,
) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string | URL) => {
    const u = url.toString();
    calls.push(u);
    const handler = handlers.shift();
    if (!handler) throw new Error(`unexpected fetch ${u}`);
    const result = handler(u);
    return {
      ok: result.ok,
      status: result.status ?? 200,
      statusText: result.ok ? "OK" : "Error",
      json: async () => result.body,
      text: async () => JSON.stringify(result.body),
    } as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("LiveCourtListenerConnector", () => {
  it("calls v4 search endpoint with Authorization token and maps results", async () => {
    const { fetchImpl, calls } = mockFetch([
      () => ({
        ok: true,
        body: {
          count: 2,
          results: [
            {
              caseName: "Nike Inc v. Doe",
              snippet: "Temporary restraining order granted.",
              docketNumber: "2:24-cv-03721",
            },
            {
              case_name: "Nike v. Unknown Sellers",
              snippet: "Complaint filed.",
            },
          ],
        },
      }),
    ]);

    const connector = new LiveCourtListenerConnector({
      token: "my-token",
      baseUrl: "https://example.test",
      fetchImpl,
    });

    const result = await connector.search("nike");

    expect(calls[0]).toBe(
      "https://example.test/api/rest/v4/search/?q=nike&type=r&order_by=dateFiled+desc",
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.test/api/rest/v4/search/?q=nike&type=r&order_by=dateFiled+desc",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Token my-token",
          Accept: "application/json",
        }),
      }),
    );
    expect(result.results).toEqual([
      {
        caseName: "Nike Inc v. Doe",
        snippet: "Temporary restraining order granted.",
      },
      {
        caseName: "Nike v. Unknown Sellers",
        snippet: "Complaint filed.",
      },
    ]);
  });

  it("fetches docket entries and normalizes date + description", async () => {
    const { fetchImpl } = mockFetch([
      () => ({
        ok: true,
        body: {
          results: [
            {
              date_filed: "2026-04-18",
              description: "Temporary restraining order entered.",
            },
            {
              dateFiled: "2026-04-16",
              description: "Motion for TRO filed.",
            },
          ],
        },
      }),
    ]);

    const connector = new LiveCourtListenerConnector({
      token: "my-token",
      baseUrl: "https://example.test",
      fetchImpl,
    });

    const result = await connector.getDocket("2:24-cv-03721");
    expect(result.entries).toEqual([
      {
        date: "2026-04-18",
        description: "Temporary restraining order entered.",
      },
      {
        date: "2026-04-16",
        description: "Motion for TRO filed.",
      },
    ]);
  });

  it("throws when the API returns non-2xx", async () => {
    const { fetchImpl } = mockFetch([
      () => ({ ok: false, status: 500, body: { detail: "boom" } }),
    ]);

    const connector = new LiveCourtListenerConnector({
      token: "t",
      fetchImpl,
    });

    await expect(connector.search("nike")).rejects.toThrow(
      /CourtListener .+ failed: 500/,
    );
  });

  it("drops entries with missing date or description", async () => {
    const { fetchImpl } = mockFetch([
      () => ({
        ok: true,
        body: {
          results: [
            { date_filed: "2026-04-18" }, // no description
            { description: "x" }, // no date
            { date_filed: "2026-04-10", description: "Case assigned" },
          ],
        },
      }),
    ]);
    const connector = new LiveCourtListenerConnector({
      token: "t",
      fetchImpl,
    });
    const result = await connector.getDocket("1:25-cv-01234");
    expect(result.entries).toEqual([
      { date: "2026-04-10", description: "Case assigned" },
    ]);
  });

  it("refuses construction without a token", () => {
    expect(
      () => new LiveCourtListenerConnector({ token: "" as unknown as string }),
    ).toThrow();
  });

  it("maps recap_documents into absolute viewer URLs on each entry", async () => {
    const { fetchImpl } = mockFetch([
      () => ({
        ok: true,
        body: {
          results: [
            {
              date_filed: "2026-04-18",
              description: "Temporary restraining order entered.",
              recap_documents: [
                {
                  description: "TRO Order",
                  absolute_url: "/recap/gov.uscourts.cand.123/15/0/?download=1",
                  page_count: 8,
                  is_available: true,
                },
                {
                  description: "Exhibit A",
                  filepath_ia: "https://archive.org/download/x/exhibit-a.pdf",
                  is_available: false,
                },
              ],
            },
          ],
        },
      }),
    ]);

    const connector = new LiveCourtListenerConnector({
      token: "t",
      baseUrl: "https://example.test",
      fetchImpl,
    });

    const result = await connector.getDocket("2:24-cv-03721");
    expect(result.entries).toEqual([
      {
        date: "2026-04-18",
        description: "Temporary restraining order entered.",
        documents: [
          {
            description: "TRO Order",
            url: "https://example.test/recap/gov.uscourts.cand.123/15/0/?download=1",
            pageCount: 8,
            isAvailable: true,
          },
          {
            description: "Exhibit A",
            url: "https://archive.org/download/x/exhibit-a.pdf",
            isAvailable: false,
          },
        ],
      },
    ]);
  });
});
