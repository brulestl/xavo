# 🚀 Quick Deploy Instructions

## 📋 Files Ready for Copy-Paste

I've created two separate files for easy deployment:

1. **`chat-function.ts`** - Complete chat function code
2. **`sessions-function.ts`** - Complete sessions function code

## ⚡ Deploy Steps

### 1. Open Supabase Dashboard
Go to: https://supabase.com/dashboard/project/wdhmlynmbrhunizbdhdt

### 2. Navigate to Edge Functions
Click "Edge Functions" in the left sidebar

### 3. Deploy Chat Function
1. Click "Create a new function"
2. Function name: `chat`
3. Open `chat-function.ts` file
4. Select all code (Ctrl+A) and copy (Ctrl+C)
5. Paste into Supabase function editor
6. Click "Deploy function"

### 4. Deploy Sessions Function
1. Click "Create a new function"  
2. Function name: `sessions`
3. Open `sessions-function.ts` file
4. Select all code (Ctrl+A) and copy (Ctrl+C)
5. Paste into Supabase function editor
6. Click "Deploy function"

## ✅ After Deployment

Your functions will be live at:
- **Chat**: `https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1/chat`
- **Sessions**: `https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1/sessions`

## 🔧 Environment Variables

Make sure your Supabase project has:
- `OPENAI_API_KEY` set in Project Settings → Edge Functions

## 🎉 Ready to Use

Your app is already configured to use these URLs. Once deployed, your AI chat will work with production-grade serverless backend!

---

*Note: The linter errors in the .ts files are expected - they're Deno files, not Node.js files.* 