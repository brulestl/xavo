# Storage Setup Guide for RAG Documents

This guide shows how to set up storage policies for document uploads using the Supabase Dashboard UI (since SQL access to storage.objects is restricted).

## Step 1: Create Documents Storage Bucket

1. **Go to your Supabase Dashboard**
2. **Navigate to Storage** in the left sidebar
3. **Click "New bucket"**
4. **Configure the bucket:**
   - **Name**: `documents`
   - **Public bucket**: ❌ **Turn OFF** (keep it private)
   - **File size limit**: `2097152` (2MB in bytes)
   - **Allowed MIME types**: 
     ```
     application/pdf
     text/plain
     text/csv
     application/msword
     application/vnd.openxmlformats-officedocument.wordprocessingml.document
     ```
5. **Click "Create bucket"**

## Step 2: Set Up Storage Policies

1. **In Storage, click on your `documents` bucket**
2. **Go to the "Policies" tab**
3. **Click "Add policy"** for each of the following:

### Policy 1: Upload Policy
- **Policy name**: `Users can upload their documents`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **USING expression**: Leave empty
- **WITH CHECK expression**:
  ```sql
  (bucket_id = 'documents') AND 
  ((storage.foldername(name))[1] = 'uploads') AND 
  (auth.uid()::text = (storage.foldername(name))[2])
  ```

### Policy 2: Read Policy
- **Policy name**: `Users can view their documents`
- **Allowed operation**: `SELECT`
- **Target roles**: `authenticated`
- **USING expression**:
  ```sql
  (bucket_id = 'documents') AND 
  ((storage.foldername(name))[1] = 'uploads') AND 
  (auth.uid()::text = (storage.foldername(name))[2])
  ```

### Policy 3: Update Policy
- **Policy name**: `Users can update their documents`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **USING expression**:
  ```sql
  (bucket_id = 'documents') AND 
  ((storage.foldername(name))[1] = 'uploads') AND 
  (auth.uid()::text = (storage.foldername(name))[2])
  ```

### Policy 4: Delete Policy
- **Policy name**: `Users can delete their documents`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **USING expression**:
  ```sql
  (bucket_id = 'documents') AND 
  ((storage.foldername(name))[1] = 'uploads') AND 
  (auth.uid()::text = (storage.foldername(name))[2])
  ```

## Step 3: Enable RLS (if not already enabled)

1. **Go to Database > Tables** in your Supabase dashboard
2. **Find the `objects` table** (it might be in the `storage` schema)
3. **Click on the table**
4. **Look for "Enable RLS"** toggle and make sure it's **ON**

## Step 4: Test Upload

After setting up the policies, test file upload in your React Native app. You should see:

```
🚀 Starting robust RAG document upload for: document.pdf
🔍 Reading file as buffer from URI: file://...
✅ Buffer created successfully, size: 1234
☁️ Uploading to Supabase storage with Buffer...
✅ File uploaded successfully
💾 Saving document metadata to database...
✅ Document metadata saved
```

## Troubleshooting

### If you still get "Unauthorized" errors:

1. **Check bucket name**: Must be exactly `documents`
2. **Check file path**: Should be `uploads/{user_id}/{filename}`
3. **Check user authentication**: User must be logged in
4. **Check file size**: Must be under 2MB
5. **Check MIME type**: Must be in allowed types list

### If policies don't appear to work:

1. **Wait 1-2 minutes** for policies to propagate
2. **Refresh your app** (restart if needed)
3. **Check the policy expressions** for typos
4. **Verify the user is authenticated** before upload

## File Path Structure

The policies expect files to be uploaded in this structure:
```
documents/
  uploads/
    {user_id}/
      {timestamp}_{unique_id}_{filename}
```

Example:
```
documents/uploads/884e627b-8049-41cb-ad9c-c880aa188345/1750801586489_65fe83e6_document.pdf
```

## File Size and Type Limits

- **Maximum file size**: 2MB (2,097,152 bytes)
- **Allowed types**:
  - PDF files (`.pdf`)
  - Text files (`.txt`)
  - CSV files (`.csv`) 
  - Word documents (`.doc`, `.docx`)

These limits are enforced at both the storage bucket level and in the app validation. 