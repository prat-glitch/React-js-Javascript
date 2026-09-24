-- The owner approved removing the four retired Storage buckets and their data.
-- The buckets are emptied/deleted through the Storage API before this migration.
DROP POLICY IF EXISTS "Allow public deletions" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public viewing" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Chat media is publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Read participant attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update chat media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "allow public uploads  1oj01fe_0" ON storage.objects;
DROP POLICY IF EXISTS "allow public uploads  1oj01fe_1" ON storage.objects;
DROP POLICY IF EXISTS "allow public uploads  1oj01fe_2" ON storage.objects;
DROP POLICY IF EXISTS "allow public uploads  1oj01fe_3" ON storage.objects;
DROP POLICY IF EXISTS "allow uploads ph6blb_0" ON storage.objects;
DROP POLICY IF EXISTS "allow uploads ph6blb_1" ON storage.objects;
DROP POLICY IF EXISTS "auth users can read" ON storage.objects;
DROP POLICY IF EXISTS "auth users can upload" ON storage.objects;
