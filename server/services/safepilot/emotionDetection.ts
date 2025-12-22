import { prisma } from "../../lib/prisma";

export type EmotionType = "ANGRY" | "CONFUSED" | "NORMAL";

export interface EmotionResult {
  emotion: EmotionType;
  confidence: number;
  signals: string[];
}

const ANGRY_KEYWORDS = [
  "angry", "frustrated", "furious", "upset", "ridiculous", "unacceptable",
  "terrible", "horrible", "worst", "scam", "fraud", "theft", "steal",
  "complain", "complaint", "sue", "lawyer", "report", "refund now",
  "never again", "hate", "disgusting", "pathetic", "useless", "incompetent",
  "waste of time", "waste of money", "rip off", "ripoff", "cheated",
  "lied", "lying", "joke", "disaster"
];

const CONFUSED_KEYWORDS = [
  "how do i", "how can i", "what is", "what does", "why is", "why does",
  "where is", "when will", "can you explain", "don't understand",
  "confused", "unclear", "not sure", "what happened", "makes no sense",
  "doesn't make sense", "lost", "help me understand", "i'm lost",
  "what should i", "how does", "explain", "clarify", "meaning of"
];

const FRUSTRATION_PATTERNS = [
  /!!!+/,
  /\?\?\?+/,
  /[A-Z]{5,}/,
  /still\s+(not|no|haven't|waiting)/i,
  /been\s+\d+\s+(hour|day|minute)/i,
  /again\s+and\s+again/i,
  /how\s+many\s+times/i,
  /already\s+told/i,
  /already\s+said/i,
  /same\s+issue/i,
  /same\s+problem/i,
  /nobody\s+(help|care|respond)/i,
  /no\s+one\s+(help|care|respond)/i,
];

const CONFUSION_PATTERNS = [
  /^how\s+/i,
  /^what\s+/i,
  /^why\s+/i,
  /^where\s+/i,
  /^can\s+i\s+/i,
  /^is\s+it\s+possible/i,
  /\?{2,}/,
];

export function detectEmotion(message: string): EmotionResult {
  const lowerMessage = message.toLowerCase();
  const signals: string[] = [];
  let angryScore = 0;
  let confusedScore = 0;

  for (const keyword of ANGRY_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      angryScore += 2;
      signals.push(`angry_keyword:${keyword}`);
    }
  }

  for (const pattern of FRUSTRATION_PATTERNS) {
    if (pattern.test(message)) {
      angryScore += 3;
      signals.push(`frustration_pattern:${pattern.source}`);
    }
  }

  const capsWords = (message.match(/[A-Z]{4,}/g) || []).length;
  if (capsWords > 0) {
    angryScore += capsWords;
    signals.push(`caps_words:${capsWords}`);
  }

  const exclamationCount = (message.match(/!/g) || []).length;
  if (exclamationCount >= 3) {
    angryScore += exclamationCount;
    signals.push(`exclamation_count:${exclamationCount}`);
  }

  for (const keyword of CONFUSED_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      confusedScore += 2;
      signals.push(`confused_keyword:${keyword}`);
    }
  }

  for (const pattern of CONFUSION_PATTERNS) {
    if (pattern.test(message)) {
      confusedScore += 1;
      signals.push(`confusion_pattern:${pattern.source}`);
    }
  }

  const questionCount = (message.match(/\?/g) || []).length;
  if (questionCount >= 2) {
    confusedScore += questionCount;
    signals.push(`question_count:${questionCount}`);
  }

  if (angryScore >= 5) {
    return {
      emotion: "ANGRY",
      confidence: Math.min(angryScore / 10, 1),
      signals,
    };
  }

  if (confusedScore >= 3 && confusedScore > angryScore) {
    return {
      emotion: "CONFUSED",
      confidence: Math.min(confusedScore / 8, 1),
      signals,
    };
  }

  return {
    emotion: "NORMAL",
    confidence: 1 - Math.max(angryScore, confusedScore) / 10,
    signals,
  };
}

export function getEmotionAwareTonePrefix(emotion: EmotionType, issueType?: string): string {
  switch (emotion) {
    case "ANGRY":
      return `I understand this is frustrating, and I'm truly sorry for the inconvenience. Let me help resolve this right away.

`;
    case "CONFUSED":
      return `No problem, let me walk you through this step by step.

`;
    case "NORMAL":
    default:
      return "";
  }
}

export function getEmotionAwareResponseGuidelines(emotion: EmotionType): string {
  switch (emotion) {
    case "ANGRY":
      return `IMPORTANT RESPONSE GUIDELINES (Customer is frustrated):
1. Start by acknowledging their frustration sincerely (do NOT dismiss or minimize)
2. Briefly explain what happened (fact-based, no excuses)
3. Provide a clear action or next step
4. Keep response concise - frustrated customers don't want walls of text
5. NEVER blame the customer
6. NEVER make promises you cannot fulfill (e.g., refunds without confirmation)`;

    case "CONFUSED":
      return `IMPORTANT RESPONSE GUIDELINES (Customer needs clarity):
1. Use simple, everyday language - no jargon or technical terms
2. Break down the answer into numbered steps if applicable
3. Use examples or analogies when helpful
4. End with a clear next action
5. Ask if they need further clarification`;

    case "NORMAL":
    default:
      return `RESPONSE GUIDELINES:
1. Be direct and action-oriented
2. Keep response concise
3. Provide clear next steps`;
  }
}

export async function logEmotionToConversation(
  conversationId: string,
  emotion: EmotionType,
  signals: string[]
): Promise<void> {
  try {
    const existing = await prisma.safePilotConversation.findUnique({
      where: { id: conversationId },
    });

    if (!existing) return;

    const emotionHistory = (existing as any).emotionHistory || [];
    emotionHistory.push({
      emotion,
      signals,
      timestamp: new Date().toISOString(),
    });

    await prisma.$executeRaw`
      UPDATE safepilot_conversations 
      SET "lastSeenAt" = NOW()
      WHERE id = ${conversationId}
    `;
  } catch (error) {
    console.error("[SafePilot] Failed to log emotion:", error);
  }
}

export function shouldEscalateBasedOnEmotion(
  emotion: EmotionType,
  issueResolved: boolean,
  attemptCount: number
): boolean {
  if (emotion === "ANGRY" && !issueResolved && attemptCount >= 1) {
    return true;
  }
  
  if (attemptCount >= 2 && !issueResolved) {
    return true;
  }

  return false;
}
