import { LiveUsptoTrademarkConnector } from "@xiaochengxu/tools";
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

describe("LiveUsptoTrademarkConnector", () => {
  it("interpolates {termEncoded} into the URL and sends Auth header", async () => {
    const fetchImpl = mockFetch({
      marks: [
        { owner: "Apple Inc.", wordmark: "APPLE", status: "LIVE" },
        { owner: "Nike Inc.", mark: "AIR JORDAN", registrationStatus: "live" },
      ],
    });

    const connector = new LiveUsptoTrademarkConnector({
      urlTemplate: "https://proxy.example/search?q={termEncoded}",
      authHeader: "Bearer abc",
      fetchImpl,
    });

    const result = await connector.searchMarks("air jordan");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://proxy.example/search?q=air%20jordan",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer abc",
          Accept: "application/json",
        }),
      }),
    );
    expect(result.marks).toEqual([
      { owner: "Apple Inc.", mark: "APPLE", status: "LIVE" },
      { owner: "Nike Inc.", mark: "AIR JORDAN", status: "LIVE" },
    ]);
  });

  it("accepts array-at-root payloads", async () => {
    const fetchImpl = mockFetch([{ owner: "O", mark: "M", status: "DEAD" }]);
    const connector = new LiveUsptoTrademarkConnector({
      urlTemplate: "https://proxy.example?q={term}",
      fetchImpl,
    });
    const result = await connector.searchMarks("x");
    expect(result.marks).toEqual([{ owner: "O", mark: "M", status: "DEAD" }]);
  });

  it("throws on non-2xx", async () => {
    const fetchImpl = mockFetch({ error: "nope" }, false);
    const connector = new LiveUsptoTrademarkConnector({
      urlTemplate: "https://proxy.example?q={term}",
      fetchImpl,
    });
    await expect(connector.searchMarks("x")).rejects.toThrow(
      /USPTO proxy .+ failed: 500/,
    );
  });

  it("refuses construction without urlTemplate", () => {
    expect(
      () =>
        new LiveUsptoTrademarkConnector({
          urlTemplate: "" as unknown as string,
        }),
    ).toThrow();
  });
});
