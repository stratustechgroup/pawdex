-- Pawdex — Storage bucket + RLS policies
-- Document files live in 'documents' bucket. Path convention:
--   {household_id}/{pet_id|'unsorted'}/{uuid}.{ext}
-- The first path segment is the household_id — RLS checks membership there.

-- =========================================================
-- bucket
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,                     -- private; reads go through signed URLs
  20 * 1024 * 1024,          -- 20 MB cap
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do nothing;

-- pet-photos bucket (smaller, image-only, signed URL reads)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet-photos',
  'pet-photos',
  false,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- =========================================================
-- policies (documents bucket)
-- =========================================================

create policy "documents_read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documents'
    and public.is_household_member(
      (storage.foldername(name))[1]::uuid
    )
  );

create policy "documents_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and public.has_household_write(
      (storage.foldername(name))[1]::uuid
    )
  );

create policy "documents_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'documents'
    and public.has_household_write(
      (storage.foldername(name))[1]::uuid
    )
  );

create policy "documents_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and public.has_household_write(
      (storage.foldername(name))[1]::uuid
    )
  );

-- =========================================================
-- policies (pet-photos bucket)
-- =========================================================

create policy "pet_photos_read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'pet-photos'
    and public.is_household_member(
      (storage.foldername(name))[1]::uuid
    )
  );

create policy "pet_photos_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'pet-photos'
    and public.has_household_write(
      (storage.foldername(name))[1]::uuid
    )
  );

create policy "pet_photos_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'pet-photos'
    and public.has_household_write(
      (storage.foldername(name))[1]::uuid
    )
  );

create policy "pet_photos_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'pet-photos'
    and public.has_household_write(
      (storage.foldername(name))[1]::uuid
    )
  );
