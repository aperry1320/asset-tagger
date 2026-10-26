-- Covering indexes for audit foreign keys (performance advisor)
create index if not exists assets_updated_by_idx on public.assets(updated_by);
create index if not exists checklist_templates_updated_by_idx on public.checklist_templates(updated_by);
create index if not exists photos_updated_by_idx on public.photos(updated_by);
create index if not exists sites_created_by_idx on public.sites(created_by);
create index if not exists sites_updated_by_idx on public.sites(updated_by);
