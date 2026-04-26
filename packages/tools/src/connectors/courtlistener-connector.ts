export interface CourtListenerSearchResult {
  caseName: string;
  snippet: string;
  /** Permalink back to courtlistener.com (when known). */
  url?: string;
}

export interface CourtListenerRecapDocument {
  description?: string;
  /** CourtListener viewer URL (free RECAP archive). */
  url: string;
  pageCount?: number;
  isAvailable?: boolean;
}

export interface CourtListenerDocketEntry {
  date: string;
  description: string;
  /** Free RECAP archive documents attached to this entry, when present. */
  documents?: CourtListenerRecapDocument[];
}

export interface CourtListenerPort {
  search(target: string): Promise<{ results: CourtListenerSearchResult[] }>;
  getDocket(
    caseNumber: string,
  ): Promise<{ entries: CourtListenerDocketEntry[] }>;
}
