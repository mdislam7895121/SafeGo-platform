import { prisma } from '../lib/prisma';

async function seedLandingCms() {
  console.log('[LandingCMS Seed] Starting...');

  try {
    const existingGlobalPage = await (prisma as any).landingPage.findFirst({
      where: { country: 'GLOBAL' }
    });

    if (existingGlobalPage) {
      console.log('[LandingCMS Seed] GLOBAL page already exists, skipping seed');
      return;
    }

    const globalPage = await (prisma as any).landingPage.create({
      data: {
        country: 'GLOBAL',
        locale: 'en',
        isActive: true
      }
    });
    console.log('[LandingCMS Seed] Created GLOBAL landing page:', globalPage.id);

    const sections = [
      { key: 'hero', orderIndex: 0, isEnabled: true, title: 'Your Ride, Your Way', subtitle: 'Fast, reliable, and safe rides at your fingertips' },
      { key: 'services', orderIndex: 1, isEnabled: true, title: 'Our Services', subtitle: 'Everything you need, one app' },
      { key: 'how_it_works', orderIndex: 2, isEnabled: true, title: 'How It Works', subtitle: 'Getting started is easy' },
      { key: 'safety', orderIndex: 3, isEnabled: true, title: 'Your Safety Comes First', subtitle: 'Built with safety at the core' },
      { key: 'partners', orderIndex: 4, isEnabled: true, title: 'Drive & Earn', subtitle: 'Join our community of partners' },
      { key: 'faq', orderIndex: 5, isEnabled: true, title: 'Frequently Asked Questions', subtitle: 'Got questions? We have answers' },
      { key: 'ready_to_move', orderIndex: 6, isEnabled: true, title: 'Ready to Move?', subtitle: 'Download SafeGo and start your journey' }
    ];

    for (const section of sections) {
      await (prisma as any).landingSection.create({
        data: { landingPageId: globalPage.id, ...section }
      });
    }
    console.log('[LandingCMS Seed] Created', sections.length, 'sections');

    await (prisma as any).landingSettings.upsert({
      where: { country: 'GLOBAL' },
      update: {},
      create: {
        country: 'GLOBAL',
        showTestingBanner: false,
        defaultRegion: 'BD'
      }
    });
    console.log('[LandingCMS Seed] Created GLOBAL settings');

    const bdPage = await (prisma as any).landingPage.create({
      data: {
        country: 'BD',
        locale: 'en',
        isActive: true
      }
    });
    console.log('[LandingCMS Seed] Created BD landing page:', bdPage.id);

    const bdSections = [
      { key: 'hero', orderIndex: 0, isEnabled: true, title: 'Your Ride, Your Way', subtitle: 'Dhaka to anywhere, anytime' },
      { key: 'services', orderIndex: 1, isEnabled: true, title: 'Our Services', subtitle: 'Rides, food, parcels - all in one app' },
      { key: 'how_it_works', orderIndex: 2, isEnabled: true, title: 'How It Works', subtitle: 'Simple steps to get moving' },
      { key: 'safety', orderIndex: 3, isEnabled: true, title: 'Your Safety Comes First', subtitle: 'Verified drivers, real-time tracking' },
      { key: 'partners', orderIndex: 4, isEnabled: true, title: 'Drive & Earn in Bangladesh', subtitle: 'Become a SafeGo partner today' },
      { key: 'faq', orderIndex: 5, isEnabled: true, title: 'Common Questions', subtitle: 'Everything you need to know' },
      { key: 'ready_to_move', orderIndex: 6, isEnabled: true, title: 'Ready to SafeGo?', subtitle: 'Start earning or riding today' }
    ];

    for (const section of bdSections) {
      await (prisma as any).landingSection.create({
        data: { landingPageId: bdPage.id, ...section }
      });
    }
    console.log('[LandingCMS Seed] Created', bdSections.length, 'BD sections');

    await (prisma as any).landingSettings.upsert({
      where: { country: 'BD' },
      update: {},
      create: {
        country: 'BD',
        showTestingBanner: true,
        testingBannerText: 'SafeGo Bangladesh - Coming Soon to Dhaka',
        defaultRegion: 'BD',
        supportEmail: 'support@safego.com.bd',
        supportPhone: '+880-1234-567890'
      }
    });
    console.log('[LandingCMS Seed] Created BD settings');

    console.log('[LandingCMS Seed] Complete!');
  } catch (error) {
    console.error('[LandingCMS Seed] Error:', error);
    throw error;
  }
}

seedLandingCms()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
