export interface CourtListenerSearchResult {
  caseName: string;
  snippet: string;
}

export interface CourtListenerDocketEntry {
  date: string;
  description: string;
}

export interface CourtListenerPort {
  search(target: string): Promise<{ results: CourtListenerSearchResult[] }>;
  getDocket(
    caseNumber: string,
  ): Promise<{ entries: CourtListenerDocketEntry[] }>;
}
