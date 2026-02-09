#!/usr/bin/env node
/**
 * Update GitHub Variables from a local .vars.local file.
 * Reads VAR_NAME=value pairs and creates/updates GitHub Variables (not Secrets).
 * Skips lines starting with #, empty lines, and empty values.
 * 
 * Run: node scripts/update-github-vars-from-file.js
 * Requires: GitHub CLI (gh auth login)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = '.vars.local';

function findGhPath() {
  // Check if we're on Windows but gh is in WSL
  if (process.platform === 'win32') {
    // Try to use WSL to run gh
    try {
      execSync('wsl gh --version', { stdio: 'ignore' });
      return 'wsl gh';
    } catch {}
    
    // Try with explicit WSL distro
    try {
      execSync('wsl -d Ubuntu gh --version', { stdio: 'ignore' });
      return 'wsl -d Ubuntu gh';
    } catch {}
    
    // Try Windows gh installation
    try {
      execSync('gh --version', { stdio: 'ignore' });
      return 'gh';
    } catch {}
  }
  
  // Try direct execution first (Linux/Mac)
  try {
    execSync('gh --version', { 
      stdio: 'ignore', 
      shell: '/bin/bash',
      env: { ...process.env, PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin' }
    });
    return 'gh';
  } catch (e) {
    // Try to find gh using which
    try {
      const path = execSync('which gh', { 
        encoding: 'utf-8', 
        shell: '/bin/bash',
        env: { ...process.env, PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/home/' + (process.env.USER || process.env.HOME?.split('/').pop() || 'user') + '/.local/bin' }
      }).trim();
      if (path && path.length > 0) {
        return path;
      }
    } catch (e2) {}
    
    // Try common installation paths in WSL/Linux
    const user = process.env.USER || (process.env.HOME ? process.env.HOME.split('/').pop() : 'user');
    const commonPaths = [
      '/usr/bin/gh',
      '/usr/local/bin/gh',
      `/home/${user}/.local/bin/gh`,
      process.env.HOME ? `${process.env.HOME}/.local/bin/gh` : null,
      '/snap/bin/gh',
    ].filter(Boolean);
    
    for (const p of commonPaths) {
      try {
        execSync(`"${p}" --version`, { 
          stdio: 'ignore', 
          shell: '/bin/bash',
          env: process.env 
        });
        return p;
      } catch {}
    }
    
    return null;
  }
}

async function checkGhCli() {
  const ghPath = findGhPath();
  return ghPath !== null;
}

async function getRepo() {
  try {
    const remote = execSync('git remote get-url origin', { 
      encoding: 'utf-8',
      shell: process.platform === 'win32' ? undefined : '/bin/bash',
      env: process.env 
    }).trim();
    const match = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (match) return match[1];
  } catch {}
  return null;
}

function updateVariable(repo, name, value) {
  const ghPath = findGhPath();
  if (!ghPath) {
    console.error('Could not find gh command. Please ensure GitHub CLI is installed and in your PATH.');
    return false;
  }
  
  try {
    // Escape the value properly for shell
    const escapedValue = value.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
    
    // If using WSL, don't specify shell (let Windows handle it)
    // If on Linux/Mac, use bash
    const isWsl = ghPath.startsWith('wsl');
    const isWindows = process.platform === 'win32';
    const shell = (isWsl || isWindows) ? undefined : '/bin/bash';
    
    execSync(`${ghPath} variable set ${name} --repo ${repo} --body "${escapedValue}"`, { 
      stdio: 'inherit',
      shell: shell,
      env: process.env
    });
    return true;
  } catch (err) {
    console.error(`Failed to update ${name}:`, err.message);
    return false;
  }
}

function parseVarsFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const vars = {};
  
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (match) {
      const [, name, value] = match;
      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, '').trim();
      // Only include non-empty values
      if (cleanValue) {
        vars[name] = cleanValue;
      }
    }
  }
  
  return vars;
}

async function main() {
  console.log('Updating GitHub Variables from File\n');
  
  if (!(await checkGhCli())) {
    console.error('Error: GitHub CLI (gh) not found.');
    console.log('Install: https://cli.github.com/');
    console.log('Then run: gh auth login');
    process.exit(1);
  }
  
  let repo = await getRepo();
  if (!repo) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const repoInput = await new Promise(resolve => rl.question('Enter GitHub repo (owner/repo): ', resolve));
    rl.close();
    if (!repoInput) {
      console.error('Repo required');
      process.exit(1);
    }
    repo = repoInput;
  }
  
  const inputPath = path.join(process.cwd(), INPUT_FILE);
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: ${INPUT_FILE} not found`);
    console.log(`Run: npm run vars:export to create it`);
    process.exit(1);
  }
  
  console.log(`Repository: ${repo}`);
  console.log(`Reading from: ${INPUT_FILE}\n`);
  
  const vars = parseVarsFile(inputPath);
  
  if (Object.keys(vars).length === 0) {
    console.log('No variables found to update (all are empty)');
    process.exit(0);
  }
  
  console.log(`Found ${Object.keys(vars).length} variables to update:\n`);
  Object.keys(vars).forEach(name => {
    console.log(`  - ${name}`);
  });
  
  console.log('\nUpdating variables...\n');
  
  const updated = [];
  const failed = [];
  
  for (const [name, value] of Object.entries(vars)) {
    console.log(`Updating ${name}...`);
    if (updateVariable(repo, name, value)) {
      updated.push(name);
    } else {
      failed.push(name);
    }
  }
  
  console.log('\n--- Summary ---\n');
  console.log(`✅ Updated: ${updated.length} variables`);
  if (updated.length > 0) {
    updated.forEach(s => console.log(`   - ${s}`));
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length} variables`);
    failed.forEach(s => console.log(`   - ${s}`));
    process.exit(1);
  }
  
  console.log('\n✅ All variables updated successfully!');
  console.log('\nNote: These are GitHub Variables (not Secrets). They will be passed to the build automatically.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
