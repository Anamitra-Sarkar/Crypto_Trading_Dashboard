import { NextResponse } from "next/server";
import { generateGroqResponse, GroqError } from "@/lib/groq";

export async function POST(req: Request) {
  try {
    const { message } = (await req.json()) as { message?: string };

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const prompt = `You are a cryptocurrency trading assistant. Help the user with their query about crypto trading, market analysis, and investment strategies. Provide clear, concise responses without using asterisks (*). Format lists with bullet points (•) instead. Here's the user's message: ${message}`;

    const response = await generateGroqResponse(prompt);

    const cleanedResponse = response
      .replace(/\*\*/g, "")
      .replace(/\*/g, "•")
      .trim();

    return NextResponse.json({ response: cleanedResponse });
  } catch (error) {
    console.error("Chat API error:", error);

    const status =
      error instanceof GroqError &&
      (error.type === "RATE_LIMIT" || error.type === "TIMEOUT" || error.type === "UPSTREAM")
        ? 503
        : 500;

    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate response";

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
