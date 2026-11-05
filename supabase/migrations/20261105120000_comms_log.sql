-- Comms Log
-- Metadata only: when, author, type, optional project/deliverable/station,
-- optional short label, optional external URL. No message body. No encryption.
-- Not a chat table — do not add it to supabase_realtime.
--
-- Daymark’s Netlify deploy does not run SQL. Apply this yourself, once:
--   1. Open the Supabase dashboard for this project → SQL → New query.
--   2. Paste this whole file (not a diff) and run it.
--   3. Reload Daymark. Existing station comms stay where Waiting reads them
--      and show up in the Comms Log without a backfill.
--
-- Safe to re-run: the table is created only if missing, and policies are replaced.

create table if not exists public.comms_log (
  id text primary key,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  project_id text,
  deliverable_id text,
  station_id text,
  type text not null,
  author_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  url text,
  label text,
  created_at timestamptz not null default now(),
  constraint comms_log_type_check check (type in ('chase', 'call', 'decision')),
  constraint comms_log_label_len check (label is null or char_length(label) <= 80),
  constraint comms_log_url_http check (
    url is null
    or (
      char_length(url) <= 500
      and url ~* '^https?://[^[:space:]]+$'
    )
  )
);

comment on table public.comms_log is
  'Comms Log metadata only (type, author, time, optional short label, optional external URL). No message body.';

create index if not exists comms_log_workspace_at_idx
  on public.comms_log (workspace_id, at desc);

create index if not exists comms_log_project_at_idx
  on public.comms_log (project_id, at desc);

create index if not exists comms_log_station_idx
  on public.comms_log (station_id);

alter table public.comms_log enable row level security;

drop policy if exists comms_log_select on public.comms_log;
drop policy if exists comms_log_insert on public.comms_log;
drop policy if exists comms_log_update on public.comms_log;
drop policy if exists comms_log_delete on public.comms_log;

-- Same membership rule as tasks: your own rows, or any row in a workspace you belong to.
create policy comms_log_select on public.comms_log
  for select
  using (
    (author_id = auth.uid())
    or (workspace_id in (select public.get_my_workspace_ids()))
  );

create policy comms_log_insert on public.comms_log
  for insert
  with check (
    (author_id = auth.uid())
    and (
      (workspace_id is null)
      or (workspace_id in (select public.get_my_workspace_ids()))
    )
  );

create policy comms_log_update on public.comms_log
  for update
  using (
    (author_id = auth.uid())
    or (workspace_id in (select public.get_my_workspace_ids()))
  );

create policy comms_log_delete on public.comms_log
  for delete
  using (
    (author_id = auth.uid())
    or (workspace_id in (select public.get_my_workspace_ids()))
  );

revoke all on table public.comms_log from anon;
grant select, insert, update, delete on table public.comms_log to authenticated;
grant all on table public.comms_log to service_role;
