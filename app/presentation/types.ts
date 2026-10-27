export type PresentationLayout =
  | "cover"
  | "bullets"
  | "two_column"
  | "table"
  | "chart"
  | "summary"
  | "sources";

export type PresentationChart = {
  type: "bar" | "line" | "pie";
  categories: string[];
  series: Array<{ name: string; values: number[] }>;
  valueSuffix?: string;
};

export type PresentationTable = {
  headers: string[];
  rows: string[][];
};

export type PresentationSource = {
  title: string;
  url: string;
};

export type PresentationSlide = {
  layout: PresentationLayout;
  title: string;
  subtitle?: string;
  bullets?: string[];
  leftTitle?: string;
  leftBullets?: string[];
  rightTitle?: string;
  rightBullets?: string[];
  table?: PresentationTable;
  chart?: PresentationChart;
  sources?: PresentationSource[];
  sourceUrls?: string[];
};

export type PresentationSpec = {
  title: string;
  subtitle?: string;
  author?: string;
  fileName?: string;
  slides: PresentationSlide[];
};
