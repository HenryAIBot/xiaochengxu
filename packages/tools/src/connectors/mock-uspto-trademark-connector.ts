const MOCK_MARKS: Record<
  string,
  Array<{ owner: string; mark: string; status: string }>
> = {
  nike: [
    { owner: "Nike, Inc.", mark: "NIKE", status: "LIVE" },
    { owner: "Nike, Inc.", mark: "JUST DO IT", status: "LIVE" },
    { owner: "Nike, Inc.", mark: "SWOOSH DESIGN", status: "LIVE" },
  ],
  adidas: [
    { owner: "adidas AG", mark: "ADIDAS", status: "LIVE" },
    { owner: "adidas AG", mark: "THREE STRIPE DESIGN", status: "LIVE" },
  ],
  new_balance: [
    {
      owner: "New Balance Athletics, Inc.",
      mark: "NEW BALANCE",
      status: "LIVE",
    },
    { owner: "New Balance Athletics, Inc.", mark: "NB", status: "LIVE" },
  ],
};

export class MockUsptoTrademarkConnector {
  async searchMarks(term: string) {
    const key = term.toLowerCase().replace(/[\s-]+/g, "_");
    const marks = MOCK_MARKS[key] ?? [
      {
        owner: `${term.toUpperCase()} Holdings LLC`,
        mark: term.toUpperCase(),
        status: "DEAD",
      },
    ];
    return { marks };
  }
}
