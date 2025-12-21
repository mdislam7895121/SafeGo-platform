import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultPages = [
  {
    slug: 'terms-of-service',
    title: 'Terms of Service',
    category: 'legal',
    status: 'published',
    visibility: 'public_visible',
    metaDescription: 'SafeGo Terms of Service - Review our terms and conditions for using our platform.',
    metaKeywords: 'safego, terms, service, legal, conditions',
    body: `## Terms of Service

**Effective Date: January 1, 2025**

Welcome to SafeGo. By using our services, you agree to these terms.

### 1. Acceptance of Terms

By accessing or using SafeGo's services, you agree to be bound by these Terms of Service and all applicable laws and regulations.

### 2. Description of Service

SafeGo provides on-demand transportation, food delivery, and parcel delivery services connecting users with independent service providers.

### 3. User Accounts

You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your account credentials.

### 4. User Conduct

You agree not to:
- Use the service for any unlawful purpose
- Interfere with or disrupt the service
- Attempt to gain unauthorized access to any systems

### 5. Payment Terms

All payments are processed securely through our platform. Prices are displayed before confirmation of any service.

### 6. Limitation of Liability

SafeGo is not liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service.

### 7. Changes to Terms

We reserve the right to modify these terms at any time. Continued use of the service constitutes acceptance of modified terms.

### 8. Contact Information

For questions about these Terms, please contact us at legal@safego.com`
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    category: 'legal',
    status: 'published',
    visibility: 'public_visible',
    metaDescription: 'SafeGo Privacy Policy - Learn how we collect, use, and protect your personal information.',
    metaKeywords: 'safego, privacy, policy, data, protection, gdpr',
    body: `## Privacy Policy

**Last Updated: January 1, 2025**

SafeGo is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information.

### Information We Collect

**Personal Information:**
- Name and contact details
- Payment information
- Location data when using our services
- Device information

**Usage Information:**
- Service usage patterns
- Communication preferences
- Feedback and ratings

### How We Use Your Information

- To provide and improve our services
- To process payments
- To communicate with you about your account
- To ensure safety and security
- To comply with legal obligations

### Data Sharing

We may share your information with:
- Service providers (drivers, restaurants)
- Payment processors
- Law enforcement when required

### Your Rights

You have the right to:
- Access your personal data
- Request correction of inaccurate data
- Request deletion of your data
- Opt-out of marketing communications

### Data Security

We implement industry-standard security measures to protect your data.

### Contact Us

For privacy inquiries: privacy@safego.com`
  },
  {
    slug: 'about-safego',
    title: 'About SafeGo',
    category: 'company',
    status: 'published',
    visibility: 'public_visible',
    metaDescription: 'Learn about SafeGo - Your trusted super-app for rides, food delivery, and parcel services in Bangladesh.',
    metaKeywords: 'safego, about, company, bangladesh, super app',
    body: `## About SafeGo

SafeGo is Bangladesh's emerging super-app platform, providing reliable and affordable on-demand services to communities across the nation.

### Our Mission

To make everyday services accessible, affordable, and safe for everyone.

### Our Services

**Rides**
Book safe and reliable transportation with verified drivers.

**Food Delivery**
Order from your favorite restaurants with fast delivery.

**Parcel Delivery**
Send packages across the city with real-time tracking.

### Why Choose SafeGo?

- **Verified Partners**: All drivers and delivery partners undergo thorough background checks
- **Transparent Pricing**: No hidden fees, fair rates for all
- **24/7 Support**: Our support team is always ready to help
- **Safety First**: Advanced safety features and real-time tracking

### Our Values

- **Trust**: Building lasting relationships through reliability
- **Safety**: Prioritizing the wellbeing of all users
- **Innovation**: Continuously improving our services
- **Community**: Supporting local businesses and drivers

### Join Us

Whether you're looking to earn or to access convenient services, SafeGo welcomes you to our growing community.`
  },
  {
    slug: 'help-center',
    title: 'Help Center',
    category: 'support',
    status: 'published',
    visibility: 'public_visible',
    metaDescription: 'SafeGo Help Center - Find answers to common questions and get support.',
    metaKeywords: 'safego, help, support, faq, customer service',
    body: `## Help Center

Welcome to SafeGo's Help Center. Find answers to common questions below.

### Getting Started

**How do I create an account?**
Download the SafeGo app and sign up with your phone number. Verify your number with the OTP sent to you.

**How do I book a ride?**
Enter your destination, choose your ride type, and tap "Book Now". A nearby driver will be assigned to you.

**How do I order food?**
Browse restaurants, add items to your cart, and checkout. Track your order in real-time.

### Payments

**What payment methods are accepted?**
We accept cash, bKash, Nagad, and card payments.

**How do I add a payment method?**
Go to Settings > Payment Methods > Add New.

**Can I get a refund?**
Refunds are processed for eligible cancellations within 3-5 business days.

### Safety

**Is SafeGo safe?**
All our partners undergo background verification. You can share your trip with trusted contacts.

**What if I have an emergency?**
Use the SOS button in the app to alert our safety team immediately.

### Account Issues

**I can't log in**
Try resetting your password. If issues persist, contact support.

**How do I delete my account?**
Go to Settings > Account > Delete Account. Note that this action is permanent.

### Contact Support

- **Email**: support@safego.com
- **Phone**: +880-1XXX-XXXXXX
- **In-App Chat**: Available 24/7`
  },
  {
    slug: 'driver-requirements',
    title: 'Driver Requirements',
    category: 'partner',
    status: 'published',
    visibility: 'public_visible',
    metaDescription: 'Requirements to become a SafeGo driver partner. Learn about eligibility and documentation.',
    metaKeywords: 'safego, driver, requirements, partner, earn',
    body: `## Driver Requirements

Become a SafeGo driver partner and start earning on your own schedule.

### Basic Requirements

- Age 21 years or older
- Valid National ID (NID)
- Valid driving license
- Smartphone with internet access
- Bank account or mobile wallet

### Vehicle Requirements

**For Motorbike:**
- Valid registration certificate
- Fitness certificate
- Insurance document
- Vehicle age: 10 years or less

**For Car:**
- Valid registration certificate
- Fitness certificate
- Tax token
- Insurance document
- Vehicle age: 15 years or less

### Documents Needed

1. National ID (front and back)
2. Driving license
3. Vehicle registration
4. Profile photo (clear, recent)
5. Vehicle photo (all sides)

### Verification Process

1. Submit application online
2. Upload required documents
3. Complete background verification
4. Attend onboarding session
5. Start earning!

### Earnings

- Competitive rates per trip
- Weekly settlements
- Performance bonuses
- Flexible hours

### Apply Now

Ready to join? Download the SafeGo Driver app and complete your registration.`
  },
  {
    slug: 'restaurant-partner-guide',
    title: 'Restaurant Partner Guide',
    category: 'partner',
    status: 'published',
    visibility: 'public_visible',
    metaDescription: 'Partner with SafeGo to grow your restaurant business with online orders and delivery.',
    metaKeywords: 'safego, restaurant, partner, food delivery, business',
    body: `## Restaurant Partner Guide

Join SafeGo's food delivery platform and reach more customers.

### Why Partner With Us?

- **Increased Visibility**: Reach thousands of hungry customers
- **Easy Management**: Simple dashboard to manage orders and menu
- **Reliable Delivery**: Our delivery partners handle logistics
- **Flexible Commission**: Competitive rates for partners

### Requirements

- Valid trade license
- Food safety certification
- Physical restaurant location
- Bank account for settlements

### How It Works

1. **Sign Up**: Complete the partner registration
2. **Set Up Menu**: Add your menu items and prices
3. **Receive Orders**: Get notified of new orders
4. **Prepare & Dispatch**: Prepare orders for pickup
5. **Get Paid**: Receive weekly settlements

### Commission Structure

- Standard commission: 15-25%
- No hidden fees
- Promotional support available

### Partner Dashboard

- Real-time order tracking
- Menu management
- Sales analytics
- Customer reviews
- Settlement reports

### Success Tips

- Keep your menu updated
- Respond to orders quickly
- Maintain quality standards
- Engage with customer feedback

### Get Started

Contact our partner team: partners@safego.com`
  }
];

async function seedCmsPages() {
  console.log('Seeding CMS pages...');
  
  for (const page of defaultPages) {
    const existing = await (prisma as any).cmsPage.findUnique({
      where: { slug: page.slug }
    });
    
    if (existing) {
      console.log(`Page "${page.slug}" already exists, skipping...`);
      continue;
    }
    
    await (prisma as any).cmsPage.create({
      data: page
    });
    console.log(`Created page: ${page.title}`);
  }
  
  console.log('CMS pages seeding complete!');
}

seedCmsPages()
  .catch((e) => {
    console.error('Error seeding CMS pages:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
