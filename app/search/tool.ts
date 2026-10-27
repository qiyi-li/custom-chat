import type { FunctionToolItem } from "../store/plugin";
import { WebSearchRequest } from "./types";

const MAX_SEARCHES_PER_TURN = 3;

export const WEB_SEARCH_TOOL: FunctionToolItem = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the live web. Use Exa for product research, competitor analysis, official product information, and user feedback. Use Tavily for news, recent changes, and quick fact checking. Cite the returned source URLs in the final answer.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A concise search-engine query.",
        },
        provider: {
          type: "string",
          enum: ["auto", "exa", "tavily"],
          description:
            "Search provider. Prefer auto unless a provider is explicitly needed.",
        },
        intent: {
          type: "string",
          enum: [
            "product",
            "competitor",
            "user_feedback",
            "news",
            "latest",
            "fact_check",
            "general",
          ],
          description: "The research intent used for automatic routing.",
        },
        maxResults: {
          type: "integer",
          minimum: 1,
          maximum: 8,
          description: "Number of results to return. Use 5 by default.",
        },
        includeDomains: {
          type: "array",
          items: { type: "string" },
          maxItems: 8,
          description:
            "Optional domains to prioritize or restrict, such as official product sites or reddit.com.",
        },
        excludeDomains: {
          type: "array",
          items: { type: "string" },
          maxItems: 8,
          description: "Optional domains to exclude.",
        },
      },
      required: ["query", "intent"],
      additionalProperties: false,
    },
  },
};

export function createWebSearchFunction(headers: Record<string, string>) {
  let searchCount = 0;

  return async (args: WebSearchRequest) => {
    searchCount += 1;
    if (searchCount > MAX_SEARCHES_PER_TURN) {
      return {
        status: 429,
        statusText: "Search limit reached for this message",
        data: {
          error: true,
          message:
            "A maximum of three web searches is allowed per user message. Use the existing results to answer.",
        },
      };
    }

    const response = await fetch("/api/search", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    const data = await response.json();

    return {
      status: response.status,
      statusText: response.statusText,
      data,
    };
  };
}
