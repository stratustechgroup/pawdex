
-- Track SHA-256 of the file bytes per document so the upload action can
-- detect and reject byte-identical re-uploads. NULL for legacy rows; new
-- uploads always populate.

alter table documents
  add column if not exists content_hash text;

-- One hash per household; if the same hash appears twice in a household it's
-- the same file (same bytes). Using a partial unique index so legacy NULLs
-- don't conflict with each other.
create unique index if not exists documents_household_content_hash_uniq
  on documents(household_id, content_hash)
  where content_hash is not null;

comment on column documents.content_hash is
  'SHA-256 hex digest of the uploaded file bytes. Used to detect duplicate uploads. NULL on legacy rows.';
