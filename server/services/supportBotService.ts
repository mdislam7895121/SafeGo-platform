import { db } from "../db";

const prisma = db;

interface BotResponse {
  message: string;
  suggestedActions?: string[];
}

const BOT_TEMPLATES: Record<string, BotResponse> = {
  payments: {
    message: "I can help you with payments and wallet questions! Your wallet shows your current balance, recent payouts, and transaction history. You can also manage your payout methods to receive earnings.\n\nWhat would you like to know about:\n• Current balance or recent payouts\n• Payout methods or cash-out\n• Transaction history or earnings",
    suggestedActions: ["/driver/wallet", "/driver/account/payout-methods"],
  },
  
  wallet: {
    message: "Your SafeGo Wallet tracks all your earnings, commissions, and payouts. You can view your current balance, see detailed transaction history, and cash out your earnings when ready.\n\nNeed help with:\n• Viewing your balance\n• Checking payout history\n• Adding or changing payout methods\n• Understanding transactions",
    suggestedActions: ["/driver/wallet", "/driver/account/payout-methods"],
  },

  documents: {
    message: "I can help with driver documents and vehicle information! Your documents need to be up-to-date for account verification and to continue driving.\n\nCommon tasks:\n• Upload or update driver's license\n• Update vehicle registration\n• Add insurance documents\n• Check document verification status",
    suggestedActions: ["/driver/account/documents", "/driver/account/vehicle"],
  },

  vehicle: {
    message: "Need help with vehicle information? You can manage your vehicle details, insurance, and registration documents in your account settings.\n\nWhat do you need:\n• Update vehicle information\n• Upload vehicle registration\n• Add insurance documents\n• Check verification status",
    suggestedActions: ["/driver/account/vehicle", "/driver/account/documents"],
  },

  tax: {
    message: "I can help you understand your tax information and documents. SafeGo provides tax summaries based on your country.\n\n**For US drivers:** Access your 1099 tax forms and year-to-date earnings\n**For Bangladesh drivers:** Download income summaries for your tax filing\n\nYou can view and download your tax documents anytime.",
    suggestedActions: ["/driver/account/tax"],
  },

  trips: {
    message: "Looking for trip information? You can view your complete trip history, including earnings, rider details, and trip statistics.\n\nNeed to:\n• View past trips\n• Check trip earnings\n• Report an issue with a trip\n• Review trip details",
    suggestedActions: ["/driver/trips"],
  },

  riders: {
    message: "Having issues with a rider? You can:\n• Report inappropriate behavior\n• Block specific riders from future matches\n• Review rider ratings\n• File a trip-related complaint\n\nFor safety concerns, please escalate to live support immediately.",
    suggestedActions: ["/driver/blocked-riders"],
  },

  account: {
    message: "I can help with account settings and profile information! You can update your personal details, preferences, and account security settings.\n\nCommon account tasks:\n• Update name, email, or phone\n• Change password\n• Manage notifications\n• Update address or preferences",
    suggestedActions: ["/driver/account/settings", "/driver/profile"],
  },

  profile: {
    message: "Your driver profile shows your stats, ratings, and achievements. You can view your public profile, update personal information, and manage account settings.\n\nWhat would you like to do:\n• View your public profile\n• Update account information\n• Change password or email\n• Manage preferences",
    suggestedActions: ["/driver/profile", "/driver/account/settings"],
  },

  points: {
    message: "The SafeGo Points system rewards you for completing trips! Earn points based on trip timing, maintain your tier status, and unlock exclusive benefits.\n\n**How it works:**\n• Night/Morning (12 AM-3 PM): 1 point per trip\n• Peak Evening (3 PM-5 PM): 3 points per trip\n• Evening (5 PM-12 AM): 5 points per trip\n\nPoints reset every 90 days, so keep driving to maintain your tier!",
    suggestedActions: ["/driver/points"],
  },

  promotions: {
    message: "Check out available promotions and opportunity bonuses! SafeGo offers special incentives for driving in specific zones or during high-demand times.\n\nYou can:\n• View active promotions\n• See opportunity bonuses by zone\n• Track promotional earnings\n• Learn about upcoming campaigns",
    suggestedActions: ["/driver/promotions"],
  },
};

const KEYWORD_MAP: Record<string, string> = {
  payment: "payments",
  payout: "payments",
  earning: "payments",
  earnings: "payments",
  money: "payments",
  balance: "wallet",
  wallet: "wallet",
  cash: "wallet",
  cashout: "wallet",
  "cash out": "wallet",
  "cash-out": "wallet",
  withdraw: "wallet",
  document: "documents",
  documents: "documents",
  license: "documents",
  "driver license": "documents",
  "driver's license": "documents",
  insurance: "documents",
  registration: "documents",
  vehicle: "vehicle",
  car: "vehicle",
  tax: "tax",
  taxes: "tax",
  "1099": "tax",
  "tax form": "tax",
  "tax document": "tax",
  trip: "trips",
  trips: "trips",
  ride: "trips",
  rides: "trips",
  history: "trips",
  rider: "riders",
  riders: "riders",
  passenger: "riders",
  passengers: "riders",
  customer: "riders",
  customers: "riders",
  block: "riders",
  report: "riders",
  account: "account",
  profile: "profile",
  settings: "account",
  password: "account",
  email: "account",
  phone: "account",
  name: "account",
  address: "account",
  points: "points",
  tier: "points",
  "safeGo points": "points",
  loyalty: "points",
  promotion: "promotions",
  promotions: "promotions",
  bonus: "promotions",
  bonuses: "promotions",
  incentive: "promotions",
  incentives: "promotions",
  opportunity: "promotions",
};

const DEFAULT_RESPONSE: BotResponse = {
  message: "Thanks for reaching out! I'm SafeGo Assistant, here to help you with common questions about:\n\n• **Payments & Wallet** - Balance, payouts, earnings\n• **Trips & Riders** - Trip history, rider issues\n• **Documents & Vehicle** - Upload documents, verify account\n• **Tax Information** - Download tax forms and summaries\n• **Account & Profile** - Update settings, change password\n\nWhat can I help you with today?",
};

export function detectIntent(userMessage: string): string | null {
  const messageLower = userMessage.toLowerCase().trim();
  
  for (const [keyword, intent] of Object.entries(KEYWORD_MAP)) {
    if (messageLower.includes(keyword)) {
      return intent;
    }
  }
  
  return null;
}

export function getBotResponse(userMessage: string, driverName?: string): BotResponse {
  const intent = detectIntent(userMessage);
  
  if (intent && BOT_TEMPLATES[intent]) {
    return BOT_TEMPLATES[intent];
  }
  
  return DEFAULT_RESPONSE;
}

export async function createBotMessage(
  conversationId: string,
  content: string
): Promise<void> {
  await prisma.supportMessage.create({
    data: {
      conversationId,
      senderType: "bot",
      messageType: "text",
      body: content,
      read: false,
    },
  });
}

export async function createSystemMessage(
  conversationId: string,
  content: string
): Promise<void> {
  await prisma.supportMessage.create({
    data: {
      conversationId,
      senderType: "system",
      messageType: "text",
      body: content,
      read: false,
    },
  });
}
