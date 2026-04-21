import type { CourtListenerPort } from "./courtlistener-connector.js";

const MOCK_CASES: Record<
  string,
  Array<{ caseName: string; snippet: string }>
> = {
  nike: [
    {
      caseName: "Nike Inc v. Online Sellers Group",
      snippet:
        "Motion for temporary restraining order filed against marketplace sellers selling counterfeit athletic footwear.",
    },
    {
      caseName: "Nike Inc v. ABC Trading Co",
      snippet:
        "Defendants charged with trademark infringement and false designation of origin for unauthorized Nike-branded products.",
    },
    {
      caseName: "Nike Inc v. XYZ E-commerce LLC",
      snippet:
        "Preliminary injunction hearing scheduled. Plaintiff alleges defendants sold counterfeit sneakers through Amazon storefront.",
    },
  ],
  adidas: [
    {
      caseName: "Adidas AG v. Speed Trade Inc",
      snippet:
        "Temporary restraining order granted against defendants selling counterfeit Adidas three-stripe merchandise.",
    },
    {
      caseName: "Adidas AG v. Global Kicks LLC",
      snippet:
        "Court finds likelihood of confusion between defendants' products and registered Adidas trademarks.",
    },
  ],
  new_balance: [
    {
      caseName: "New Balance Athletics v. Discount Shoes Online",
      snippet:
        "Trademark infringement complaint filed. Defendants allegedly sold knockoff NB 574 sneakers.",
    },
  ],
};

const MOCK_DOCKET_ENTRIES: Record<
  string,
  Array<{ date: string; description: string }>
> = {
  default: [
    {
      date: "2026-04-18",
      description: "Temporary restraining order entered against defendants.",
    },
    {
      date: "2026-04-15",
      description: "Motion for temporary restraining order filed by plaintiff.",
    },
    {
      date: "2026-04-12",
      description:
        "Complaint filed. Plaintiff alleges trademark infringement and counterfeiting.",
    },
    {
      date: "2026-04-10",
      description: "Case assigned to Judge Sarah Mitchell.",
    },
    { date: "2026-04-08", description: "Summons issued to defendants." },
  ],
};

export class MockCourtListenerConnector implements CourtListenerPort {
  async search(target: string) {
    const key = target.toLowerCase().replace(/[\s-]+/g, "_");
    const results = MOCK_CASES[key] ?? [
      {
        caseName: `Brand Protection LLC v. Unknown ${target} Sellers`,
        snippet: `Complaint filed regarding unauthorized sale of ${target}-related products on Amazon marketplace. No TRO motion detected yet.`,
      },
    ];
    return { results };
  }

  async getDocket(caseNumber: string) {
    return { entries: MOCK_DOCKET_ENTRIES.default };
  }
}
