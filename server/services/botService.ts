import { getTopicsForRole } from "../../client/src/config/supportTopics";

interface BotResponse {
  message: string;
  suggestEscalation: boolean;
  detectedKeywords: string[];
}

/**
 * BotService handles automated responses to user messages
 * Uses template-based responses with keyword matching
 */
export class BotService {
  // Keywords that trigger immediate escalation to human agent
  private static ESCALATION_KEYWORDS = [
    "agent",
    "human",
    "support",
    "live chat",
    "speak to someone",
    "talk to someone",
    "representative",
    "help me",
    "not working",
    "urgent",
    "emergency",
  ];

  // Keywords for common issues with template responses
  private static KEYWORD_TEMPLATES: Record<string, string> = {
    // Payment related
    "payout|cashout|cash out|withdraw": `I can help with payout questions! Here's what you need to know:
• Minimum cash-out: $5 USD or ৳100 BDT
• Processing time: 1-3 business days
• Supported methods: Bank account, mobile money

To set up or change your payout method, visit your wallet settings. If you're experiencing delays or issues, type 'agent' to speak with our financial team.`,

    "payment|pay|charge|fee": `Let me help with payment questions:
• Payment methods: Credit/debit card, digital wallet, cash
• Transaction history: View in your account
• Payment issues: Pending charges usually process within 24 hours

For specific payment problems or refunds, please describe the issue or type 'agent' for human assistance.`,

    // Trip/Ride related
    "trip|ride|fare|driver|pickup": `I can assist with trip-related questions:
• Fare disputes: Check your trip receipt for breakdown
• Driver issues: Rate your experience after each trip
• Pickup/dropoff problems: Ensure correct addresses
• Trip history: Available in your account

For specific trip issues, please provide trip details or type 'agent' to connect with support.`,

    // Document related
    "document|license|kyc|verification|verify|id": `Document and verification help:
• Upload requirements: Clear, readable photos
• Processing time: 24-48 hours
• KYC status: Check your profile
• Rejection reasons: You'll receive an email with details

If your documents were rejected or you need urgent verification, type 'agent' to speak with our compliance team.`,

    // Account related
    "account|login|password|email|phone": `Account assistance available:
• Password reset: Use "Forgot Password" on login page
• Email/phone updates: Go to Account Settings
• Account issues: Check for verification emails
• Two-factor authentication: Enable in Security Settings

For account access problems, type 'agent' for immediate help.`,

    // Tax related
    "tax|1099|w-9|w9|income|earnings": `Tax information support:
• US drivers: 1099 forms available in Tax Center
• BD drivers: Annual tax summaries in your account
• Year-to-date earnings: View in Wallet section
• Tax documents: Download from Tax Center

For specific tax questions, consult a tax professional or type 'agent' to speak with our tax support team.`,
  };

  /**
   * Check if user message contains escalation keywords
   */
  static detectEscalationIntent(userMessage: string): boolean {
    const lowerMessage = userMessage.toLowerCase();
    return this.ESCALATION_KEYWORDS.some((keyword) =>
      lowerMessage.includes(keyword)
    );
  }

  /**
   * Generate bot response based on user message and context
   */
  static generateResponse(
    userMessage: string,
    userRole: string,
    topic?: string
  ): BotResponse {
    const lowerMessage = userMessage.toLowerCase();
    const detectedKeywords: string[] = [];

    // Check for escalation keywords first
    if (this.detectEscalationIntent(userMessage)) {
      return {
        message:
          "I understand you'd like to speak with a human agent. Connecting you now...",
        suggestEscalation: true,
        detectedKeywords: ["escalation_requested"],
      };
    }

    // Try to match keywords with templates
    for (const [keywordPattern, template] of Object.entries(
      this.KEYWORD_TEMPLATES
    )) {
      const keywords = keywordPattern.split("|");
      const matched = keywords.some((kw) => lowerMessage.includes(kw));

      if (matched) {
        detectedKeywords.push(...keywords.filter((kw) => lowerMessage.includes(kw)));
        return {
          message: template,
          suggestEscalation: false,
          detectedKeywords,
        };
      }
    }

    // If no keywords matched, provide generic helpful response based on role
    const roleTopics = getTopicsForRole(userRole);
    const topicList = roleTopics?.topics
      .map((t) => `• ${t.label}`)
      .join("\n") || "• General support";

    const genericResponse = `I'm here to help! I can assist with:
${topicList}

Please describe your issue in more detail, or select a quick topic from the left panel. You can also type 'agent' anytime to speak with a human support specialist.`;

    return {
      message: genericResponse,
      suggestEscalation: true,
      detectedKeywords: [],
    };
  }

  /**
   * Generate response for quick topic selection
   */
  static generateTopicResponse(topicKey: string, userRole: string): string {
    const roleTopics = getTopicsForRole(userRole);
    const topic = roleTopics?.topics.find((t) => t.key === topicKey);

    if (topic) {
      return topic.botResponse;
    }

    return `I can help with that! Please describe your ${topicKey} issue in more detail, or type 'agent' to speak with a human support agent.`;
  }

  /**
   * Check if bot response seems unhelpful (for unresolved tracking)
   */
  static isGenericResponse(botMessage: string): boolean {
    const genericPhrases = [
      "please describe",
      "tell me more",
      "i'm here to help",
      "can you provide more details",
    ];

    const lowerMessage = botMessage.toLowerCase();
    return genericPhrases.some((phrase) => lowerMessage.includes(phrase));
  }
}
