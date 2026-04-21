export interface TrademarkSearchMark {
  owner: string;
  mark: string;
  status: string;
}

export class UsptoTrademarkConnector {
  constructor(
    private readonly fetchMarks: (
      term: string,
    ) => Promise<{ marks: TrademarkSearchMark[] }>,
  ) {}

  async searchMarks(term: string) {
    return this.fetchMarks(term);
  }
}
