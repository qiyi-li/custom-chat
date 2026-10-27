import {
  SearchIntent,
  WebSearchRequest,
  WebSearchResponse,
  WebSearchResult,
} from "./types";

const PRODUCT_RESEARCH_INTENTS = new Set<SearchIntent>([
  "product",
  "competitor",
  "user_feedback",
]);

export function normalizeDomains(domains?: string[]) {
  return (domains ?? [])
    .slice(0, 8)
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => /^[a-z0-9.-]+$/.test(domain));
}

export function normalizeSearchRequest(
  input: WebSearchRequest,
): Required<
  Pick<WebSearchRequest, "query" | "provider" | "intent" | "maxResults">
> &
  Pick<WebSearchRequest, "includeDomains" | "excludeDomains"> {
  const query = input.query?.trim().slice(0, 500);
  if (!query) throw new Error("Search query is required");

  return {
    query,
    provider: input.provider ?? "auto",
    intent: input.intent ?? "general",
    maxResults: Math.min(Math.max(input.maxResults ?? 5, 1), 8),
    includeDomains: normalizeDomains(input.includeDomains),
    excludeDomains: normalizeDomains(input.excludeDomains),
  };
}

export function chooseSearchProvider(
  request: ReturnType<typeof normalizeSearchRequest>,
  hasExa: boolean,
  hasTavily: boolean,
) {
  if (request.provider !== "auto") return request.provider;
  if (PRODUCT_RESEARCH_INTENTS.has(request.intent) && hasExa) return "exa";
  if (hasTavily) return "tavily";
  if (hasExa) return "exa";
  throw new Error("No search provider is configured");
}

async function searchExa(
  request: ReturnType<typeof normalizeSearchRequest>,
  apiKey: string,
): Promise<WebSearchResult[]> {
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query: request.query,
      type: "auto",
      numResults: request.maxResults,
      includeDomains: request.includeDomains,
      excludeDomains: request.excludeDomains,
      contents: {
        highlights: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Exa search failed (${response.status}): ${await response.text()}`,
    );
  }

  const data = await response.json();
  return (data.results ?? []).map((result: any) => ({
    title: result.title || result.url,
    url: result.url,
    snippet: result.highlights?.filter(Boolean).join("\n") || result.text || "",
    publishedAt: result.publishedDate,
  }));
}

async function searchTavily(
  request: ReturnType<typeof normalizeSearchRequest>,
  apiKey: string,
): Promise<WebSearchResult[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: request.query,
      topic: request.intent === "news" ? "news" : "general",
      search_depth: "basic",
      max_results: request.maxResults,
      include_domains: request.includeDomains,
      exclude_domains: request.excludeDomains,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Tavily search failed (${response.status}): ${await response.text()}`,
    );
  }

  const data = await response.json();
  return (data.results ?? []).map((result: any) => ({
    title: result.title || result.url,
    url: result.url,
    snippet: result.content || "",
    publishedAt: result.published_date,
  }));
}

export async function webSearch(
  input: WebSearchRequest,
  keys: { exaApiKey?: string; tavilyApiKey?: string },
): Promise<WebSearchResponse> {
  const request = normalizeSearchRequest(input);
  const provider = chooseSearchProvider(
    request,
    !!keys.exaApiKey,
    !!keys.tavilyApiKey,
  );
  if (provider === "exa" && !keys.exaApiKey) {
    throw new Error("Exa search is not configured");
  }
  if (provider === "tavily" && !keys.tavilyApiKey) {
    throw new Error("Tavily search is not configured");
  }

  const results =
    provider === "exa"
      ? await searchExa(request, keys.exaApiKey as string)
      : await searchTavily(request, keys.tavilyApiKey as string);

  return { query: request.query, provider, results };
}
