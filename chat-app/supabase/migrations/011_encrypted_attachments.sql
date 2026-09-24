INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('message-attachments', 'message-attachments', FALSE, 20971536)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Send encrypted message attachments" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'message-attachments'
  AND (storage.foldername(name))[1] = auth.jwt() ->> 'sub'
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.uid = (storage.foldername(name))[2])
);
CREATE POLICY "Read participant attachments" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'message-attachments'
  AND (auth.jwt() ->> 'sub') IN ((storage.foldername(name))[1], (storage.foldername(name))[2])
);
