const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const STATE = process.argv[2] || 'BEFORE';

const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
];

async function login(page) {
  console.log('Navigating to login page...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('Current URL:', page.url());
  
  const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i]');
  const passwordInput = await page.$('input[type="password"], input[name="password"]');
  
  if (!emailInput || !passwordInput) {
    console.log('Could not find login form elements');
    const html = await page.content();
    console.log('Page HTML snippet:', html.substring(0, 500));
    return false;
  }
  
  console.log('Entering credentials...');
  await emailInput.type('customer.us@demo.com', { delay: 50 });
  await passwordInput.type('demo123', { delay: 50 });
  
  console.log('Clicking submit...');
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
    await new Promise(r => setTimeout(r, 3000));
  }
  
  console.log('After login URL:', page.url());
  return true;
}

async function takeScreenshots() {
  const outputDir = path.join(__dirname, '..', 'docs', 'screenshots', STATE.toLowerCase());
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Taking ${STATE} screenshots...`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Base URL: ${BASE_URL}`);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  for (const viewport of VIEWPORTS) {
    console.log(`\n=== Viewport: ${viewport.name} (${viewport.width}x${viewport.height}) ===`);
    const page = await browser.newPage();
    await page.setViewport({ width: viewport.width, height: viewport.height });
    
    try {
      const loggedIn = await login(page);
      
      if (!loggedIn) {
        console.log('Login failed, taking screenshot of current state...');
      }
      
      console.log(`Navigating to /customer...`);
      await page.goto(`${BASE_URL}/customer`, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
      
      console.log('Final URL:', page.url());
      
      const filename = `customer-booking-${viewport.name}.png`;
      const filepath = path.join(outputDir, filename);
      
      await page.screenshot({ path: filepath, fullPage: true });
      console.log(`Saved: ${filename}`);
      
    } catch (error) {
      console.error(`Error at ${viewport.name}:`, error.message);
    }
    
    await page.close();
  }

  await browser.close();
  console.log(`\n${STATE} screenshots complete!`);
}

takeScreenshots().catch(console.error);
