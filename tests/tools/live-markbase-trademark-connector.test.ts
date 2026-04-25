import { LiveMarkbaseTrademarkConnector } from "@xiaochengxu/tools";
import { describe, expect, it, vi } from "vitest";

function mockFetch(body: unknown, ok = true) {
  const fetchImpl = vi.fn(async () => {
    return {
      ok,
      status: ok ? 200 : 500,
      statusText: ok ? "OK" : "Error",
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  }) as unknown as typeof fetch;
  return fetchImpl;
}

describe("LiveMarkbaseTrademarkConnector", () => {
  it("queries registered live status codes and maps hits to trademark marks", async () => {
    const fetchImpl = mockFetch({
      hits: [
        {
          serial_number: "98029846",
          word_mark: "Nike",
          owner_name: "Nike, Inc.",
          status_code: "700",
        },
      ],
    });
    const connector = new LiveMarkbaseTrademarkConnector({
      baseUrl: "https://markbase.example",
      fetchImpl,
      maxResults: 3,
    });

    const result = await connector.searchMarks("nike");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://markbase.example/search?q=nike&limit=3&status_code=700",
      expect.objectContaining({
        headers: { Accept: "application/json" },
      }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://markbase.example/search?q=nike&limit=3&status_code=800",
      expect.anything(),
    );
    expect(result.marks).toEqual([
      {
        owner: "Nike, Inc.",
        mark: "NIKE",
        status: "LIVE",
        url: "https://tsdr.uspto.gov/#caseNumber=98029846&caseType=SERIAL_NO&searchType=statusSearch",
      },
    ]);
  });

  it("deduplicates the same serial number across status batches", async () => {
    const fetchImpl = mockFetch({
      hits: [
        {
          serial_number: "123",
          word_mark: "ACME",
          owner_name: "Acme Inc.",
          status_code: "800",
        },
      ],
    });
    const connector = new LiveMarkbaseTrademarkConnector({
      fetchImpl,
      statusCodes: ["700", "800"],
    });

    const result = await connector.searchMarks("acme");

    expect(result.marks).toHaveLength(1);
  });

  it("throws on non-2xx responses", async () => {
    const fetchImpl = mockFetch({ error: "nope" }, false);
    const connector = new LiveMarkbaseTrademarkConnector({ fetchImpl });

    await expect(connector.searchMarks("nike")).rejects.toThrow(
      /Markbase trademark search failed: 500/,
    );
  });
});
