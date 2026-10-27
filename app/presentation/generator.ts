import type {
  PresentationChart,
  PresentationSlide,
  PresentationSource,
  PresentationSpec,
} from "./types";

const COLORS = {
  navy: "15243A",
  blue: "2563EB",
  teal: "0F766E",
  ink: "172033",
  muted: "667085",
  line: "D9E1EA",
  pale: "F3F6FA",
  white: "FFFFFF",
};

const FONT_FACE = "Microsoft YaHei";
const MAX_SLIDES = 20;

function asText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function asTextList(value: unknown, maxItems = 8) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function asSourceList(value: unknown): PresentationSource[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      const title = asText(source.title);
      const url = asText(source.url);
      if (!title || !/^https?:\/\//i.test(url)) return null;
      return { title, url };
    })
    .filter((item): item is PresentationSource => item !== null)
    .slice(0, 16);
}

function normalizeChart(value: unknown): PresentationChart | undefined {
  if (!value || typeof value !== "object") return undefined;
  const chart = value as Record<string, unknown>;
  const rawType = asText(chart.type);
  const type = ["bar", "line", "pie"].includes(rawType)
    ? (rawType as PresentationChart["type"])
    : "bar";
  const categories = asTextList(chart.categories, 12);
  const rawSeries = Array.isArray(chart.series) ? chart.series : [];
  const series = rawSeries
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const name = asText(row.name);
      const values = Array.isArray(row.values)
        ? row.values
            .map((number) => (typeof number === "number" ? number : NaN))
            .filter(Number.isFinite)
            .slice(0, categories.length)
        : [];
      return name && values.length === categories.length
        ? { name, values }
        : null;
    })
    .filter((item): item is { name: string; values: number[] } => item !== null)
    .slice(0, type === "pie" ? 1 : 4);

  if (categories.length === 0 || series.length === 0) return undefined;
  return {
    type,
    categories,
    series,
    valueSuffix: asText(chart.valueSuffix) || undefined,
  };
}

function normalizeSlide(value: unknown, index: number): PresentationSlide {
  if (!value || typeof value !== "object") {
    throw new Error("第 " + (index + 1) + " 页内容无效");
  }
  const slide = value as Record<string, unknown>;
  const layouts = [
    "cover",
    "bullets",
    "two_column",
    "table",
    "chart",
    "summary",
    "sources",
  ];
  const rawLayout = asText(slide.layout);
  const layout = layouts.includes(rawLayout)
    ? (rawLayout as PresentationSlide["layout"])
    : "bullets";
  const title = asText(slide.title, "第 " + (index + 1) + " 页");
  const tableValue = slide.table as Record<string, unknown> | undefined;
  const headers = asTextList(tableValue?.headers, 8);
  const tableRows = tableValue?.rows;
  const rows = Array.isArray(tableRows)
    ? tableRows
        .filter(Array.isArray)
        .map((row) => asTextList(row, headers.length || 8))
        .filter((row) => row.length > 0)
        .slice(0, 12)
    : [];

  return {
    layout,
    title,
    subtitle: asText(slide.subtitle) || undefined,
    bullets: asTextList(slide.bullets),
    leftTitle: asText(slide.leftTitle) || undefined,
    leftBullets: asTextList(slide.leftBullets, 6),
    rightTitle: asText(slide.rightTitle) || undefined,
    rightBullets: asTextList(slide.rightBullets, 6),
    table: headers.length && rows.length ? { headers, rows } : undefined,
    chart: normalizeChart(slide.chart),
    sources: asSourceList(slide.sources),
    sourceUrls: asTextList(slide.sourceUrls, 8).filter((url) =>
      /^https?:\/\//i.test(url),
    ),
  };
}

export function normalizePresentationSpec(value: unknown): PresentationSpec {
  if (!value || typeof value !== "object") {
    throw new Error("PPT 内容不能为空");
  }
  const input = value as Record<string, unknown>;
  const title = asText(input.title);
  if (!title) throw new Error("PPT 标题不能为空");
  if (!Array.isArray(input.slides) || input.slides.length === 0) {
    throw new Error("PPT 至少需要一页");
  }

  return {
    title,
    subtitle: asText(input.subtitle) || undefined,
    author: asText(input.author) || undefined,
    fileName: asText(input.fileName) || undefined,
    slides: input.slides.slice(0, MAX_SLIDES).map(normalizeSlide),
  };
}

export function sanitizePresentationFileName(value: string) {
  const cleaned = value
    .replace(/\.pptx$/i, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return (cleaned || "presentation") + ".pptx";
}

function addSlideChrome(pptx: any, slide: any, title: string, page: number) {
  slide.background = { color: COLORS.white };
  slide.addText(title, {
    x: 0.72,
    y: 0.42,
    w: 11.65,
    h: 0.52,
    fontFace: FONT_FACE,
    fontSize: 25,
    bold: true,
    color: COLORS.ink,
    margin: 0,
    fit: "shrink",
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 0.72,
    y: 1.08,
    w: 11.9,
    h: 0,
    line: { color: COLORS.line, width: 1 },
  });
  slide.addText(String(page), {
    x: 12.15,
    y: 7.02,
    w: 0.42,
    h: 0.2,
    fontFace: FONT_FACE,
    fontSize: 9,
    color: COLORS.muted,
    align: "right",
    margin: 0,
  });
}

function addSourceFooter(slide: any, sourceUrls: string[] = []) {
  if (sourceUrls.length === 0) return;
  const sourceText = sourceUrls
    .map((url) => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return url;
      }
    })
    .join(" · ");
  slide.addText("来源：" + sourceText, {
    x: 0.75,
    y: 6.93,
    w: 10.9,
    h: 0.22,
    fontFace: FONT_FACE,
    fontSize: 8,
    color: COLORS.muted,
    margin: 0,
    fit: "shrink",
  });
  slide.addNotes(sourceUrls.join("\n"));
}

function addBulletList(
  slide: any,
  bullets: string[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const items = bullets.length ? bullets : ["暂无内容"];
  const fontSize = items.length > 6 ? 18 : items.length > 4 ? 20 : 22;
  slide.addText(
    items.map((text, index) => ({
      text,
      options: {
        bullet: { indent: 18 },
        breakLine: index < items.length - 1,
        color: COLORS.ink,
        fontFace: FONT_FACE,
        fontSize,
        paraSpaceAfterPt: 14,
      },
    })),
    {
      x,
      y,
      w,
      h,
      margin: 0.08,
      valign: "top",
      fit: "shrink",
    },
  );
}

function addCover(
  pptx: any,
  slide: any,
  spec: PresentationSpec,
  item: PresentationSlide,
) {
  slide.background = { color: COLORS.navy };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.18,
    h: 7.5,
    line: { color: COLORS.blue, transparency: 100 },
    fill: { color: COLORS.blue },
  });
  slide.addText(item.title || spec.title, {
    x: 0.85,
    y: 2.12,
    w: 10.95,
    h: 1.2,
    fontFace: FONT_FACE,
    fontSize: 34,
    bold: true,
    color: COLORS.white,
    margin: 0,
    fit: "shrink",
  });
  const subtitle = item.subtitle || spec.subtitle;
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.88,
      y: 3.5,
      w: 9.8,
      h: 0.75,
      fontFace: FONT_FACE,
      fontSize: 18,
      color: "D3DCE8",
      margin: 0,
      fit: "shrink",
    });
  }
  const meta = [spec.author, new Date().toLocaleDateString("zh-CN")]
    .filter(Boolean)
    .join(" · ");
  slide.addText(meta, {
    x: 0.88,
    y: 6.55,
    w: 5.5,
    h: 0.3,
    fontFace: FONT_FACE,
    fontSize: 11,
    color: "AAB8C9",
    margin: 0,
  });
}

function addTwoColumn(pptx: any, slide: any, item: PresentationSlide) {
  const columns = [
    {
      x: 0.75,
      title: item.leftTitle || "要点一",
      bullets: item.leftBullets || [],
    },
    {
      x: 6.77,
      title: item.rightTitle || "要点二",
      bullets: item.rightBullets || [],
    },
  ];
  columns.forEach((column, index) => {
    slide.addShape(pptx.ShapeType.rect, {
      x: column.x,
      y: 1.38,
      w: 5.55,
      h: 4.95,
      line: { color: COLORS.line, width: 1 },
      fill: { color: index === 0 ? COLORS.pale : "F6FAF9" },
    });
    slide.addText(column.title, {
      x: column.x + 0.3,
      y: 1.7,
      w: 4.9,
      h: 0.4,
      fontFace: FONT_FACE,
      fontSize: 18,
      bold: true,
      color: index === 0 ? COLORS.blue : COLORS.teal,
      margin: 0,
    });
    addBulletList(slide, column.bullets, column.x + 0.3, 2.25, 4.9, 3.7);
  });
}

function addTable(slide: any, item: PresentationSlide) {
  if (!item.table) {
    addBulletList(slide, item.bullets || [], 0.85, 1.45, 11.55, 4.9);
    return;
  }
  const header = item.table.headers.map((text) => ({
    text,
    options: {
      bold: true,
      color: COLORS.white,
      fill: COLORS.navy,
      align: "center",
    },
  }));
  const rows = [header, ...item.table.rows];
  const columnWidth = 11.7 / item.table.headers.length;
  slide.addTable(rows, {
    x: 0.8,
    y: 1.42,
    w: 11.7,
    colW: item.table.headers.map(() => columnWidth),
    border: { type: "solid", color: COLORS.line, pt: 1 },
    color: COLORS.ink,
    fontFace: FONT_FACE,
    fontSize: rows.length > 9 ? 11 : 13,
    margin: 0.08,
    fill: COLORS.white,
    rowH: 0.42,
    autoFit: false,
    valign: "middle",
  });
}

function addChart(pptx: any, slide: any, chart?: PresentationChart) {
  if (!chart) {
    addBulletList(slide, ["缺少可用于绘图的数据"], 0.85, 1.55, 11.4, 4.8);
    return;
  }
  const chartType =
    chart.type === "line"
      ? pptx.ChartType.line
      : chart.type === "pie"
      ? pptx.ChartType.pie
      : pptx.ChartType.bar;
  const options: Record<string, unknown> = {
    x: 0.85,
    y: 1.38,
    w: 11.55,
    h: 5.18,
    showTitle: false,
    showLegend: chart.type !== "pie" || chart.series.length > 1,
    legendPos: "b",
    showValue: chart.type !== "pie",
    showCategoryName: chart.type === "pie",
    showPercent: chart.type === "pie",
    valGridLine: { color: COLORS.line, width: 1 },
    chartColors: [COLORS.blue, COLORS.teal, "7C3AED", "F59E0B"],
    showSerName: false,
    fontFace: FONT_FACE,
    fontSize: 11,
    border: { color: COLORS.line, pt: 1 },
  };
  if (chart.type === "bar") options.dataLabelPosition = "outEnd";
  if (chart.valueSuffix) {
    const safeSuffix = chart.valueSuffix.replace(/"/g, "");
    options.valAxisLabelFormatCode = '0"' + safeSuffix + '"';
  }
  slide.addChart(
    chartType,
    chart.series.map((series) => ({
      name: series.name,
      labels: chart.categories,
      values: series.values,
    })),
    options,
  );
}

function addSources(slide: any, sources: PresentationSource[]) {
  const displayed = sources.slice(0, 10);
  displayed.forEach((source, index) => {
    const y = 1.38 + index * 0.49;
    slide.addText(String(index + 1) + ". " + source.title, {
      x: 0.82,
      y,
      w: 5.2,
      h: 0.3,
      fontFace: FONT_FACE,
      fontSize: 13,
      bold: true,
      color: COLORS.ink,
      margin: 0,
      fit: "shrink",
    });
    slide.addText(source.url, {
      x: 6.05,
      y,
      w: 6.2,
      h: 0.3,
      fontFace: FONT_FACE,
      fontSize: 10,
      color: COLORS.blue,
      hyperlink: { url: source.url },
      margin: 0,
      fit: "shrink",
    });
  });
  slide.addNotes(displayed.map((source) => source.url).join("\n"));
}

export async function generatePresentation(input: unknown) {
  const spec = normalizePresentationSpec(input);
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx: any = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = spec.author || "NextChat";
  pptx.company = "NextChat";
  pptx.subject = spec.subtitle || spec.title;
  pptx.title = spec.title;
  pptx.lang = "zh-CN";
  pptx.theme = { headFontFace: FONT_FACE, bodyFontFace: FONT_FACE };

  spec.slides.forEach((item, index) => {
    const slide = pptx.addSlide();
    if (item.layout === "cover") {
      addCover(pptx, slide, spec, item);
      return;
    }
    addSlideChrome(pptx, slide, item.title, index + 1);
    switch (item.layout) {
      case "two_column":
        addTwoColumn(pptx, slide, item);
        break;
      case "table":
        addTable(slide, item);
        break;
      case "chart":
        addChart(pptx, slide, item.chart);
        break;
      case "sources":
        addSources(slide, item.sources || []);
        break;
      case "summary":
      case "bullets":
      default:
        addBulletList(slide, item.bullets || [], 0.85, 1.46, 11.45, 4.9);
        break;
    }
    addSourceFooter(slide, item.sourceUrls);
  });

  const fileName = sanitizePresentationFileName(spec.fileName || spec.title);
  await pptx.writeFile({ fileName, compression: true });
  return { fileName, slideCount: spec.slides.length };
}
