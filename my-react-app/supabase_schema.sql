-- Create the uploads table
CREATE TABLE uploads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL,
  content text NOT NULL,
  file_url text,
  category text NOT NULL DEFAULT 'prelims',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: Run this line if the table already exists:
-- ALTER TABLE uploads ADD COLUMN category text NOT NULL DEFAULT 'prelims';

-- Create the marks table with a foreign key to uploads
CREATE TABLE marks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id uuid REFERENCES uploads(id) ON DELETE CASCADE,
  attempt integer NOT NULL,
  marks integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create a storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('pdfs', 'pdfs', true);

-- Create storage policies to allow public access (for testing purposes)
CREATE POLICY "Allow public read access" ON storage.objects FOR SELECT USING (bucket_id = 'pdfs');
CREATE POLICY "Allow public insert access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pdfs');
