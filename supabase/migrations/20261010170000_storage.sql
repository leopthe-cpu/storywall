-- File storage (migration Phase 2). Replaces Base44's private and public
-- file uploads.
--
--   drafts        private. Media placed in the builder while a story is a
--                 draft (Base44 UploadPrivateFile). Only the owner can read
--                 it, through short-lived signed URLs.
--   public-media  public. Media of published stories (copied from drafts by a
--                 server function at publish time, like Base44's
--                 publishStoryMedia), profile photos and Generate attachments
--                 (Base44 UploadPublicFile / UploadFile). Anyone with the URL
--                 can view a file; nobody can list the bucket.
--
-- Every file lives under a folder named after its owner's user id
-- (<user id>/...), and users can only add, change or remove files in their
-- own folder. This replaces Base44's "first account to register a file owns
-- it" check (registerMedia): ownership is now part of the path.
-- 50 MB per file is the Free plan's maximum (decision 2).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('drafts', 'drafts', false, 52428800, array['image/*', 'video/*', 'audio/*']),
  ('public-media', 'public-media', true, 52428800, array['image/*', 'video/*', 'audio/*'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- drafts: the owner does everything in their own folder; nobody else sees it.
create policy "drafts: owner reads own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'drafts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "drafts: owner uploads to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'drafts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "drafts: owner updates own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'drafts' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'drafts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "drafts: owner deletes own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'drafts' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- public-media: files are served by URL to everyone (public bucket, no
-- policy needed for that). The owner may list, add, change and remove files
-- in their own folder only; no one can list other folders.
create policy "public-media: owner reads own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'public-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "public-media: owner uploads to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "public-media: owner updates own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'public-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'public-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "public-media: owner deletes own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
