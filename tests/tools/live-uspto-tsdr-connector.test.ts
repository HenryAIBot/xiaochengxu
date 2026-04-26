import { LiveUsptoTsdrConnector } from "@xiaochengxu/tools";
import { describe, expect, it, vi } from "vitest";

const SAMPLE_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<ns:Trademark xmlns:ns="urn:tm:1.0" xmlns:com="urn:com:1.0">
  <ns:ApplicationNumber>
    <com:ApplicationNumberText>73379389</com:ApplicationNumberText>
  </ns:ApplicationNumber>
  <ns:MarkRepresentation>
    <ns:WordMarkSpecification>
      <ns:MarkVerbalElementText>NIKE</ns:MarkVerbalElementText>
    </ns:WordMarkSpecification>
  </ns:MarkRepresentation>
  <ns:CaseOwners>
    <ns:CaseOwner>
      <ns:PartyName>
        <com:OrganizationName>
          <com:OrganizationStandardName>Nike, Inc.</com:OrganizationStandardName>
        </com:OrganizationName>
      </ns:PartyName>
    </ns:CaseOwner>
  </ns:CaseOwners>
  <ns:NationalTrademarkInformation>
    <ns:MarkCurrentStatusExternalDescriptionText>Registered. The registration date is used for renewal purposes.</ns:MarkCurrentStatusExternalDescriptionText>
    <ns:MarkCurrentStatusDate>2026-04-15</ns:MarkCurrentStatusDate>
  </ns:NationalTrademarkInformation>
</ns:Trademark>
`.trim();

function fakeFetch(handler: (url: string) => Partial<Response>) {
  return vi.fn(async (url: string | URL) => {
    const u = url.toString();
    const r = handler(u);
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      statusText: r.statusText ?? "OK",
      text: async () => (typeof r.text === "function" ? await r.text() : ""),
    } as Response;
  }) as unknown as typeof fetch;
}

describe("LiveUsptoTsdrConnector", () => {
  it("fetches the public TSDR XML and parses owner / mark / status / date", async () => {
    const fetchImpl = fakeFetch((url) => {
      expect(url).toBe(
        "https://tsdr.uspto.gov/ts/cd/casestatus/sn73379389/info.xml",
      );
      return { ok: true, text: async () => SAMPLE_XML };
    });
    const tsdr = new LiveUsptoTsdrConnector({ fetchImpl });
    const status = await tsdr.getStatusBySerial("73379389");
    expect(status).toEqual({
      serialNumber: "73379389",
      mark: "NIKE",
      owner: "Nike, Inc.",
      statusCategory: "LIVE",
      statusDescription:
        "Registered. The registration date is used for renewal purposes.",
      statusDate: "2026-04-15",
      detailUrl:
        "https://tsdr.uspto.gov/#caseNumber=73379389&caseType=SERIAL_NO&searchType=statusSearch",
    });
  });

  it("returns null on 404 (unknown serial)", async () => {
    const fetchImpl = fakeFetch(() => ({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "",
    }));
    const tsdr = new LiveUsptoTsdrConnector({ fetchImpl });
    expect(await tsdr.getStatusBySerial("99999999")).toBeNull();
  });

  it("returns null when serial number format is invalid (no fetch)", async () => {
    const fetchImpl = vi.fn();
    const tsdr = new LiveUsptoTsdrConnector({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(await tsdr.getStatusBySerial("abc")).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("classifies abandoned descriptions as DEAD", async () => {
    const xml = SAMPLE_XML.replace(
      "Registered. The registration date is used for renewal purposes.",
      "Abandoned because no Statement of Use was filed.",
    );
    const fetchImpl = fakeFetch(() => ({ ok: true, text: async () => xml }));
    const tsdr = new LiveUsptoTsdrConnector({ fetchImpl });
    const status = await tsdr.getStatusBySerial("73379389");
    expect(status?.statusCategory).toBe("DEAD");
  });

  it("propagates 5xx errors so callers can swallow or log", async () => {
    const fetchImpl = fakeFetch(() => ({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "",
    }));
    const tsdr = new LiveUsptoTsdrConnector({ fetchImpl });
    await expect(tsdr.getStatusBySerial("73379389")).rejects.toThrow(
      /USPTO TSDR/,
    );
  });
});
