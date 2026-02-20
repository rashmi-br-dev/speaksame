import { NextRequest, NextResponse } from "next/server";
import { LingoDotDevEngine } from "lingo.dev/sdk";

export const runtime = "nodejs";

const lingo = new LingoDotDevEngine({
  apiKey: process.env.LINGODOTDEV_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const { text, targetLang } = await req.json();

    if (!text || !targetLang) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const translated = await lingo.localizeText(text, {
      sourceLocale: "en",        // change later if needed
      targetLocale: targetLang,
      fast: true                 // faster response (good for UI)
    });

    return NextResponse.json({
      translatedText: translated,
    });

  } catch (error: any) {
    console.error("LINGO ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Translation failed" },
      { status: 500 }
    );
  }
}