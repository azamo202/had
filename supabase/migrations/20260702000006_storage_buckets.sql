-- Storage Buckets Configuration

-- Insert 'evidence_files' bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence_files',
  'evidence_files',
  false, -- private bucket
  10485760, -- 10MB limit
  ARRAY['image/png', 'image/jpeg', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS Policies for Storage
-- Note: 'storage.objects' is the table for files.

-- Enable RLS (Should be enabled by default in Supabase, but just in case)
-- Policy: Allow authenticated users to upload files to 'evidence_files'
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'evidence_files');

-- Policy: Allow authenticated users to view files in 'evidence_files'
CREATE POLICY "Allow authenticated view"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'evidence_files');
