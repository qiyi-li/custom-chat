import {
  chooseSearchProvider,
  normalizeDomains,
  normalizeSearchRequest,
  requestWithKeyFallback,
  SearchPlanExhaustedError,
} from "../app/search/server";

describe("web search routing", () => {
  const mockResponse = (body: string, status: number) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
    }) as Response;

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

  test("uses the backup key after the primary quota is exhausted", async () => {
    const keys: string[] = [];
    const response = await requestWithKeyFallback(
      "exa",
      ["primary", "backup"],
      async (key) => {
        keys.push(key);
        return key === "primary"
          ? mockResponse("insufficient credits", 402)
          : mockResponse(JSON.stringify({ results: [] }), 200);
      },
    );
    expect(response.ok).toBe(true);
    expect(keys).toEqual(["primary", "backup"]);
  });

  test("reports plan exhaustion after all keys are exhausted", async () => {
    await expect(
      requestWithKeyFallback("tavily", ["primary", "backup"], async () =>
        mockResponse("usage limit exceeded", 429),
      ),
    ).rejects.toBeInstanceOf(SearchPlanExhaustedError);
  });

  test("does not rotate keys for ordinary request errors", async () => {
    const keys: string[] = [];
    await expect(
      requestWithKeyFallback("exa", ["primary", "backup"], async (key) => {
        keys.push(key);
        return mockResponse("invalid request", 400);
      }),
    ).rejects.toThrow("invalid request");
    expect(keys).toEqual(["primary"]);
  });
});
