export type SearchProvider = "auto" | "exa" | "tavily";

export type SearchIntent =
  | "product"
  | "competitor"
  | "user_feedback"
  | "news"
  | "latest"
  | "fact_check"
  | "general";

export type WebSearchRequest = {
  query: string;
  provider?: SearchProvider;
  intent?: SearchIntent;
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
};

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
};

export type WebSearchResponse = {
  query: string;
  provider: Exclude<SearchProvider, "auto">;
  results: WebSearchResult[];
};
