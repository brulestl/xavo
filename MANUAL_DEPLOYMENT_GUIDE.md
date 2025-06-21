# Manual Edge Functions Deployment Guide

Since Docker Desktop is not available, you can deploy the Edge Functions manually through the Supabase Dashboard.

## Step 1: Access Your Supabase Project
Go to: https://supabase.com/dashboard/project/wdhmlynmbrhunizbdhdt

## Step 2: Navigate to Edge Functions
Click on "Edge Functions" in the left sidebar

## Step 3: Create Chat Function
1. Click "Create a new function"
2. Function name: `chat`
3. Copy and paste the code from `supabase/functions/chat/index.ts`

## Step 4: Create Sessions Function  
1. Click "Create a new function"
2. Function name: `sessions`
3. Copy and paste the code from `supabase/functions/sessions/index.ts`

## Step 5: Test Your Functions
Your functions will be available at:
- Chat: `https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1/chat`
- Sessions: `https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1/sessions`

## Alternative: Install Docker Desktop
For automated deployments, install Docker Desktop:
1. Download: https://docs.docker.com/desktop/install/windows-install/
2. Install and start Docker Desktop
3. Run: `npm run deploy:functions`

## Function Code Files
- Chat Function: `supabase/functions/chat/index.ts`
- Sessions Function: `supabase/functions/sessions/index.ts`
- CORS Helper: `supabase/functions/_shared/cors.ts` 