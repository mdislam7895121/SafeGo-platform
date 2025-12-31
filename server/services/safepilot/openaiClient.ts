import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
export const SAFEPILOT_MODEL = process.env.SAFEPILOT_MODEL || "gpt-5";
export const SAFEPILOT_EMBED_MODEL = process.env.SAFEPILOT_EMBED_MODEL || "text-embedding-3-large";

// Optional OpenAI client - only initialized if API key is present
let _openai: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

// Legacy export for backward compatibility - use getOpenAIClient() instead
export const openai = {
  get embeddings() {
    const client = getOpenAIClient();
    if (!client) throw new Error('OPENAI_API_KEY is not configured');
    return client.embeddings;
  },
  get moderations() {
    const client = getOpenAIClient();
    if (!client) throw new Error('OPENAI_API_KEY is not configured');
    return client.moderations;
  },
  get chat() {
    const client = getOpenAIClient();
    if (!client) throw new Error('OPENAI_API_KEY is not configured');
    return client.chat;
  },
};

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();
  if (!client) {
    console.warn('[SafePilot] OpenAI not configured, returning empty embedding');
    return [];
  }
  const response = await client.embeddings.create({
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
  const client = getOpenAIClient();
  if (!client) {
    console.warn('[SafePilot] OpenAI not configured, skipping moderation');
    return {
      flagged: false,
      categories: {},
      categoryScores: {},
    };
  }
  const response = await client.moderations.create({
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
  const client = getOpenAIClient();
  if (!client) {
    console.warn('[SafePilot] OpenAI not configured, returning empty response');
    return '';
  }
  const response = await client.chat.completions.create({
    model: SAFEPILOT_MODEL,
    messages,
    max_completion_tokens: options?.maxTokens ?? 2048,
    ...(options?.responseFormat === "json" && {
      response_format: { type: "json_object" },
    }),
  });

  return response.choices[0]?.message?.content || "";
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string }>;
      required?: string[];
    };
  };
}

export interface ToolCallResult {
  finishReason: "stop" | "tool_calls" | "length" | "content_filter";
  content: string | null;
  toolCalls: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
}

export async function chatCompletionWithTools(
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string | null;
    tool_call_id?: string;
    tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  }>,
  tools: ToolDefinition[],
  options?: { maxTokens?: number }
): Promise<ToolCallResult> {
  const client = getOpenAIClient();
  if (!client) {
    console.warn('[SafePilot] OpenAI not configured, returning empty tool result');
    return {
      finishReason: 'stop',
      content: null,
      toolCalls: [],
    };
  }
  const response = await client.chat.completions.create({
    model: SAFEPILOT_MODEL,
    messages: messages as any,
    tools: tools.length > 0 ? tools : undefined,
    tool_choice: tools.length > 0 ? "auto" : undefined,
    max_completion_tokens: options?.maxTokens ?? 2048,
  });

  const choice = response.choices[0];
  const message = choice.message;

  const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      if ("function" in tc && tc.function) {
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        });
      }
    }
  }

  return {
    finishReason: choice.finish_reason as ToolCallResult["finishReason"],
    content: message.content,
    toolCalls,
  };
}
