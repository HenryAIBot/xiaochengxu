import {
  EnrichedUsptoConnector,
  LiveUsptoTsdrConnector,
} from "@xiaochengxu/tools";
import { describe, expect, it, vi } from "vitest";

function tsdrXml(opts: { description: string; serial: string }): string {
  return `
<ns:Trademark xmlns:ns="urn:tm:1.0" xmlns:com="urn:com:1.0">
  <ns:ApplicationNumber>
    <com:ApplicationNumberText>${opts.serial}</com:ApplicationNumberText>
  </ns:ApplicationNumber>
  <ns:NationalTrademarkInformation>
    <ns:MarkCurrentStatusExternalDescriptionText>${opts.description}</ns:MarkCurrentStatusExternalDescriptionText>
  </ns:NationalTrademarkInformation>
</ns:Trademark>`;
}

function fetchReturning(map: Record<string, string>) {
  return vi.fn(async (url: string | URL) => {
    const u = url.toString();
    const xml = map[u];
    if (!xml) {
      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "",
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => xml,
    } as Response;
  }) as unknown as typeof fetch;
}

describe("EnrichedUsptoConnector", () => {
  it("overrides the base mark status when TSDR disagrees", async () => {
    const base = {
      async searchMarks() {
        return {
          marks: [
            {
              owner: "Stale Index Co.",
              mark: "GHOST",
              status: "LIVE",
              url: "https://tsdr.uspto.gov/#caseNumber=12345678&caseType=SERIAL_NO&searchType=statusSearch",
            },
          ],
        };
      },
    };
    const fetchImpl = fetchReturning({
      "https://tsdr.uspto.gov/ts/cd/casestatus/sn12345678/info.xml": tsdrXml({
        serial: "12345678",
        description: "Abandoned due to non-response.",
      }),
    });
    const tsdr = new LiveUsptoTsdrConnector({ fetchImpl });
    const enriched = new EnrichedUsptoConnector(base, tsdr);

    const result = await enriched.searchMarks("ghost");
    expect(result.marks[0].status).toBe("DEAD");
  });

  it("keeps the base status when TSDR agrees or returns UNKNOWN", async () => {
    const base = {
      async searchMarks() {
        return {
          marks: [
            {
              owner: "Nike, Inc.",
              mark: "NIKE",
              status: "LIVE",
              url: "https://tsdr.uspto.gov/#caseNumber=73379389&caseType=SERIAL_NO&searchType=statusSearch",
            },
          ],
        };
      },
    };
    const fetchImpl = fetchReturning({
      "https://tsdr.uspto.gov/ts/cd/casestatus/sn73379389/info.xml": tsdrXml({
        serial: "73379389",
        description: "Registered. Renewal due 2030.",
      }),
    });
    const tsdr = new LiveUsptoTsdrConnector({ fetchImpl });
    const enriched = new EnrichedUsptoConnector(base, tsdr);
    const result = await enriched.searchMarks("nike");
    expect(result.marks[0].status).toBe("LIVE");
  });

  it("swallows TSDR fetch errors and returns the base result intact", async () => {
    const base = {
      async searchMarks() {
        return {
          marks: [
            {
              owner: "Acme",
              mark: "ACME",
              status: "LIVE",
              url: "https://tsdr.uspto.gov/#caseNumber=11111111&caseType=SERIAL_NO&searchType=statusSearch",
            },
          ],
        };
      },
    };
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const tsdr = new LiveUsptoTsdrConnector({ fetchImpl });
    const enriched = new EnrichedUsptoConnector(base, tsdr);
    const result = await enriched.searchMarks("acme");
    expect(result.marks[0].status).toBe("LIVE");
  });

  it("skips marks with no extractable serial number", async () => {
    const base = {
      async searchMarks() {
        return {
          marks: [
            {
              owner: "No URL Co",
              mark: "NOURL",
              status: "LIVE",
              // no url field
            },
          ],
        };
      },
    };
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const tsdr = new LiveUsptoTsdrConnector({ fetchImpl });
    const enriched = new EnrichedUsptoConnector(base, tsdr);
    const result = await enriched.searchMarks("no url");
    expect(result.marks[0].status).toBe("LIVE");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
