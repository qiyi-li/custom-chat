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

export class SearchPlanExhaustedError extends Error {
  constructor(provider: "exa" | "tavily") {
    super(
      `${
        provider === "exa" ? "Exa" : "Tavily"
      } 搜索套餐已用尽，请补充或更换搜索 API Key。`,
    );
    this.name = "SearchPlanExhaustedError";
  }
}

function isQuotaExhausted(status: number, body: string) {
  if ([402, 429].includes(status)) return true;
  const normalized = body.toLowerCase();
  return [
    "credit",
    "quota",
    "usage limit",
    "plan limit",
    "rate limit",
    "too many requests",
    "exhausted",
    "insufficient balance",
  ].some((keyword) => normalized.includes(keyword));
}

export async function requestWithKeyFallback(
  provider: "exa" | "tavily",
  apiKeys: string[],
  request: (apiKey: string) => Promise<Response>,
) {
  let lastError = "";
  let exhaustedKeyCount = 0;

  for (const apiKey of apiKeys) {
    const response = await request(apiKey);
    if (response.ok) return response;

    const body = await response.text();
    lastError = `${provider} search failed (${response.status}): ${body}`;
    if (!isQuotaExhausted(response.status, body)) {
      throw new Error(lastError);
    }
    exhaustedKeyCount += 1;
  }

  if (exhaustedKeyCount === apiKeys.length) {
    throw new SearchPlanExhaustedError(provider);
  }
  throw new Error(lastError || `${provider} search failed`);
}

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
  apiKeys: string[],
): Promise<WebSearchResult[]> {
  const response = await requestWithKeyFallback("exa", apiKeys, (apiKey) =>
    fetch("https://api.exa.ai/search", {
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
    }),
  );

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
  apiKeys: string[],
): Promise<WebSearchResult[]> {
  const response = await requestWithKeyFallback("tavily", apiKeys, (apiKey) =>
    fetch("https://api.tavily.com/search", {
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
    }),
  );

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
  keys: { exaApiKeys?: string[]; tavilyApiKeys?: string[] },
): Promise<WebSearchResponse> {
  const exaApiKeys = keys.exaApiKeys ?? [];
  const tavilyApiKeys = keys.tavilyApiKeys ?? [];
  const request = normalizeSearchRequest(input);
  const provider = chooseSearchProvider(
    request,
    exaApiKeys.length > 0,
    tavilyApiKeys.length > 0,
  );
  if (provider === "exa" && exaApiKeys.length === 0) {
    throw new Error("Exa search is not configured");
  }
  if (provider === "tavily" && tavilyApiKeys.length === 0) {
    throw new Error("Tavily search is not configured");
  }

  const results =
    provider === "exa"
      ? await searchExa(request, exaApiKeys)
      : await searchTavily(request, tavilyApiKeys);

  return { query: request.query, provider, results };
}
