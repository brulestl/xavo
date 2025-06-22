import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface CleanupOptions {
  days_old?: number;
  batch_size?: number;
  dry_run?: boolean;
  verbose?: boolean;
}

interface CleanupResult {
  sessions_deleted: number;
  messages_deleted: number;
  contexts_deleted: number;
  cleanup_details: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Parse request options (for manual calls with parameters)
    let options: CleanupOptions = {
      days_old: 30,
      batch_size: 100,
      dry_run: false,
      verbose: false
    };

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        options = { ...options, ...body };
      } catch {
        // If no body, use defaults
      }
    }

    // Parse URL parameters (for GET requests with query params)
    const url = new URL(req.url);
    const daysParam = url.searchParams.get('days');
    const batchParam = url.searchParams.get('batch_size');
    const dryRunParam = url.searchParams.get('dry_run');
    const verboseParam = url.searchParams.get('verbose');

    if (daysParam) options.days_old = parseInt(daysParam) || 30;
    if (batchParam) options.batch_size = parseInt(batchParam) || 100;
    if (dryRunParam) options.dry_run = dryRunParam === 'true';
    if (verboseParam) options.verbose = verboseParam === 'true';

    console.log('🧹 Starting conversation cleanup with options:', options);

    // Get sessions scheduled for deletion (for reporting)
    let scheduledSessions = [];
    if (options.verbose || options.dry_run) {
      const { data: scheduled, error: scheduledError } = await supabaseClient
        .rpc('get_sessions_scheduled_for_deletion', { 
          p_days_remaining: options.days_old 
        });

      if (scheduledError) {
        console.error('Error fetching scheduled sessions:', scheduledError);
      } else {
        scheduledSessions = scheduled || [];
      }
    }

    // Perform cleanup (or dry run)
    let cleanupResult: CleanupResult;

    if (options.dry_run) {
      // For dry run, just return what would be deleted
      cleanupResult = {
        sessions_deleted: scheduledSessions.length,
        messages_deleted: 0, // Would need to count these
        contexts_deleted: 0, // Would need to count these
        cleanup_details: {
          message: "DRY RUN - No actual deletions performed",
          sessions_that_would_be_deleted: scheduledSessions.map(s => ({
            id: s.session_id,
            title: s.title,
            days_until_deletion: s.days_until_deletion
          }))
        }
      };
    } else {
      // Perform actual cleanup
      const { data, error } = await supabaseClient
        .rpc('cleanup_old_conversations_with_logging', { 
          days_old: options.days_old,
          batch_size: options.batch_size
        });

      if (error) {
        console.error('Cleanup error:', error);
        throw error;
      }

      cleanupResult = data?.[0] || {
        sessions_deleted: 0,
        messages_deleted: 0,
        contexts_deleted: 0,
        cleanup_details: { message: "No sessions found for cleanup" }
      };
    }

    // Build response
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      options: options,
      scheduled_sessions_found: scheduledSessions.length,
      result: cleanupResult,
      ...(options.verbose && {
        scheduled_sessions: scheduledSessions.slice(0, 10), // Limit to first 10 for response size
        execution_mode: options.dry_run ? 'DRY_RUN' : 'LIVE'
      })
    };

    console.log('✅ Cleanup completed:', {
      sessions_deleted: cleanupResult.sessions_deleted,
      messages_deleted: cleanupResult.messages_deleted,
      contexts_deleted: cleanupResult.contexts_deleted,
      dry_run: options.dry_run
    });

    return new Response(JSON.stringify(response, null, 2), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      }
    });

  } catch (error) {
    console.error('❌ Cleanup function error:', error);
    
    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      stack: error.stack
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      }
    });
  }
})

/* 
USAGE EXAMPLES:

1. Basic cleanup (30 days, batch size 100):
   curl -X POST https://your-project.supabase.co/functions/v1/cleanup-conversations

2. Custom parameters via POST body:
   curl -X POST https://your-project.supabase.co/functions/v1/cleanup-conversations \
   -H "Content-Type: application/json" \
   -d '{"days_old": 14, "batch_size": 50, "verbose": true}'

3. Dry run via query parameters:
   curl "https://your-project.supabase.co/functions/v1/cleanup-conversations?dry_run=true&verbose=true"

4. Custom retention period via URL:
   curl "https://your-project.supabase.co/functions/v1/cleanup-conversations?days=7&batch_size=25"

CRON JOB EXAMPLES:

1. Daily cleanup at 2 AM:
   0 2 * * * curl -X POST https://your-project.supabase.co/functions/v1/cleanup-conversations

2. Weekly cleanup with verbose logging:
   0 2 * * 0 curl "https://your-project.supabase.co/functions/v1/cleanup-conversations?verbose=true" >> /var/log/cleanup.log

3. GitHub Actions workflow:
   - name: Daily Cleanup
     run: |
       curl -X POST https://your-project.supabase.co/functions/v1/cleanup-conversations \
       -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
*/ 