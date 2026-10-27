import { NextRequest, NextResponse } from "next/server";
import { auth } from "../auth";
import { getServerSideConfig } from "@/app/config/server";
import { ModelProvider } from "@/app/constant";
import { webSearch } from "@/app/search/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const authResult = auth(req, ModelProvider.GPT);
  if (authResult.error) {
    return NextResponse.json(authResult, { status: 401 });
  }

  const config = getServerSideConfig();
  try {
    const result = await webSearch(await req.json(), {
      exaApiKey: config.exaApiKey,
      tavilyApiKey: config.tavilyApiKey,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("not configured") ? 503 : 400;
    return NextResponse.json({ error: true, message }, { status });
  }
}
