import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const articles = [
  // Orders and Deliveries
  {
    category: "Orders and Deliveries",
    title: "How to manage incoming orders",
    slug: "manage-incoming-orders",
    content: `# Managing Incoming Orders\n\nWhen a customer places an order, you'll receive a notification in your dashboard.\n\n## Steps to Accept Orders:\n1. Go to the Orders tab\n2. Review the order details\n3. Click "Accept Order" to confirm\n4. Start preparing the food\n\n## Order Timeline:\n- **Accepted**: Order confirmed and being prepared\n- **Ready**: Food is ready for pickup/delivery\n- **Completed**: Order has been delivered\n\n## Best Practices:\n- Accept orders within 2-3 minutes\n- Update status promptly\n- Contact customer if items are unavailable`,
  },
  {
    category: "Orders and Deliveries",
    title: "How to cancel or refund an order",
    slug: "cancel-refund-order",
    content: `# Cancelling and Refunding Orders\n\nSometimes you may need to cancel an order due to unavailability or other issues.\n\n## When to Cancel:\n- Items out of stock\n- Kitchen issues\n- Unable to fulfill delivery\n\n## How to Cancel:\n1. Open the order details\n2. Click "Cancel Order"\n3. Select a reason\n4. Customer receives automatic refund\n\n## Refund Processing:\n- Full refunds: 3-5 business days\n- Partial refunds: Contact support`,
  },
  // Payments & Payouts
  {
    category: "Payments & Payouts",
    title: "Understanding your payout schedule",
    slug: "payout-schedule",
    content: `# Payout Schedule\n\nSafeGo processes restaurant payouts on a weekly basis.\n\n## Payout Timeline:\n- **Weekly payouts**: Every Monday for previous week's orders\n- **Processing time**: 2-3 business days\n- **Minimum threshold**: $50\n\n## What's Included:\n- Order subtotals\n- Minus commission fees\n- Minus any adjustments\n\n## How to Track:\n1. Go to Payouts tab\n2. View transaction history\n3. Download payout reports`,
  },
  {
    category: "Payments & Payouts",
    title: "How to add or update payout methods",
    slug: "add-payout-method",
    content: `# Managing Payout Methods\n\nSet up your payout method to receive earnings.\n\n## Supported Methods:\n**Bangladesh:**\n- bKash\n- Nagad\n- Rocket\n- Bank Transfer\n\n**United States:**\n- ACH Bank Transfer\n- Wire Transfer\n\n## Adding a Payout Method:\n1. Go to Settings > Payout Methods\n2. Click "Add Payout Method"\n3. Select your country\n4. Choose payment provider\n5. Enter account details\n6. Verify your information\n\n## Security:\nAll payout details are encrypted and secure.`,
  },
  // Account & Verification
  {
    category: "Account & Verification",
    title: "How to complete restaurant verification (KYC)",
    slug: "complete-kyc-verification",
    content: `# Restaurant Verification (KYC)\n\nComplete verification to start receiving orders.\n\n## Required Documents:\n**Bangladesh:**\n- National ID (NID) - front and back\n- Business license\n- Owner photo\n\n**United States:**\n- Government ID (Driver's License or State ID)\n- Business EIN\n- Owner photo\n\n## Verification Steps:\n1. Go to Settings > Verification\n2. Upload required documents\n3. Fill in business details\n4. Submit for review\n5. Approval within 24-48 hours\n\n## Common Issues:\n- Blurry documents: Re-upload clear photos\n- Missing information: Complete all fields\n- Name mismatch: Ensure names match documents`,
  },
  {
    category: "Account & Verification",
    title: "Managing staff accounts and permissions",
    slug: "manage-staff-accounts",
    content: `# Staff Management\n\nAdd team members and control their access levels.\n\n## How to Add Staff:\n1. Go to Settings > Staff\n2. Click "Add Staff Member"\n3. Enter email and name\n4. Set permissions\n5. Send invitation\n\n## Permission Levels:\n- **View Orders**: Can see orders only\n- **Manage Orders**: Can accept/cancel orders\n- **Edit Menu**: Can update menu items\n- **View Payouts**: Can see financial data\n- **Reply Support**: Can respond to customer tickets\n\n## Security:\n- Staff can't access payout methods\n- Owner retains full control\n- Disable staff access anytime`,
  },
  // Menu & Store Management
  {
    category: "Menu & Store Management",
    title: "How to add and update menu items",
    slug: "add-update-menu-items",
    content: `# Managing Your Menu\n\nKeep your menu up-to-date for better customer experience.\n\n## Adding New Items:\n1. Go to Menu tab\n2. Click "Add Item"\n3. Upload food photo\n4. Enter name, description, price\n5. Select category\n6. Set dietary tags (vegan, gluten-free, etc.)\n7. Click Save\n\n## Updating Prices:\n1. Find the item\n2. Click Edit\n3. Update price\n4. Save changes\n\n## Managing Availability:\n- Toggle items on/off as needed\n- Mark items as "Out of Stock" temporarily\n- Schedule items for specific hours`,
  },
  {
    category: "Menu & Store Management",
    title: "Setting restaurant hours and availability",
    slug: "set-restaurant-hours",
    content: `# Restaurant Hours & Availability\n\nManage when customers can order from you.\n\n## Setting Hours:\n1. Go to Settings > Hours\n2. Set open/close times for each day\n3. Add split shifts if needed\n4. Save schedule\n\n## Temporary Closures:\n- Use "Go Offline" button for quick breaks\n- Schedule vacation mode in advance\n- System notifies customers automatically\n\n## Delivery Settings:\n- Set delivery radius\n- Configure minimum order amount\n- Enable/disable pickup option`,
  },
  // Device & Technical Issues
  {
    category: "Device & Technical Issues",
    title: "Troubleshooting login issues",
    slug: "troubleshoot-login-issues",
    content: `# Login Troubleshooting\n\nHaving trouble accessing your account?\n\n## Common Solutions:\n\n### Forgot Password:\n1. Click "Forgot Password" on login page\n2. Enter your email\n3. Check inbox for reset link\n4. Create new password\n\n### Account Locked:\n- Too many failed attempts locks account\n- Wait 15 minutes and try again\n- Or contact support for immediate unlock\n\n### Email Not Recognized:\n- Check for typos\n- Try alternate email\n- Verify account exists\n\n## Still Need Help?\nContact support at support@safego.com`,
  },
  {
    category: "Device & Technical Issues",
    title: "App not loading or showing errors",
    slug: "app-not-loading-errors",
    content: `# App Technical Issues\n\nQuick fixes for common technical problems.\n\n## App Won't Load:\n1. Check internet connection\n2. Clear browser cache\n3. Try incognito/private mode\n4. Use different browser\n5. Restart device\n\n## Orders Not Appearing:\n1. Refresh the page\n2. Check you're online\n3. Verify restaurant hours are set\n4. Ensure menu has items\n\n## Images Not Uploading:\n- Check file size (max 5MB)\n- Use JPG or PNG format\n- Ensure stable internet\n- Try smaller file size\n\n## System Status:\nCheck system status page for known issues`,
  },
];

async function seedArticles() {
  console.log("Seeding support articles...");
  
  for (const article of articles) {
    await prisma.supportArticle.upsert({
      where: { slug: article.slug },
      update: article,
      create: article,
    });
  }
  
  console.log(`✅ Seeded ${articles.length} support articles`);
}

seedArticles()
  .catch((e) => {
    console.error("Error seeding articles:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
