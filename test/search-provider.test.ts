import {
  chooseSearchProvider,
  normalizeDomains,
  normalizeSearchRequest,
} from "../app/search/server";

describe("web search routing", () => {
  test("routes product research to Exa", () => {
    const request = normalizeSearchRequest({
      query: "Notion Calendar user feedback",
      intent: "user_feedback",
    });
    expect(chooseSearchProvider(request, true, true)).toBe("exa");
  });

  test("routes news and fact checks to Tavily", () => {
    const request = normalizeSearchRequest({
      query: "latest Figma product update",
      intent: "latest",
    });
    expect(chooseSearchProvider(request, true, true)).toBe("tavily");
  });

  test("respects an explicitly selected provider", () => {
    const request = normalizeSearchRequest({
      query: "Figma pricing",
      intent: "product",
      provider: "tavily",
    });
    expect(chooseSearchProvider(request, true, true)).toBe("tavily");
  });

  test("clamps results and sanitizes domain filters", () => {
    const request = normalizeSearchRequest({
      query: "  product research  ",
      intent: "product",
      maxResults: 100,
      includeDomains: ["Reddit.com", "https://invalid.example/path"],
    });
    expect(request.query).toBe("product research");
    expect(request.maxResults).toBe(8);
    expect(request.includeDomains).toEqual(["reddit.com"]);
    expect(normalizeDomains(["Example.COM"])).toEqual(["example.com"]);
  });
});
