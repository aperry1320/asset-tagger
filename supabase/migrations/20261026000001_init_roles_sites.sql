-- Asset Tagger v2: single-tenant schema with roles (god | admin | user) and per-site access.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'user' check (role in ('god','admin','user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sites (               -- = "projects" in the app
  id text primary key,
  name text not null default '',
  data jsonb not null default '{}'::jsonb, -- full app project object (client, address, partsEmails, notes, ...)
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table public.site_admins (
  site_id text not null references public.sites(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (site_id, user_id)
);
create index on public.site_admins(user_id);

create table public.site_members (
  site_id text not null references public.sites(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (site_id, user_id)
);
create index on public.site_members(user_id);

create table public.assets (
  id text primary key,
  site_id text not null references public.sites(id) on delete cascade,
  tag text not null default '',
  type text not null default '',
  data jsonb not null default '{}'::jsonb, -- full app asset object incl. parts[] and inspections[]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid()
);
create index on public.assets(site_id);

-- Read-only, query-friendly copies maintained by trigger from assets.data
create table public.parts (
  id text not null,
  asset_id text not null references public.assets(id) on delete cascade,
  site_id text not null references public.sites(id) on delete cascade,
  kind text, size text, qty int, freq_months int, last_replaced date, due_manual date, notes text,
  primary key (asset_id, id)
);
create index on public.parts(site_id);

create table public.inspections (
  id text not null,
  asset_id text not null references public.assets(id) on delete cascade,
  site_id text not null references public.sites(id) on delete cascade,
  date date, inspector text, status text, notes text, completed_at timestamptz, data jsonb,
  primary key (asset_id, id)
);
create index on public.inspections(site_id);

create table public.inspection_items (
  asset_id text not null,
  inspection_id text not null,
  id text not null,
  site_id text not null references public.sites(id) on delete cascade,
  position int, text text, required boolean, unit text, result text, value text, note text, resolved_at text,
  primary key (asset_id, inspection_id, id),
  foreign key (asset_id, inspection_id) references public.inspections(asset_id, id) on delete cascade
);
create index on public.inspection_items(site_id);

create table public.checklist_templates (
  type text primary key,                    -- equipment type, e.g. 'Air Handling Unit'
  data jsonb not null,                      -- {freq, items:[{id,text,required,reading,unit}]}
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid()
);

create table public.photos (
  id text primary key,
  site_id text not null references public.sites(id) on delete cascade,
  asset_id text not null,                   -- no FK: photo may sync before/after its asset
  insp_id text, item_id text,
  type text not null default 'image/jpeg',
  storage_path text not null,               -- photos bucket: <site_id>/<asset_id>/<id>
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid()
);
create index on public.photos(site_id);
create index on public.photos(asset_id);

-- ---------- helper functions (private schema, not exposed via the API) ----------
create or replace function private.my_role() returns text
language sql stable security definer set search_path = '' as
$$ select role from public.profiles where id = (select auth.uid()) $$;

create or replace function private.is_god() returns boolean
language sql stable security definer set search_path = '' as
$$ select coalesce((select role = 'god' from public.profiles where id = (select auth.uid())), false) $$;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as
$$ select coalesce((select role in ('god','admin') from public.profiles where id = (select auth.uid())), false) $$;

create or replace function private.can_admin_site(sid text) returns boolean
language sql stable security definer set search_path = '' as
$$ select private.is_god() or exists (
     select 1 from public.site_admins sa join public.profiles p on p.id = sa.user_id
     where sa.site_id = sid and sa.user_id = (select auth.uid()) and p.role in ('admin','god')) $$;

create or replace function private.can_access_site(sid text) returns boolean
language sql stable security definer set search_path = '' as
$$ select private.can_admin_site(sid) or exists (
     select 1 from public.site_members sm where sm.site_id = sid and sm.user_id = (select auth.uid())) $$;

-- can the caller see this person (for team screens)?
create or replace function private.can_see_profile(pid uuid, prole text) returns boolean
language sql stable security definer set search_path = '' as
$$ select pid = (select auth.uid()) or private.is_god()
     or (private.is_admin() and prole <> 'god')
     or exists (select 1 from public.site_members a join public.site_members b on a.site_id = b.site_id
                where a.user_id = (select auth.uid()) and b.user_id = pid)
     or exists (select 1 from public.site_members a join public.site_admins b on a.site_id = b.site_id
                where a.user_id = (select auth.uid()) and b.user_id = pid) $$;

grant execute on all functions in schema private to authenticated;

-- ---------- triggers ----------
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'full_name', ''), 'user')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.guard_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Only god (or server-side service role, where auth.uid() is null) may change role or email.
  if (select auth.uid()) is not null and not private.is_god() then
    if new.role is distinct from old.role or new.email is distinct from old.email or new.id is distinct from old.id then
      raise exception 'Only the God account can change roles';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger guard_profile before update on public.profiles
  for each row execute function private.guard_profile();

create or replace function private.touch() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger touch_sites before update on public.sites for each row execute function private.touch();

create or replace function private.safe_date(t text) returns date
language plpgsql immutable set search_path = '' as $$
begin
  if t ~ '^\d{4}-\d{2}-\d{2}' then return left(t, 10)::date; end if; return null;
exception when others then return null; end $$;

-- Explode assets.data.parts[] / inspections[] into the reporting tables.
create or replace function private.sync_asset_children() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p jsonb; i jsonb; it jsonb; n int;
begin
  delete from public.parts where asset_id = new.id;
  delete from public.inspections where asset_id = new.id;
  for p in select * from jsonb_array_elements(case when jsonb_typeof(new.data->'parts') = 'array' then new.data->'parts' else '[]' end) loop
    insert into public.parts (id, asset_id, site_id, kind, size, qty, freq_months, last_replaced, due_manual, notes)
    values (coalesce(p->>'id', gen_random_uuid()::text), new.id, new.site_id, p->>'kind', p->>'size',
            case when (p->>'qty') ~ '^\d+$' then (p->>'qty')::int end,
            case when (p->>'freq') ~ '^\d+$' then (p->>'freq')::int end,
            private.safe_date(p->>'lastReplaced'), private.safe_date(p->>'dueManual'), p->>'notes')
    on conflict do nothing;
  end loop;
  for i in select * from jsonb_array_elements(case when jsonb_typeof(new.data->'inspections') = 'array' then new.data->'inspections' else '[]' end) loop
    insert into public.inspections (id, asset_id, site_id, date, inspector, status, notes, completed_at, data)
    values (coalesce(i->>'id', gen_random_uuid()::text), new.id, new.site_id, private.safe_date(i->>'date'), i->>'inspector', i->>'status', i->>'notes',
            case when (i->>'completedAt') ~ '^\d{4}-' then (i->>'completedAt')::timestamptz end, i - 'items')
    on conflict do nothing;
    n := 0;
    for it in select * from jsonb_array_elements(case when jsonb_typeof(i->'items') = 'array' then i->'items' else '[]' end) loop
      n := n + 1;
      insert into public.inspection_items (asset_id, inspection_id, id, site_id, position, text, required, unit, result, value, note, resolved_at)
      values (new.id, i->>'id', coalesce(it->>'id', n::text), new.site_id, n, it->>'text', coalesce((it->>'required')::boolean, true), it->>'unit',
              it->>'result', it->>'value', it->>'note', it->>'resolvedAt')
      on conflict do nothing;
    end loop;
  end loop;
  return new;
end $$;
create trigger asset_children after insert or update of data, site_id on public.assets
  for each row execute function private.sync_asset_children();
create trigger touch_assets before update on public.assets for each row execute function private.touch();
create trigger touch_tpl before update on public.checklist_templates for each row execute function private.touch();

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.site_admins enable row level security;
alter table public.site_members enable row level security;
alter table public.assets enable row level security;
alter table public.parts enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_items enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.photos enable row level security;

-- profiles: see self/team; edit own name; god edits anyone. Rows are created by trigger / edge function.
create policy profiles_select on public.profiles for select to authenticated using (private.can_see_profile(id, role));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or private.is_god()) with check (id = (select auth.uid()) or private.is_god());
create policy profiles_delete on public.profiles for delete to authenticated using (private.is_god() and id <> (select auth.uid()));

-- sites
create policy sites_select on public.sites for select to authenticated using (private.can_access_site(id));
create policy sites_insert on public.sites for insert to authenticated with check (private.is_god());
create policy sites_update on public.sites for update to authenticated using (private.can_admin_site(id)) with check (private.can_admin_site(id));
create policy sites_delete on public.sites for delete to authenticated using (private.can_admin_site(id));

-- site_admins: god assigns; anyone on the site can see who manages it
create policy sa_select on public.site_admins for select to authenticated using (private.can_access_site(site_id));
create policy sa_insert on public.site_admins for insert to authenticated with check (private.is_god());
create policy sa_delete on public.site_admins for delete to authenticated using (private.is_god());

-- site_members: the site's admins (and god) assign users
create policy sm_select on public.site_members for select to authenticated using (private.can_access_site(site_id));
create policy sm_insert on public.site_members for insert to authenticated with check (private.can_admin_site(site_id));
create policy sm_delete on public.site_members for delete to authenticated using (private.can_admin_site(site_id));

-- assets: everyone on the site can add/edit; only site admins / god delete
create policy assets_select on public.assets for select to authenticated using (private.can_access_site(site_id));
create policy assets_insert on public.assets for insert to authenticated with check (private.can_access_site(site_id));
create policy assets_update on public.assets for update to authenticated using (private.can_access_site(site_id)) with check (private.can_access_site(site_id));
create policy assets_delete on public.assets for delete to authenticated using (private.can_admin_site(site_id));

-- reporting tables: read-only for clients (written by trigger)
create policy parts_select on public.parts for select to authenticated using (private.can_access_site(site_id));
create policy insp_select on public.inspections for select to authenticated using (private.can_access_site(site_id));
create policy items_select on public.inspection_items for select to authenticated using (private.can_access_site(site_id));

-- checklist templates: everyone signed in reads; god/admin edit
create policy tpl_select on public.checklist_templates for select to authenticated using (true);
create policy tpl_insert on public.checklist_templates for insert to authenticated with check (private.is_admin());
create policy tpl_update on public.checklist_templates for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy tpl_delete on public.checklist_templates for delete to authenticated using (private.is_admin());

-- photos
create policy photos_select on public.photos for select to authenticated using (private.can_access_site(site_id));
create policy photos_insert on public.photos for insert to authenticated with check (private.can_access_site(site_id));
create policy photos_update on public.photos for update to authenticated using (private.can_access_site(site_id)) with check (private.can_access_site(site_id));
create policy photos_delete on public.photos for delete to authenticated using (private.can_access_site(site_id));

revoke all on all tables in schema public from anon;
revoke insert, update, delete on public.parts, public.inspections, public.inspection_items from authenticated;

-- ---------- Storage: private photos bucket, path <site_id>/<asset_id>/<photo_id> ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif','image/heic'])
on conflict (id) do nothing;

create policy photos_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and private.can_access_site((storage.foldername(name))[1]));
create policy photos_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and private.can_access_site((storage.foldername(name))[1]));
create policy photos_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and private.can_access_site((storage.foldername(name))[1]))
  with check (bucket_id = 'photos' and private.can_access_site((storage.foldername(name))[1]));
create policy photos_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and private.can_access_site((storage.foldername(name))[1]));
