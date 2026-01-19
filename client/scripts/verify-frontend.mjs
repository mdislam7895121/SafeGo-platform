#!/usr/bin/env node
/**
 * Frontend Production Verification Script
 * Tests API config and health check endpoint
 */

import { API_BASE_URL, apiUrl, HEALTH_ENDPOINT } from './src/config/api.ts';
import { checkApiHealth } from './src/lib/healthCheck.ts';

console.log('🔍 SafeGo Frontend Verification\n');

// 1. Check API Config
console.log('1. API Configuration');
console.log(`   API_BASE_URL: ${API_BASE_URL}`);
console.log(`   Health endpoint: ${apiUrl(HEALTH_ENDPOINT)}\n`);

// 2. Test Health Check
console.log('2. Testing Health Check...');
try {
  const health = await checkApiHealth();
  
  if (health.ok) {
    console.log(`   ✅ API is healthy`);
    console.log(`   Status: ${health.status}`);
    console.log(`   Data:`, JSON.stringify(health.data, null, 2));
  } else {
    console.log(`   ❌ API health check failed`);
    console.log(`   Status: ${health.status}`);
    console.log(`   Error: ${health.error}`);
  }
} catch (error) {
  console.log(`   ❌ Health check threw error:`, error.message);
}

console.log('\n✅ Verification complete');
