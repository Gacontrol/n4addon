/*
  # Create models-3d storage bucket

  Creates a public storage bucket for user-uploaded 3D GLB/GLTF models used
  in the 3D building visualization.

  ## Changes
  1. Storage
     - New bucket `models-3d` (public read) with 50 MB size limit
     - Allowed MIME types for glb/gltf (also common binary/json fallbacks)
  2. Security / Policies
     - Public read on objects in `models-3d`
     - Authenticated + anon users may upload into `models-3d`
     - Authenticated users may delete from `models-3d`

  ## Notes
  1. Public read is intended so uploaded 3D models can be fetched by the
     Three.js GLTFLoader without auth
  2. Size limit of 50 MB is sufficient for typical GLB assets
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'models-3d',
  'models-3d',
  true,
  52428800,
  ARRAY[
    'model/gltf-binary',
    'model/gltf+json',
    'application/octet-stream',
    'application/json'
  ]
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public read models 3d' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Public read models 3d"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'models-3d');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated upload models 3d' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated upload models 3d"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'models-3d');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anon upload models 3d' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Anon upload models 3d"
      ON storage.objects FOR INSERT
      TO anon
      WITH CHECK (bucket_id = 'models-3d');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated delete models 3d' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated delete models 3d"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'models-3d');
  END IF;
END $$;
