#!/usr/bin/env node

/**
 * Automated Cleanup Script for Soft-Deleted Conversation Sessions
 * 
 * This script automatically removes conversation sessions that have been
 * soft-deleted for more than 30 days. It can be run as a cron job.
 * 
 * Usage:
 *   node cleanup-deleted-sessions.js [--days=30] [--batch-size=100] [--dry-run]
 * 
 * Options:
 *   --days=N          Delete sessions older than N days (default: 30)
 *   --batch-size=N    Process N sessions per batch (default: 100)
 *   --dry-run         Show what would be deleted without actually deleting
 *   --verbose         Show detailed logging
 * 
 * Environment Variables:
 *   SUPABASE_URL      Your Supabase project URL
 *   SUPABASE_ANON_KEY Your Supabase anon key (for RPC calls)
 *   SUPABASE_SERVICE_ROLE_KEY Your Supabase service role key (recommended)
 */

const { createClient } = require('@supabase/supabase-js');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  days: 30,
  batchSize: 100,
  dryRun: false,
  verbose: false,
};

args.forEach(arg => {
  if (arg.startsWith('--days=')) {
    options.days = parseInt(arg.split('=')[1]) || 30;
  } else if (arg.startsWith('--batch-size=')) {
    options.batchSize = parseInt(arg.split('=')[1]) || 100;
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--verbose') {
    options.verbose = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Automated Cleanup Script for Soft-Deleted Conversation Sessions

Usage: node cleanup-deleted-sessions.js [options]

Options:
  --days=N          Delete sessions older than N days (default: 30)
  --batch-size=N    Process N sessions per batch (default: 100)
  --dry-run         Show what would be deleted without actually deleting
  --verbose         Show detailed logging
  --help, -h        Show this help message

Environment Variables:
  SUPABASE_URL              Your Supabase project URL
  SUPABASE_ANON_KEY         Your Supabase anon key
  SUPABASE_SERVICE_ROLE_KEY Your Supabase service role key (recommended)

Examples:
  node cleanup-deleted-sessions.js --dry-run
  node cleanup-deleted-sessions.js --days=14 --batch-size=50
  node cleanup-deleted-sessions.js --verbose
    `);
    process.exit(0);
  }
});

// Validate environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing required environment variables');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function getSessionsScheduledForDeletion(daysOld = 30) {
  try {
    const { data, error } = await supabase
      .rpc('get_sessions_scheduled_for_deletion', { 
        p_days_remaining: daysOld 
      });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching sessions scheduled for deletion:', error.message);
    throw error;
  }
}

async function performCleanup(daysOld = 30, batchSize = 100, dryRun = false) {
  try {
    if (dryRun) {
      console.log('🧪 DRY RUN MODE - No actual deletions will be performed');
    }

    const { data, error } = await supabase
      .rpc('cleanup_old_conversations_with_logging', { 
        days_old: daysOld,
        batch_size: batchSize
      });

    if (error) throw error;

    return data[0] || { 
      sessions_deleted: 0, 
      messages_deleted: 0, 
      contexts_deleted: 0, 
      cleanup_details: { message: "No sessions found for cleanup" }
    };
  } catch (error) {
    console.error('❌ Error performing cleanup:', error.message);
    throw error;
  }
}

async function getCleanupLogs(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('conversation_cleanup_log')
      .select('*')
      .order('cleanup_timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching cleanup logs:', error.message);
    return [];
  }
}

async function main() {
  const startTime = new Date();
  
  console.log('🧹 Starting Conversation Cleanup Script');
  console.log(`📅 Date: ${startTime.toISOString()}`);
  console.log(`⚙️  Configuration:`);
  console.log(`   - Days threshold: ${options.days}`);
  console.log(`   - Batch size: ${options.batchSize}`);
  console.log(`   - Dry run: ${options.dryRun ? 'Yes' : 'No'}`);
  console.log(`   - Verbose: ${options.verbose ? 'Yes' : 'No'}`);
  console.log('');

  try {
    // Step 1: Show sessions scheduled for deletion
    if (options.verbose || options.dryRun) {
      console.log('🔍 Checking sessions scheduled for deletion...');
      const scheduledSessions = await getSessionsScheduledForDeletion(options.days);
      
      if (scheduledSessions.length > 0) {
        console.log(`📋 Found ${scheduledSessions.length} sessions eligible for deletion:`);
        scheduledSessions.forEach(session => {
          console.log(`   - ${session.session_id}: "${session.title || 'Untitled'}" (deleted ${session.days_until_deletion} days ago)`);
        });
        console.log('');
      } else {
        console.log('✅ No sessions found that are eligible for deletion');
        console.log('');
      }
    }

    // Step 2: Perform cleanup (unless dry run)
    if (!options.dryRun) {
      console.log('🗑️  Executing cleanup...');
      const result = await performCleanup(options.days, options.batchSize, options.dryRun);
      
      console.log('✅ Cleanup completed successfully!');
      console.log(`📊 Results:`);
      console.log(`   - Sessions deleted: ${result.sessions_deleted}`);
      console.log(`   - Messages deleted: ${result.messages_deleted}`);
      console.log(`   - Contexts deleted: ${result.contexts_deleted}`);
      
      if (options.verbose && result.cleanup_details) {
        console.log(`📋 Details:`, JSON.stringify(result.cleanup_details, null, 2));
      }
    } else {
      console.log('🧪 Dry run completed - no actual deletions performed');
    }

    // Step 3: Show recent cleanup history (if verbose)
    if (options.verbose) {
      console.log('');
      console.log('📜 Recent cleanup history:');
      const logs = await getCleanupLogs(5);
      
      if (logs.length > 0) {
        logs.forEach(log => {
          console.log(`   ${log.cleanup_timestamp}: ${log.sessions_deleted} sessions, ${log.messages_deleted} messages (${log.execution_time_ms}ms)`);
        });
      } else {
        console.log('   No cleanup history found');
      }
    }

    const endTime = new Date();
    const duration = endTime - startTime;
    
    console.log('');
    console.log(`⏱️  Script completed in ${duration}ms`);
    console.log(`🎉 Cleanup script finished successfully!`);
    
  } catch (error) {
    console.error('');
    console.error('❌ Cleanup script failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Cleanup script interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Cleanup script terminated');
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { main, getSessionsScheduledForDeletion, performCleanup }; 