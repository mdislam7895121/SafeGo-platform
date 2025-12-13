import { Request, Response, NextFunction } from "express";
import { prisma } from "../db";

interface WAFRule {
  id: string;
  name: string;
  threatType: string;
  patterns: RegExp[];
  severity: string;
  score: number;
}

const WAF_RULES: WAFRule[] = [
  {
    id: "sqli-001",
    name: "SQL Injection - Basic",
    threatType: "sqli",
    patterns: [
      /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
      /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
      /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
      /((\%27)|(\'))union/i,
      /union.*select/i,
      /select.*from/i,
      /insert.*into/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /update.*set/i,
      /;.*--/i,
    ],
    severity: "critical",
    score: 90,
  },
  {
    id: "sqli-002",
    name: "SQL Injection - Advanced",
    threatType: "sqli",
    patterns: [
      /exec(\s|\+)+(s|x)p\w+/i,
      /UNION(\s+ALL)?\s+SELECT/i,
      /\bOR\b\s+\d+=\d+/i,
      /\bOR\b\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?/i,
      /\bAND\b\s+\d+=\d+/i,
      /WAITFOR\s+DELAY/i,
      /BENCHMARK\s*\(/i,
      /SLEEP\s*\(/i,
    ],
    severity: "critical",
    score: 95,
  },
  {
    id: "xss-001",
    name: "XSS - Script Tags",
    threatType: "xss",
    patterns: [
      /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
      /<script\b[^>]*>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /vbscript:/gi,
    ],
    severity: "high",
    score: 80,
  },
  {
    id: "xss-002",
    name: "XSS - Event Handlers",
    threatType: "xss",
    patterns: [
      /onerror\s*=/gi,
      /onload\s*=/gi,
      /onclick\s*=/gi,
      /onmouseover\s*=/gi,
      /onfocus\s*=/gi,
      /onblur\s*=/gi,
      /onsubmit\s*=/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi,
    ],
    severity: "high",
    score: 75,
  },
  {
    id: "xss-003",
    name: "XSS - Encoded Attacks",
    threatType: "xss",
    patterns: [
      /&#x?[0-9a-f]+;/gi,
      /%3Cscript/gi,
      /%3E/gi,
      /\x00/gi,
      /data:text\/html/gi,
    ],
    severity: "high",
    score: 70,
  },
  {
    id: "path-001",
    name: "Path Traversal",
    threatType: "path_traversal",
    patterns: [
      /\.\.\//g,
      /\.\.\\\\?/g,
      /%2e%2e%2f/gi,
      /%2e%2e\//gi,
      /\.%2e\//gi,
      /%2e\.\//gi,
      /\.\.%5c/gi,
      /%252e%252e%252f/gi,
      /etc\/passwd/gi,
      /etc\/shadow/gi,
      /proc\/self/gi,
    ],
    severity: "high",
    score: 85,
  },
  {
    id: "header-001",
    name: "Invalid Headers",
    threatType: "invalid_header",
    patterns: [
      /\r\n/g,
      /\n/g,
      /%0d%0a/gi,
      /%0a/gi,
      /%0d/gi,
    ],
    severity: "medium",
    score: 50,
  },
  {
    id: "ua-001",
    name: "Bad User Agent",
    threatType: "bad_user_agent",
    patterns: [
      /^$/,
      /^-$/,
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /masscan/i,
      /dirbuster/i,
      /gobuster/i,
      /wfuzz/i,
      /burpsuite/i,
      /owasp/i,
      /acunetix/i,
      /nessus/i,
      /openvas/i,
    ],
    severity: "medium",
    score: 60,
  },
  {
    id: "cmd-001",
    name: "Command Injection",
    threatType: "command_injection",
    patterns: [
      /;\s*ls\b/gi,
      /;\s*cat\b/gi,
      /;\s*rm\b/gi,
      /;\s*wget\b/gi,
      /;\s*curl\b/gi,
      /\|\s*ls\b/gi,
      /\|\s*cat\b/gi,
      /`[^`]+`/g,
      /\$\([^)]+\)/g,
    ],
    severity: "critical",
    score: 95,
  },
];

interface WAFCheckResult {
  blocked: boolean;
  threats: Array<{
    ruleId: string;
    ruleName: string;
    threatType: string;
    pattern: string;
    severity: string;
    score: number;
  }>;
  totalScore: number;
}

function checkContent(content: string, rules: WAFRule[]): WAFCheckResult {
  const threats: WAFCheckResult["threats"] = [];
  let totalScore = 0;

  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      if (pattern.test(content)) {
        threats.push({
          ruleId: rule.id,
          ruleName: rule.name,
          threatType: rule.threatType,
          pattern: pattern.toString(),
          severity: rule.severity,
          score: rule.score,
        });
        totalScore += rule.score;
        break;
      }
    }
  }

  return {
    blocked: totalScore >= 50,
    threats,
    totalScore,
  };
}

async function logWAFEvent(
  req: Request,
  result: WAFCheckResult,
  actionTaken: string
): Promise<void> {
  const primaryThreat = result.threats[0];

  try {
    await prisma.wafLog.create({
      data: {
        requestPath: req.path,
        requestMethod: req.method,
        requestHeaders: req.headers as any,
        requestBody: req.body ? JSON.stringify(req.body).substring(0, 1000) : undefined,
        threatType: primaryThreat?.threatType || "unknown",
        threatPattern: primaryThreat?.pattern,
        threatSeverity: primaryThreat?.severity || "medium",
        threatScore: result.totalScore,
        actionTaken,
        wasBlocked: result.blocked,
        sourceIp: req.ip || req.headers["x-forwarded-for"]?.toString().split(",")[0] || "unknown",
        sourceCountry: req.headers["cf-ipcountry"]?.toString(),
        userAgent: req.headers["user-agent"],
        userId: (req as any).user?.id,
        userRole: (req as any).user?.role,
        ruleId: primaryThreat?.ruleId,
        ruleName: primaryThreat?.ruleName,
        metadata: {
          allThreats: result.threats,
          totalScore: result.totalScore,
        },
      },
    });
  } catch (error) {
    console.error("[WAF] Failed to log WAF event:", error);
  }
}

export const wafMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const contentToCheck: string[] = [];

  contentToCheck.push(req.path);
  contentToCheck.push(req.originalUrl);

  if (req.query) {
    contentToCheck.push(JSON.stringify(req.query));
  }

  if (req.body && typeof req.body === "object") {
    contentToCheck.push(JSON.stringify(req.body));
  }

  const userAgent = req.headers["user-agent"] || "";
  const uaCheck = checkContent(userAgent, WAF_RULES.filter((r) => r.threatType === "bad_user_agent"));

  const combinedContent = contentToCheck.join(" ");
  const contentCheck = checkContent(
    combinedContent,
    WAF_RULES.filter((r) => r.threatType !== "bad_user_agent")
  );

  const allThreats = [...uaCheck.threats, ...contentCheck.threats];
  const totalScore = uaCheck.totalScore + contentCheck.totalScore;
  const blocked = totalScore >= 50;

  if (allThreats.length > 0) {
    const result: WAFCheckResult = { blocked, threats: allThreats, totalScore };
    const actionTaken = blocked ? "blocked" : "logged";

    await logWAFEvent(req, result, actionTaken);

    if (blocked) {
      console.warn(`[WAF] Blocked request from ${req.ip} to ${req.path}: ${allThreats.map((t) => t.threatType).join(", ")}`);

      return res.status(403).json({
        error: "Request blocked",
        message: "Your request has been blocked by security filters",
        requestId: `waf-${Date.now()}`,
      });
    }

    console.log(`[WAF] Logged suspicious request from ${req.ip} to ${req.path}: score ${totalScore}`);
  }

  next();
};

export const wafMiddlewareStrict = async (req: Request, res: Response, next: NextFunction) => {
  const contentToCheck: string[] = [req.path, req.originalUrl];

  if (req.query) {
    contentToCheck.push(JSON.stringify(req.query));
  }

  if (req.body && typeof req.body === "object") {
    contentToCheck.push(JSON.stringify(req.body));
  }

  const combinedContent = contentToCheck.join(" ");
  const result = checkContent(combinedContent, WAF_RULES);

  if (result.threats.length > 0) {
    await logWAFEvent(req, result, "blocked");

    return res.status(403).json({
      error: "Request blocked",
      message: "Security violation detected",
    });
  }

  next();
};

export async function getWAFStats(): Promise<{
  blockedToday: number;
  loggedToday: number;
  byThreatType: Record<string, number>;
  bySeverity: Record<string, number>;
}> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [blockedToday, loggedToday, byThreatType, bySeverity] = await Promise.all([
    prisma.wafLog.count({
      where: { wasBlocked: true, createdAt: { gte: todayStart } },
    }),
    prisma.wafLog.count({
      where: { wasBlocked: false, createdAt: { gte: todayStart } },
    }),
    prisma.wafLog.groupBy({
      by: ["threatType"],
      _count: { id: true },
      where: { createdAt: { gte: todayStart } },
    }),
    prisma.wafLog.groupBy({
      by: ["threatSeverity"],
      _count: { id: true },
      where: { createdAt: { gte: todayStart } },
    }),
  ]);

  return {
    blockedToday,
    loggedToday,
    byThreatType: Object.fromEntries(byThreatType.map((t) => [t.threatType, t._count.id])),
    bySeverity: Object.fromEntries(bySeverity.map((s) => [s.threatSeverity, s._count.id])),
  };
}
