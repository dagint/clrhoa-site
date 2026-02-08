#!/usr/bin/env node
/**
 * Generate Subresource Integrity (SRI) hashes for external resources
 * 
 * Usage:
 *   node scripts/generate-sri.js <url>
 * 
 * Example:
 *   node scripts/generate-sri.js https://challenges.cloudflare.com/turnstile/v0/api.js
 */

import https from 'https';
import crypto from 'crypto';

const url = process.argv[2];

if (!url) {
  console.error('Usage: node scripts/generate-sri.js <url>');
  process.exit(1);
}

function generateSRI(content) {
  const hash = crypto.createHash('sha384').update(content).digest('base64');
  return `sha384-${hash}`;
}

function fetchAndHash(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          // Handle relative redirects
          const fullUrl = redirectUrl.startsWith('http') 
            ? redirectUrl 
            : new URL(redirectUrl, url).href;
          console.log(`Following redirect to: ${fullUrl}`);
          return fetchAndHash(fullUrl).then(resolve).catch(reject);
        }
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch: ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const sri = generateSRI(data);
        console.log(`\nURL: ${url}`);
        console.log(`SRI Hash: ${sri}`);
        console.log(`\nAdd to script tag:`);
        console.log(`integrity="${sri}"`);
        console.log(`crossorigin="anonymous"`);
        resolve(sri);
      });
    }).on('error', (err) => {
      reject(err);
    });

    // Handle redirects at the request level
    request.on('redirect', (res) => {
      if (typeof request.destroy === 'function') request.destroy();
      else request.abort?.();
      const redirectUrl = res.headers.location;
      if (redirectUrl) {
        const fullUrl = redirectUrl.startsWith('http') 
          ? redirectUrl 
          : new URL(redirectUrl, url).href;
        console.log(`Following redirect to: ${fullUrl}`);
        fetchAndHash(fullUrl).then(resolve).catch(reject);
      }
    });
  });
}

fetchAndHash(url)
  .then(() => {
    console.log('\n✅ SRI hash generated successfully');
    console.log('\n⚠️  Note: SRI hashes change when scripts update.');
    console.log('   Update the integrity attribute when scripts are updated.\n');
  })
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
