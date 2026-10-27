import {
  normalizePresentationSpec,
  sanitizePresentationFileName,
} from "../app/presentation/generator";

describe("presentation generator", () => {
  test("normalizes a supported editable presentation", () => {
    const spec = normalizePresentationSpec({
      title: "用户研究",
      slides: [
        { layout: "cover", title: "用户研究" },
        {
          layout: "chart",
          title: "调研结果",
          chart: {
            type: "bar",
            categories: ["A", "B"],
            series: [{ name: "用户数", values: [10, 20] }],
          },
          sourceUrls: ["https://example.com/report"],
        },
      ],
    });

    expect(spec.slides).toHaveLength(2);
    expect(spec.slides[1].chart?.series[0].values).toEqual([10, 20]);
    expect(spec.slides[1].sourceUrls).toEqual(["https://example.com/report"]);
  });

  test("rejects an empty presentation", () => {
    expect(() =>
      normalizePresentationSpec({ title: "空", slides: [] }),
    ).toThrow("PPT 至少需要一页");
  });

  test("drops malformed chart series instead of inventing values", () => {
    const spec = normalizePresentationSpec({
      title: "数据",
      slides: [
        {
          layout: "chart",
          title: "图表",
          chart: {
            type: "line",
            categories: ["一月", "二月"],
            series: [{ name: "趋势", values: [1] }],
          },
        },
      ],
    });
    expect(spec.slides[0].chart).toBeUndefined();
  });

  test("sanitizes PowerPoint file names", () => {
    expect(sanitizePresentationFileName("产品/研究:第一版.pptx")).toBe(
      "产品-研究-第一版.pptx",
    );
  });
});
