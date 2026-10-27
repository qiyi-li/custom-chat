import type { FunctionToolItem } from "../store/plugin";
import { generatePresentation } from "./generator";

export const CREATE_PRESENTATION_TOOL: FunctionToolItem = {
  type: "function",
  function: {
    name: "create_presentation",
    description:
      "Create and download an editable PowerPoint .pptx file in the user's browser. Use native PowerPoint text, tables, and charts. Call this when the user asks to create, export, or download a PPT or slide deck.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", maxLength: 100 },
        subtitle: { type: "string", maxLength: 180 },
        author: { type: "string", maxLength: 80 },
        fileName: { type: "string", maxLength: 80 },
        slides: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: {
            type: "object",
            properties: {
              layout: {
                type: "string",
                enum: [
                  "cover",
                  "bullets",
                  "two_column",
                  "table",
                  "chart",
                  "summary",
                  "sources",
                ],
              },
              title: { type: "string", maxLength: 100 },
              subtitle: { type: "string", maxLength: 180 },
              bullets: {
                type: "array",
                maxItems: 8,
                items: { type: "string", maxLength: 180 },
              },
              leftTitle: { type: "string", maxLength: 60 },
              leftBullets: {
                type: "array",
                maxItems: 6,
                items: { type: "string", maxLength: 160 },
              },
              rightTitle: { type: "string", maxLength: 60 },
              rightBullets: {
                type: "array",
                maxItems: 6,
                items: { type: "string", maxLength: 160 },
              },
              table: {
                type: "object",
                properties: {
                  headers: {
                    type: "array",
                    maxItems: 8,
                    items: { type: "string", maxLength: 60 },
                  },
                  rows: {
                    type: "array",
                    maxItems: 12,
                    items: {
                      type: "array",
                      maxItems: 8,
                      items: { type: "string", maxLength: 100 },
                    },
                  },
                },
                required: ["headers", "rows"],
                additionalProperties: false,
              },
              chart: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["bar", "line", "pie"] },
                  categories: {
                    type: "array",
                    maxItems: 12,
                    items: { type: "string", maxLength: 50 },
                  },
                  series: {
                    type: "array",
                    maxItems: 4,
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", maxLength: 50 },
                        values: {
                          type: "array",
                          maxItems: 12,
                          items: { type: "number" },
                        },
                      },
                      required: ["name", "values"],
                      additionalProperties: false,
                    },
                  },
                  valueSuffix: { type: "string", maxLength: 10 },
                },
                required: ["type", "categories", "series"],
                additionalProperties: false,
              },
              sources: {
                type: "array",
                maxItems: 16,
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", maxLength: 120 },
                    url: { type: "string", maxLength: 500 },
                  },
                  required: ["title", "url"],
                  additionalProperties: false,
                },
              },
              sourceUrls: {
                type: "array",
                maxItems: 8,
                items: { type: "string", maxLength: 500 },
              },
            },
            required: ["layout", "title"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "slides"],
      additionalProperties: false,
    },
  },
};

export async function createPresentationFunction(args: unknown) {
  try {
    const result = await generatePresentation(args);
    return {
      status: 200,
      data: {
        success: true,
        ...result,
        message: "可编辑的 PowerPoint 文件已下载。",
      },
    };
  } catch (error) {
    return {
      status: 400,
      statusText: "Presentation generation failed",
      data: {
        error: true,
        message: error instanceof Error ? error.message : "PPT 生成失败",
      },
    };
  }
}
