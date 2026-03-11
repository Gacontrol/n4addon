/*
  # Create visu-images storage bucket
  
  Creates a public storage bucket for visualization background images.
  Allows authenticated users to upload images and public read access.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'visu-images',
  'visu-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read visu images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'visu-images');

CREATE POLICY "Authenticated upload visu images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'visu-images');

CREATE POLICY "Anon upload visu images"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'visu-images');

CREATE POLICY "Authenticated delete visu images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'visu-images');
