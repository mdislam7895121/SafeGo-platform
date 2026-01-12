import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientDir = path.join(__dirname, 'client');

process.chdir(clientDir);

try {
  console.log('Installing dependencies...');
  execSync('npm ci', { stdio: 'inherit' });
  
  console.log('\n\nBuilding...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('\n\nBuild completed successfully!');
  
  // Check dist directory
  const distPath = path.join(clientDir, 'dist');
  if (fs.existsSync(distPath)) {
    const indexHtml = path.join(distPath, 'index.html');
    if (fs.existsSync(indexHtml)) {
      const content = fs.readFileSync(indexHtml, 'utf8');
      console.log(`\nindex.html size: ${content.length} bytes`);
      console.log('index.html contains /src/:', content.includes('/src/'));
    }
  }
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
