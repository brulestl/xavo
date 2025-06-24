-- Storage Policies Setup for RAG Documents
-- Run this in Supabase SQL Editor

-- Create the documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 
  'documents', 
  false, 
  false, 
  2097152, -- 2MB in bytes
  ARRAY[
    'application/pdf',
    'text/plain',
    'text/csv', 
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their documents" ON storage.objects;

-- Policy 1: Users can upload files to their own folder in documents bucket
CREATE POLICY "Users can upload their documents" ON storage.objects
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents' 
    AND (storage.foldername(name))[1] = 'uploads'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

-- Policy 2: Users can view files in their own folder
CREATE POLICY "Users can view their documents" ON storage.objects
  FOR SELECT 
  TO authenticated
  USING (
    bucket_id = 'documents' 
    AND (storage.foldername(name))[1] = 'uploads'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

-- Policy 3: Users can update files in their own folder
CREATE POLICY "Users can update their documents" ON storage.objects
  FOR UPDATE 
  TO authenticated
  USING (
    bucket_id = 'documents' 
    AND (storage.foldername(name))[1] = 'uploads'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

-- Policy 4: Users can delete files in their own folder
CREATE POLICY "Users can delete their documents" ON storage.objects
  FOR DELETE 
  TO authenticated
  USING (
    bucket_id = 'documents' 
    AND (storage.foldername(name))[1] = 'uploads'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

-- Grant necessary permissions
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated; 