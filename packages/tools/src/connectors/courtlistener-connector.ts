export interface CourtListenerSearchResult {
  caseName: string;
  snippet: string;
  /** Permalink back to courtlistener.com (when known). */
  url?: string;
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
