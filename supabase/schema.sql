create table if not exists image_assets (
  id text primary key,
  source_type text not null check (source_type in ('upload', 'capture', 'draft')),
  image_data_url text not null,
  width integer not null,
  height integer not null,
  created_at timestamptz not null default now()
);

create table if not exists share_items (
  id text primary key,
  asset_id text not null references image_assets(id) on delete cascade,
  share_token text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists annotations (
  id text primary key,
  asset_id text not null references image_assets(id) on delete cascade,
  tool text not null,
  geometry jsonb not null,
  label text,
  style jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists threads (
  id text primary key,
  asset_id text not null references image_assets(id) on delete cascade,
  annotation_id text references annotations(id) on delete set null,
  title text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create table if not exists comments (
  id text primary key,
  thread_id text not null references threads(id) on delete cascade,
  parent_id text references comments(id) on delete cascade,
  author_label text not null default 'Guest',
  body text not null,
  created_at timestamptz not null default now()
);

alter table image_assets enable row level security;
alter table share_items enable row level security;
alter table annotations enable row level security;
alter table threads enable row level security;
alter table comments enable row level security;

drop policy if exists "Public read image assets" on image_assets;
create policy "Public read image assets" on image_assets for select using (true);
drop policy if exists "Public insert image assets" on image_assets;
create policy "Public insert image assets" on image_assets for insert with check (true);
drop policy if exists "Public update image assets" on image_assets;
create policy "Public update image assets" on image_assets for update using (true) with check (true);

drop policy if exists "Public read share items" on share_items;
create policy "Public read share items" on share_items for select using (true);
drop policy if exists "Public insert share items" on share_items;
create policy "Public insert share items" on share_items for insert with check (true);

drop policy if exists "Public read annotations" on annotations;
create policy "Public read annotations" on annotations for select using (true);
drop policy if exists "Public insert annotations" on annotations;
create policy "Public insert annotations" on annotations for insert with check (true);
drop policy if exists "Public update annotations" on annotations;
create policy "Public update annotations" on annotations for update using (true) with check (true);

drop policy if exists "Public read threads" on threads;
create policy "Public read threads" on threads for select using (true);
drop policy if exists "Public insert threads" on threads;
create policy "Public insert threads" on threads for insert with check (true);
drop policy if exists "Public update threads" on threads;
create policy "Public update threads" on threads for update using (true) with check (true);

drop policy if exists "Public read comments" on comments;
create policy "Public read comments" on comments for select using (true);
drop policy if exists "Public insert comments" on comments;
create policy "Public insert comments" on comments for insert with check (true);
drop policy if exists "Public update comments" on comments;
create policy "Public update comments" on comments for update using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marker-assets', 'marker-assets', true, 52428800, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read marker assets" on storage.objects;
create policy "Public read marker assets" on storage.objects for select using (bucket_id = 'marker-assets');
drop policy if exists "Public insert marker assets" on storage.objects;
create policy "Public insert marker assets" on storage.objects for insert with check (bucket_id = 'marker-assets');
drop policy if exists "Public update marker assets" on storage.objects;
create policy "Public update marker assets" on storage.objects for update using (bucket_id = 'marker-assets') with check (bucket_id = 'marker-assets');
