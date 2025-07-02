# 🧪 RAG Pipeline Testing Guide

## Current Issue: Network Request Failed

You're getting `TypeError: Network request failed` when uploading files. Let's debug this step by step.

## 🔍 **Quick Diagnosis**

The network errors suggest the Edge Functions aren't deployed yet. The new flow should work as follows:

1. **Select File** → File attaches but doesn't process (no network calls)
2. **Send Message** → Message sends, then file processes in background
3. **Processing** → Shows progress and completion status

## 📋 **Step-by-Step Testing**

### **Phase 1: Test File Attachment (Should Work Now)**

1. **Open your app** in Expo Go
2. **Start a new chat**
3. **Tap the attach button** (should be on the left now)
4. **Select a PDF or text file**
5. **Expected Result**: File shows as "Ready to process" with no network errors

### **Phase 2: Test Message Sending**

1. **Type a message** with the file attached
2. **Tap send**
3. **Expected Result**: 
   - Message appears in chat immediately
   - File starts showing "Processing document..." 
   - You'll get network errors here until Edge Functions are deployed

### **Phase 3: Deploy Edge Functions (Fix Network Errors)**

Follow these steps to deploy the RAG Edge Functions:

#### **Option A: Supabase Dashboard (Recommended)**

1. **Go to**: https://supabase.com/dashboard/project/wdhmlynmbrhunizbdhdt/functions

2. **Create `process-document` function**:
   - Click "Create a new function"
   - Name: `process-document`
   - Copy from: `supabase/functions/process-document/index.ts`
   - Deploy

3. **Create `query-document` function**:
   - Click "Create a new function" 
   - Name: `query-document`
   - Copy from: `supabase/functions/query-document/index.ts`
   - Deploy

4. **Set Environment Variables**:
   - Go to Project Settings → Edge Functions
   - Add: `OPENAI_API_KEY` = your OpenAI API key

#### **Option B: Using Supabase CLI**

```bash
# If you have Docker working
supabase login
supabase link --project-ref wdhmlynmbrhunizbdhdt
supabase functions deploy process-document
supabase functions deploy query-document
supabase secrets set OPENAI_API_KEY=sk-your-key-here
```

### **Phase 4: Database Setup**

Run the RAG schema migration:

1. **Go to**: https://supabase.com/dashboard/project/wdhmlynmbrhunizbdhdt/sql
2. **Copy and paste** the entire contents of `sql/create_rag_schema.sql`
3. **Run the query**

### **Phase 5: Storage Bucket Setup**

1. **Go to**: https://supabase.com/dashboard/project/wdhmlynmbrhunizbdhdt/storage
2. **Create bucket** named `documents`
3. **Set to private** (not public)

### **Phase 6: Full End-to-End Test**

After Edge Functions are deployed:

1. **Upload a PDF/text file**
2. **Send a message** → Should process successfully
3. **Ask a question** about the document
4. **Verify** you get answers with source citations

## 🐛 **Common Issues & Solutions**

### **Network Request Failed**
- **Cause**: Edge Functions not deployed
- **Solution**: Deploy functions via Supabase Dashboard

### **File Too Large**
- **Cause**: File over 10MB
- **Solution**: Use smaller files for testing

### **Processing Stuck**
- **Cause**: Missing OpenAI API key
- **Solution**: Set OPENAI_API_KEY in Edge Functions environment

### **No Database Tables**
- **Cause**: Migration not run
- **Solution**: Execute `sql/create_rag_schema.sql`

### **Storage Errors**
- **Cause**: Documents bucket doesn't exist
- **Solution**: Create `documents` bucket in Storage

## 📱 **Test Files**

For testing, use these file types:

### **✅ Good Test Files:**
- Small PDF (under 5MB)
- Plain text (.txt) file
- Word document (.docx)

### **❌ Avoid for Testing:**
- Large files (over 10MB)
- Scanned PDFs (images, not text)
- Encrypted/password-protected files

## 📊 **Expected Results**

### **Before Edge Functions Deployed:**
```
✅ File attaches successfully
✅ Shows "Ready to process"
❌ Network error when sending message
```

### **After Edge Functions Deployed:**
```
✅ File attaches successfully  
✅ Message sends immediately
✅ Background processing starts
✅ Shows processing progress
✅ Completion notification
✅ Can ask questions about document
```

## 🔧 **Debug Commands**

### **Check Edge Function Logs:**
```bash
# View real-time logs
supabase functions logs --follow

# View specific function logs  
supabase functions logs process-document
supabase functions logs query-document
```

### **Test Edge Functions Directly:**
```bash
# Test process-document
curl -X POST 'https://wdhmlynmbrhunizbdhdt.supabase.co/functions/v1/process-document' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"documentId": "test"}'

# Should return function response or 404 if not deployed
```

## 🎯 **Next Steps**

1. **Test file attachment** (should work now with no network errors)
2. **Deploy Edge Functions** to fix processing errors
3. **Run database migration** for full functionality
4. **Test end-to-end** document upload and querying

## 📞 **Get Help**

If issues persist:

1. **Check browser console** for additional error details
2. **Look at Expo logs** for network error specifics  
3. **Verify Supabase project** is accessible
4. **Test with minimal text file** first

The new flow separates attachment from processing, so you should see immediate improvement in the file attachment experience! 🚀 