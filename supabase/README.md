# Supabase Notes

- Required web env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_SUPABASE_STORAGE_BUCKET` (optional, defaults to `marker-assets`)
- Apply `supabase/schema.sql` before testing the real share flow.
- The schema now creates a public Storage bucket named `marker-assets` and allows anonymous read/insert/update for that bucket.
- Current implementation uses Supabase for image upload, share creation, share loading, replies, and thread status sync.
- Local drafts still use `localStorage`, so the editor remains usable without a backend.
- If env vars are missing, the app falls back to `localStorage` for share links too.
- After re-running the schema, verify that the uploaded source image appears under the `marker-assets/assets/` prefix in Supabase Storage.
