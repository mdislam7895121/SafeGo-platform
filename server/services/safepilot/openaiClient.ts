import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const SAFEPILOT_MODEL = process.env.SAFEPILOT_MODEL || "gpt-5";
export const SAFEPILOT_EMBED_MODEL = process.env.SAFEPILOT_EMBED_MODEL || "text-embedding-3-large";

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: SAFEPILOT_EMBED_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

export async function moderateText(input: string): Promise<{
  flagged: boolean;
  categories: Record<string, boolean>;
  categoryScores: Record<string, number>;
}> {
  const response = await openai.moderations.create({
    model: "omni-moderation-latest",
    input,
  });
  
  const result = response.results[0];
  return {
    flagged: result.flagged,
    categories: result.categories as unknown as Record<string, boolean>,
    categoryScores: result.category_scores as unknown as Record<string, number>,
  };
}

export async function chatCompletion(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options?: {
    maxTokens?: number;
    responseFormat?: "text" | "json";
  }
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: SAFEPILOT_MODEL,
    messages,
    max_completion_tokens: options?.maxTokens ?? 2048,
    ...(options?.responseFormat === "json" && {
      response_format: { type: "json_object" },
    }),
  });

  return response.choices[0]?.message?.content || "";
}
