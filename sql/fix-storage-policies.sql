-- Fix Storage RLS Policies for Documents Bucket
-- Run this in Supabase SQL Editor

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;

-- Create storage policies for the documents bucket
-- Policy 1: Users can upload files to the documents bucket
CREATE POLICY "Users can upload documents" ON storage.objects
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents' 
    AND (storage.foldername(name))[1] = 'uploads'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

-- Policy 2: Users can view their own uploaded documents
CREATE POLICY "Users can view their own documents" ON storage.objects
  FOR SELECT 
  TO authenticated
  USING (
    bucket_id = 'documents' 
    AND (storage.foldername(name))[1] = 'uploads'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

-- Policy 3: Users can update their own uploaded documents
CREATE POLICY "Users can update their own documents" ON storage.objects
  FOR UPDATE 
  TO authenticated
  USING (
    bucket_id = 'documents' 
    AND (storage.foldername(name))[1] = 'uploads'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

-- Policy 4: Users can delete their own uploaded documents
CREATE POLICY "Users can delete their own documents" ON storage.objects
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

-- Verify the bucket exists and has correct settings
UPDATE storage.buckets 
SET public = false 
WHERE id = 'documents';

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, false, 10485760, ARRAY['application/pdf', 'text/plain', 'text/csv', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING; 