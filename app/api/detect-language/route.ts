import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Simple language detection based on character patterns
function detectLanguageSimple(text: string): string {
  const cleanText = text.toLowerCase().trim();
  
  // Hindi detection (Devanagari script)
  if (/[\u0900-\u097F]/.test(text)) {
    return "hi";
  }
  
  // Tamil detection
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return "ta";
  }
  
  // Kannada detection
  if (/[\u0C80-\u0CFF]/.test(text)) {
    return "kn";
  }
  
  // Common Hindi words (Roman script)
  const hindiWords = ["hai", "hain", "ki", "ko", "se", "mein", "par", "liye", "ke", "ka", "kya"];
  const words = cleanText.split(/\s+/);
  const hindiWordCount = words.filter(word => hindiWords.includes(word)).length;
  
  if (hindiWordCount > 1) {
    return "hi";
  }
  
  // Default to English
  return "en";
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    // Use simple language detection
    const detected = detectLanguageSimple(text);

    return NextResponse.json({
      language: detected,
    });

  } catch (error: any) {
    console.error("LANGUAGE DETECTION ERROR:", error);
    return NextResponse.json(
      { error: error?.message || "Language detection failed" },
      { status: 500 }
    );
  }
}
