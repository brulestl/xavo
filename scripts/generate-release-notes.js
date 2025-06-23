#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function generateReleaseNotes() {
  console.log('📝 Generating release notes from git commits...\n');
  
  try {
    // Get the latest tag
    let lastTag;
    try {
      lastTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
      console.log(`📌 Last tag: ${lastTag}`);
    } catch (error) {
      console.log('📌 No previous tags found, using all commits');
      lastTag = null;
    }
    
    // Get commits since last tag (or all commits if no tag)
    const gitCommand = lastTag 
      ? `git log ${lastTag}..HEAD --pretty=format:"%s" --no-merges`
      : 'git log --pretty=format:"%s" --no-merges -10'; // Last 10 commits if no tags
    
    const commits = execSync(gitCommand, { encoding: 'utf8' })
      .split('\n')
      .filter(line => line.trim())
      .filter(line => !line.toLowerCase().includes('merge'))
      .slice(0, 20); // Limit to 20 commits
    
    if (commits.length === 0) {
      console.log('ℹ️  No new commits found since last tag');
      return;
    }
    
    console.log(`📋 Found ${commits.length} commits to process\n`);
    
    // Categorize commits
    const categories = {
      features: [],
      fixes: [],
      improvements: [],
      other: []
    };
    
    commits.forEach(commit => {
      const lower = commit.toLowerCase();
      if (lower.includes('feat') || lower.includes('add') || lower.includes('new')) {
        categories.features.push(commit);
      } else if (lower.includes('fix') || lower.includes('bug') || lower.includes('resolve')) {
        categories.fixes.push(commit);
      } else if (lower.includes('improve') || lower.includes('update') || lower.includes('enhance') || lower.includes('optimize')) {
        categories.improvements.push(commit);
      } else {
        categories.other.push(commit);
      }
    });
    
    // Generate release notes
    let releaseNotes = '';
    
    if (categories.features.length > 0) {
      releaseNotes += '✨ New Features:\n';
      categories.features.forEach(commit => {
        releaseNotes += `• ${cleanCommitMessage(commit)}\n`;
      });
      releaseNotes += '\n';
    }
    
    if (categories.improvements.length > 0) {
      releaseNotes += '🔧 Improvements:\n';
      categories.improvements.forEach(commit => {
        releaseNotes += `• ${cleanCommitMessage(commit)}\n`;
      });
      releaseNotes += '\n';
    }
    
    if (categories.fixes.length > 0) {
      releaseNotes += '🐛 Bug Fixes:\n';
      categories.fixes.forEach(commit => {
        releaseNotes += `• ${cleanCommitMessage(commit)}\n`;
      });
      releaseNotes += '\n';
    }
    
    if (categories.other.length > 0) {
      releaseNotes += '📋 Other Changes:\n';
      categories.other.forEach(commit => {
        releaseNotes += `• ${cleanCommitMessage(commit)}\n`;
      });
    }
    
    // Trim trailing newlines
    releaseNotes = releaseNotes.trim();
    
    console.log('Generated Release Notes:');
    console.log('========================');
    console.log(releaseNotes);
    console.log('========================\n');
    
    // Update store.json
    const metadataPath = path.join(process.cwd(), 'store.json');
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        
        // Update iOS release notes
        if (metadata.apple && metadata.apple.info) {
          for (const locale of Object.keys(metadata.apple.info)) {
            metadata.apple.info[locale].releaseNotes = releaseNotes;
          }
        }
        
        // Update Android release notes (with length limit)
        if (metadata.googlePlay && metadata.googlePlay.info) {
          const androidReleaseNotes = releaseNotes.length > 500 
            ? releaseNotes.substring(0, 497) + '...' 
            : releaseNotes;
          
          for (const locale of Object.keys(metadata.googlePlay.info)) {
            metadata.googlePlay.info[locale].releaseNotes = androidReleaseNotes;
          }
        }
        
        // Write updated metadata
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        console.log('✅ Updated store.json with new release notes');
        
      } catch (error) {
        console.error('❌ Error updating store.json:', error.message);
      }
    } else {
      console.log('⚠️  store.json not found, skipping automatic update');
    }
    
    // Also save to a separate file for manual use
    const releaseNotesPath = path.join(process.cwd(), 'RELEASE_NOTES.md');
    const version = getCurrentVersion();
    const fullReleaseNotes = `# Release Notes - v${version}\n\n${releaseNotes}\n`;
    
    fs.writeFileSync(releaseNotesPath, fullReleaseNotes);
    console.log(`📄 Saved release notes to RELEASE_NOTES.md`);
    
  } catch (error) {
    console.error('❌ Error generating release notes:', error.message);
    process.exit(1);
  }
}

function cleanCommitMessage(commit) {
  // Remove common prefixes and clean up the message
  return commit
    .replace(/^(feat|fix|chore|docs|style|refactor|test|build)(\(.+\))?:\s*/i, '')
    .replace(/^(add|update|fix|improve|remove|delete):\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCurrentVersion() {
  try {
    const packagePath = path.join(process.cwd(), 'app.json');
    if (fs.existsSync(packagePath)) {
      const appConfig = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return appConfig.expo?.version || '1.0.0';
    }
  } catch (error) {
    console.log('⚠️  Could not read version from app.json');
  }
  return '1.0.0';
}

// Command line options
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node generate-release-notes.js [options]

Options:
  --help, -h     Show this help message

This script generates release notes from git commits since the last tag
and automatically updates store.json with the new release notes.
`);
  process.exit(0);
}

// Run the script
generateReleaseNotes(); 