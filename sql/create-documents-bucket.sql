-- Create Documents Bucket for RAG
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

-- Verify the bucket was created
SELECT * FROM storage.buckets WHERE id = 'documents'; 