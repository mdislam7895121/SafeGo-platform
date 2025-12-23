import OpenAI from 'openai';
import { prisma } from '../../db';

const SAFEPILOT_MODEL = process.env.SAFEPILOT_MODEL || 'gpt-5';

export type SafePilotMode = 'intel' | 'context' | 'chat' | 'crisis' | 'scan';

export interface SafePilotRequest {
  mode: SafePilotMode;
  question: string;
  userId: string;
  userRole: string;
  pageContext?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SafePilotResponse {
  success: boolean;
  answer: string;
  traceId: string;
  mode: SafePilotMode;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
}

const ADMIN_SYSTEM_PROMPT = `You are SafePilot, the AI assistant for SafeGo platform administrators.

ROLE: You help admins with platform operations, metrics, KPIs, KYC queues, fraud signals, payouts, disputes, system health, and recommended actions.

RULES:
1. Be concise and action-oriented
2. Provide clear next steps when relevant
3. Use bullet points for lists
4. Never expose sensitive user PII
5. If asked about customer support tickets, redirect to Support SafePilot
6. Focus on admin/operator concerns only

CURRENT CONTEXT: SafeGo is a multi-service super-app (rides, food delivery, parcels) operating in USA and Bangladesh.`;

const MODE_SYSTEM_ADDITIONS: Record<SafePilotMode, string> = {
  intel: `
MODE: INTEL (Intelligence Analysis)
Focus on: Risk signals, fraud patterns, security alerts, suspicious activities, compliance issues.
Format: Summarize key signals with severity ratings and recommended actions.
Prioritize: High-risk items first, then medium, then low.`,
  
  context: `
MODE: CONTEXT (Explainer)
Focus on: Explaining what is happening, why, dependencies, and background.
Format: Clear explanations with relevant context and relationships.
Prioritize: Clarity and completeness over brevity.`,
  
  chat: `
MODE: CHAT (General Assistant)
Focus on: Answering admin questions helpfully and accurately.
Format: Natural conversational responses with actionable information.
Prioritize: Accuracy and helpfulness.`,
  
  crisis: `
MODE: CRISIS (Emergency Response)
Focus on: Incident response, impact assessment, mitigation steps, escalation paths.
Format: Numbered action items with owners and deadlines.
Prioritize: Immediate containment, then resolution, then prevention.`,
  
  scan: `
MODE: SCAN (Audit Checklist)
Focus on: Compliance checks, security audits, operational reviews.
Format: Checklist with status (OK/WARN/FAIL) for each item.
Prioritize: Critical compliance items first.`
};

export async function runSafePilot(request: SafePilotRequest): Promise<SafePilotResponse> {
  const traceId = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  if (!process.env.OPENAI_API_KEY) {
    return {
      success: false,
      answer: '',
      traceId,
      mode: request.mode,
      model: SAFEPILOT_MODEL,
      error: 'OPENAI_API_KEY is not configured. Please add it to your environment secrets.',
    };
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = `${ADMIN_SYSTEM_PROMPT}\n${MODE_SYSTEM_ADDITIONS[request.mode]}`;
  
  const userPrompt = request.pageContext 
    ? `[Page Context: ${request.pageContext}]\n\nUser Question: ${request.question}`
    : request.question;

  try {
    const response = await openai.chat.completions.create({
      model: SAFEPILOT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2048,
    });

    const answer = response.choices[0]?.message?.content || 'No response generated.';
    const tokensIn = response.usage?.prompt_tokens || 0;
    const tokensOut = response.usage?.completion_tokens || 0;

    await logSafePilotRequest({
      traceId,
      userId: request.userId,
      userRole: request.userRole,
      mode: request.mode,
      question: request.question,
      answer,
      model: SAFEPILOT_MODEL,
      tokensIn,
      tokensOut,
      success: true,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    });

    return {
      success: true,
      answer,
      traceId,
      mode: request.mode,
      model: SAFEPILOT_MODEL,
      tokensIn,
      tokensOut,
    };
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error occurred';
    
    await logSafePilotRequest({
      traceId,
      userId: request.userId,
      userRole: request.userRole,
      mode: request.mode,
      question: request.question,
      answer: '',
      model: SAFEPILOT_MODEL,
      tokensIn: 0,
      tokensOut: 0,
      success: false,
      error: errorMessage,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    });

    return {
      success: false,
      answer: '',
      traceId,
      mode: request.mode,
      model: SAFEPILOT_MODEL,
      error: `AI service error: ${errorMessage}`,
    };
  }
}

interface LogEntry {
  traceId: string;
  userId: string;
  userRole: string;
  mode: SafePilotMode;
  question: string;
  answer: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  success: boolean;
  error?: string;
}

async function logSafePilotRequest(entry: LogEntry & { ipAddress?: string; userAgent?: string; userRole?: string }): Promise<void> {
  try {
    await prisma.safePilotAuditLog.create({
      data: {
        actorUserId: entry.userId,
        actorRole: entry.userRole === 'SUPPORT' ? 'SUPPORT' : 'ADMIN',
        action: 'ask',
        metadata: {
          traceId: entry.traceId,
          mode: entry.mode,
          questionLength: entry.question.length,
          answerLength: entry.answer.length,
          model: entry.model,
          tokensIn: entry.tokensIn,
          tokensOut: entry.tokensOut,
          success: entry.success,
          error: entry.error || null,
          ipAddress: entry.ipAddress || null,
          userAgent: entry.userAgent || null,
        },
      },
    });
  } catch (logError) {
    console.error('[SafePilot] Failed to log request:', logError);
  }
}
