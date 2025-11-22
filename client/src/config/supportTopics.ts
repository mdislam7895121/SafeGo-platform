export interface QuickTopic {
  key: string;
  label: string;
  userMessage: string;
  botResponse: string;
}

export interface RoleTopics {
  role: "driver" | "customer" | "restaurant";
  title: string;
  subtitle: string;
  topics: QuickTopic[];
}

export const ROLE_SUPPORT_TOPICS: RoleTopics[] = [
  {
    role: "driver",
    title: "SafeGo Driver Support",
    subtitle: "We're here to help with your driving experience",
    topics: [
      {
        key: "payments",
        label: "Payments & Wallet",
        userMessage: "I need help with payments and wallet",
        botResponse: "I can help with payment questions! Are you having issues with:\n• Viewing your earnings\n• Cash-out or payout methods\n• Transaction history\n• Payment delays\n\nPlease describe your specific issue, or type 'agent' to speak with a human support agent.",
      },
      {
        key: "payouts",
        label: "Payout methods or cash-out",
        userMessage: "I have questions about payout methods or cashing out",
        botResponse: "Let me help with payout questions! Common topics:\n• Setting up payout methods (bank account, mobile money)\n• Minimum cash-out amounts\n• Payout processing time (usually 1-3 business days)\n• Failed payout troubleshooting\n\nWhat specific payout question do you have? Type 'agent' for human support.",
      },
      {
        key: "trips",
        label: "Trips & riders issues",
        userMessage: "I'm having issues with trips or riders",
        botResponse: "I understand trip issues can be frustrating. I can help with:\n• Incorrect trip fares\n• Rider no-show or cancellations\n• Route or navigation problems\n• Trip history questions\n• Rating concerns\n\nTell me about your specific issue, or type 'agent' to connect with support.",
      },
      {
        key: "documents",
        label: "Documents & vehicle",
        userMessage: "I need help with documents or vehicle information",
        botResponse: "I can assist with document and vehicle questions:\n• Uploading or updating driver's license\n• Vehicle registration documents\n• Insurance verification\n• KYC status\n• Document rejection reasons\n\nWhat document issue are you experiencing? Type 'agent' for human help.",
      },
      {
        key: "tax",
        label: "Tax information",
        userMessage: "I have questions about tax information",
        botResponse: "Tax questions covered:\n• Tax forms (1099 for US drivers, tax summary for BD drivers)\n• Year-to-date earnings\n• Tax document downloads\n• W-9 certification (US only)\n• Tax deduction information\n\nWhat tax-related question can I help with? Type 'agent' to speak with a tax specialist.",
      },
      {
        key: "account",
        label: "Account & login",
        userMessage: "I'm having issues with my account or logging in",
        botResponse: "I can help with account issues:\n• Password reset\n• Account verification\n• Profile information updates\n• Account suspension or restrictions\n• Two-factor authentication\n\nDescribe your account issue, or type 'agent' for immediate human support.",
      },
    ],
  },
  {
    role: "customer",
    title: "SafeGo Rider Support",
    subtitle: "We're here to help with your ride experience",
    topics: [
      {
        key: "payments",
        label: "Payments & refunds",
        userMessage: "I need help with payments or refunds",
        botResponse: "I can assist with payment questions:\n• Payment method issues\n• Refund requests\n• Incorrect charges\n• Promo code problems\n• Payment history\n\nWhat payment issue are you experiencing? Type 'agent' to speak with support.",
      },
      {
        key: "trips",
        label: "Trip or ride issues",
        userMessage: "I had an issue with my trip or ride",
        botResponse: "Sorry to hear about your trip issue! I can help with:\n• Lost items\n• Driver behavior concerns\n• Route or fare disputes\n• Trip cancellations\n• Safety issues\n\nPlease describe what happened, or type 'agent' for immediate human support.",
      },
      {
        key: "promotions",
        label: "Promotions & credits",
        userMessage: "I have questions about promotions or ride credits",
        botResponse: "Let me help with promotions:\n• Promo codes not working\n• Ride credit balance\n• Referral bonuses\n• First-ride offers\n• Credit expiration\n\nWhat promotion question do you have? Type 'agent' for human help.",
      },
      {
        key: "safety",
        label: "Safety & security",
        userMessage: "I have a safety or security concern",
        botResponse: "Your safety is our top priority. I can help with:\n• Reporting safety incidents\n• Emergency contact setup\n• Share trip feature\n• Driver verification\n• Account security\n\nFor urgent safety issues, type 'agent' immediately. For general safety questions, please describe your concern.",
      },
      {
        key: "account",
        label: "Account & login",
        userMessage: "I'm having issues with my account or login",
        botResponse: "I can assist with account matters:\n• Password reset\n• Profile updates\n• Phone number or email changes\n• Account deactivation\n• Login problems\n\nDescribe your account issue, or type 'agent' for human assistance.",
      },
    ],
  },
  {
    role: "restaurant",
    title: "SafeGo Restaurant Support",
    subtitle: "We're here to help with your restaurant operations",
    topics: [
      {
        key: "orders",
        label: "Orders & delivery issues",
        userMessage: "I'm having issues with orders or delivery",
        botResponse: "I can help with order questions:\n• Missing or incorrect orders\n• Delivery delays\n• Driver issues\n• Order cancellations\n• Customer complaints\n\nWhat order issue are you experiencing? Type 'agent' for immediate support.",
      },
      {
        key: "menu",
        label: "Menu & pricing updates",
        userMessage: "I need help updating my menu or pricing",
        botResponse: "Menu management help:\n• Adding or removing items\n• Updating prices\n• Item availability\n• Special offers or promotions\n• Menu photo updates\n\nWhat menu change do you need? Type 'agent' to speak with our menu team.",
      },
      {
        key: "payouts",
        label: "Payouts & earnings",
        userMessage: "I have questions about payouts or earnings",
        botResponse: "I can assist with payout questions:\n• Payout schedule\n• Earnings breakdown\n• Commission structure\n• Bank account setup\n• Missing payments\n\nWhat payout question do you have? Type 'agent' for financial support.",
      },
      {
        key: "device",
        label: "Device / tablet issues",
        userMessage: "I'm having issues with my device or tablet",
        botResponse: "Device support available:\n• Tablet not connecting\n• Order notifications not working\n• App crashing or freezing\n• Login issues on device\n• Printer connection problems\n\nDescribe your device issue, or type 'agent' for technical support.",
      },
      {
        key: "documents",
        label: "Account & documents",
        userMessage: "I need help with account or business documents",
        botResponse: "Document and account help:\n• Business license verification\n• Tax documentation\n• Restaurant information updates\n• KYC status\n• Account settings\n\nWhat account or document question do you have? Type 'agent' for human help.",
      },
    ],
  },
];

export function getTopicsForRole(role: string): RoleTopics | undefined {
  return ROLE_SUPPORT_TOPICS.find((rt) => rt.role === role);
}
