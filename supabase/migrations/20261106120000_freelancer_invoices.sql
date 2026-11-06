-- Freelancer invoicing
-- Bills for the signed-in freelancer's own work. Not studio billing, and
-- Daymark does not collect the payment. The freelancer writes their own
-- payment instructions (PayID, BSB and account, and so on).
--
-- Daymark's Netlify deploy does not run SQL. Apply this yourself, once:
--   1. Open the Supabase dashboard for this project → SQL → New query.
--   2. Paste this whole file (not a diff) and run it.
--   3. Reload Daymark. Invoices is under the Time door, next to Timesheet.
--
-- Safe to re-run: tables are created only if missing, the time-entry column
-- is added only if missing, and policies are replaced.
--
-- Invoice numbers
-- One sequence per user, shared across personal and team workspaces, so the
-- same person never issues two invoices with the same number.
-- next_invoice_number() increments invoice_sequences in a single INSERT ...
-- ON CONFLICT and returns INV-0001, INV-0002, and so on (the width grows past
-- 9999). A unique (user_id, invoice_number) constraint is the backstop if a
-- number is ever written without the function. Gaps are normal: a number is
-- consumed when a draft is first saved, even if that draft is later deleted.
--
-- Who can see a row
-- The owning user only (user_id = auth.uid()). Teammates in the same
-- workspace cannot read these bills. workspace_id records which Daymark
-- workspace the project lived in, so the list can filter, and insert checks
-- that workspace with get_my_workspace_ids(). It does not grant access.
-- Select, insert, update, and delete are all allowed for the owner so a
-- draft can be edited or removed and a status can move draft → sent → paid.
--
-- Time already billed
-- time_entries.billed_invoice_id points at the invoice that pulled the block.
-- A trigger refuses a pointer to an invoice the time-entry owner does not own.
-- Deleting the invoice sets the pointer back to null, so a discarded draft
-- frees the time. The app does not offer voided blocks.

create table if not exists public.invoice_sequences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_number integer not null default 0,
  constraint invoice_sequences_last_number_check check (last_number >= 0)
);

comment on table public.invoice_sequences is
  'Per-user invoice number counter. Shared across workspaces. Advanced only by next_invoice_number().';

create table if not exists public.invoice_sellers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  business_name text not null default '',
  abn text not null default '',
  address text not null default '',
  email text not null default '',
  logo_data text,
  logo_width integer,
  logo_height integer,
  payment_instructions text not null default '',
  updated_at timestamptz not null default now(),
  constraint invoice_sellers_business_name_len check (char_length(business_name) <= 200),
  constraint invoice_sellers_abn_len check (char_length(abn) <= 20),
  constraint invoice_sellers_address_len check (char_length(address) <= 500),
  constraint invoice_sellers_email_len check (char_length(email) <= 200),
  constraint invoice_sellers_payment_len check (char_length(payment_instructions) <= 2000),
  constraint invoice_sellers_logo_len check (logo_data is null or char_length(logo_data) <= 200000),
  constraint invoice_sellers_logo_dims check (
    (
      logo_data is null
      and logo_width is null
      and logo_height is null
    )
    or (
      logo_data is not null
      and logo_width between 1 and 2000
      and logo_height between 1 and 2000
    )
  )
);

comment on table public.invoice_sellers is
  'One seller profile per user: name, ABN, address, email, optional logo, free-text payment instructions.';

create table if not exists public.invoice_clients (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  name text not null,
  company text not null default '',
  email text not null default '',
  address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_clients_name_len check (char_length(name) between 1 and 200),
  constraint invoice_clients_company_len check (char_length(company) <= 200),
  constraint invoice_clients_email_len check (char_length(email) <= 200),
  constraint invoice_clients_address_len check (char_length(address) <= 500)
);

comment on table public.invoice_clients is
  'Clients the freelancer bills. Scoped to the owning user and, when set, one workspace.';

create index if not exists invoice_clients_user_workspace_idx
  on public.invoice_clients (user_id, workspace_id);

create table if not exists public.invoices (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  project_id text,
  client_id text references public.invoice_clients (id) on delete set null,
  invoice_number text not null,
  invoice_date date not null,
  due_date date not null,
  currency text not null default 'AUD',
  gst_enabled boolean not null default false,
  status text not null default 'draft',
  sent_at timestamptz,
  paid_at timestamptz,
  notes text not null default '',
  seller_snapshot jsonb not null default '{}'::jsonb,
  client_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_status_check check (status in ('draft', 'sent', 'paid')),
  constraint invoices_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint invoices_number_check check (invoice_number ~ '^INV-[0-9]{4,}$'),
  constraint invoices_notes_len check (char_length(notes) <= 2000),
  constraint invoices_user_number_unique unique (user_id, invoice_number)
);

comment on table public.invoices is
  'Freelancer invoices tied to a Daymark project. Status is draft, sent, or paid. Overdue is derived when a sent invoice is past its due date. seller_snapshot and client_snapshot freeze the text printed on a sent invoice.';

create index if not exists invoices_user_workspace_idx
  on public.invoices (user_id, workspace_id, status);

create table if not exists public.invoice_lines (
  id text primary key,
  invoice_id text not null references public.invoices (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  sort_order integer not null default 0,
  description text not null default '',
  quantity numeric(12, 2) not null default 1,
  unit_amount numeric(12, 2) not null default 0,
  source_type text not null default 'manual',
  source_id text,
  source_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint invoice_lines_source_check check (source_type in ('manual', 'time', 'deliverable', 'station')),
  constraint invoice_lines_description_len check (char_length(description) <= 500),
  constraint invoice_lines_quantity_check check (quantity >= 0),
  constraint invoice_lines_unit_amount_check check (unit_amount >= 0)
);

comment on table public.invoice_lines is
  'Invoice lines. source_type time/deliverable/station records what was pulled so it is not offered again. quantity is hours for time lines and usually 1 for a fixed fee. unit_amount is the rate or the fee, in major currency units.';

create index if not exists invoice_lines_invoice_idx
  on public.invoice_lines (invoice_id, sort_order);

alter table public.time_entries
  add column if not exists billed_invoice_id text;

comment on column public.time_entries.billed_invoice_id is
  'Set when this block is pulled onto an invoice. Null means still unbilled. Cleared if that invoice is deleted.';

create index if not exists time_entries_billed_invoice_idx
  on public.time_entries (billed_invoice_id)
  where billed_invoice_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'time_entries_billed_invoice_id_fkey'
  ) then
    alter table public.time_entries
      add constraint time_entries_billed_invoice_id_fkey
      foreign key (billed_invoice_id)
      references public.invoices (id)
      on delete set null;
  end if;
end $$;

create or replace function public.time_entries_billed_invoice_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.billed_invoice_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.invoices i
    where i.id = new.billed_invoice_id
      and i.user_id = new.user_id
  ) then
    raise exception 'That invoice does not belong to the owner of this time entry';
  end if;
  return new;
end;
$$;

drop trigger if exists time_entries_billed_invoice_owner on public.time_entries;
create trigger time_entries_billed_invoice_owner
  before insert or update of billed_invoice_id
  on public.time_entries
  for each row
  execute function public.time_entries_billed_invoice_owner();

create or replace function public.next_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  insert into public.invoice_sequences as s (user_id, last_number)
  values (auth.uid(), 1)
  on conflict (user_id) do update
    set last_number = s.last_number + 1
  returning last_number into n;

  return 'INV-' || lpad(n::text, 4, '0');
end;
$$;

comment on function public.next_invoice_number() is
  'Atomically allocates the next INV-0001-style number for the signed-in user.';

revoke all on function public.next_invoice_number() from public;
revoke all on function public.next_invoice_number() from anon;
grant execute on function public.next_invoice_number() to authenticated;
grant execute on function public.next_invoice_number() to service_role;

revoke all on function public.time_entries_billed_invoice_owner() from public;
revoke all on function public.time_entries_billed_invoice_owner() from anon;
grant execute on function public.time_entries_billed_invoice_owner() to authenticated;

alter table public.invoice_sequences enable row level security;
alter table public.invoice_sellers enable row level security;
alter table public.invoice_clients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;

drop policy if exists invoice_sequences_select on public.invoice_sequences;
drop policy if exists invoice_sellers_select on public.invoice_sellers;
drop policy if exists invoice_sellers_insert on public.invoice_sellers;
drop policy if exists invoice_sellers_update on public.invoice_sellers;
drop policy if exists invoice_sellers_delete on public.invoice_sellers;
drop policy if exists invoice_clients_select on public.invoice_clients;
drop policy if exists invoice_clients_insert on public.invoice_clients;
drop policy if exists invoice_clients_update on public.invoice_clients;
drop policy if exists invoice_clients_delete on public.invoice_clients;
drop policy if exists invoices_select on public.invoices;
drop policy if exists invoices_insert on public.invoices;
drop policy if exists invoices_update on public.invoices;
drop policy if exists invoices_delete on public.invoices;
drop policy if exists invoice_lines_select on public.invoice_lines;
drop policy if exists invoice_lines_insert on public.invoice_lines;
drop policy if exists invoice_lines_update on public.invoice_lines;
drop policy if exists invoice_lines_delete on public.invoice_lines;

-- The counter is written only by next_invoice_number() (security definer).
create policy invoice_sequences_select on public.invoice_sequences
  for select
  using (user_id = auth.uid());

create policy invoice_sellers_select on public.invoice_sellers
  for select
  using (user_id = auth.uid());

create policy invoice_sellers_insert on public.invoice_sellers
  for insert
  with check (user_id = auth.uid());

create policy invoice_sellers_update on public.invoice_sellers
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy invoice_sellers_delete on public.invoice_sellers
  for delete
  using (user_id = auth.uid());

create policy invoice_clients_select on public.invoice_clients
  for select
  using (user_id = auth.uid());

create policy invoice_clients_insert on public.invoice_clients
  for insert
  with check (
    user_id = auth.uid()
    and (
      workspace_id is null
      or workspace_id in (select public.get_my_workspace_ids())
    )
  );

create policy invoice_clients_update on public.invoice_clients
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      workspace_id is null
      or workspace_id in (select public.get_my_workspace_ids())
    )
  );

create policy invoice_clients_delete on public.invoice_clients
  for delete
  using (user_id = auth.uid());

create policy invoices_select on public.invoices
  for select
  using (user_id = auth.uid());

create policy invoices_insert on public.invoices
  for insert
  with check (
    user_id = auth.uid()
    and (
      workspace_id is null
      or workspace_id in (select public.get_my_workspace_ids())
    )
  );

create policy invoices_update on public.invoices
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      workspace_id is null
      or workspace_id in (select public.get_my_workspace_ids())
    )
  );

create policy invoices_delete on public.invoices
  for delete
  using (user_id = auth.uid());

create policy invoice_lines_select on public.invoice_lines
  for select
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.invoices i
      where i.id = invoice_id
        and i.user_id = auth.uid()
    )
  );

create policy invoice_lines_insert on public.invoice_lines
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.invoices i
      where i.id = invoice_id
        and i.user_id = auth.uid()
    )
  );

create policy invoice_lines_update on public.invoice_lines
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.invoices i
      where i.id = invoice_id
        and i.user_id = auth.uid()
    )
  );

create policy invoice_lines_delete on public.invoice_lines
  for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.invoices i
      where i.id = invoice_id
        and i.user_id = auth.uid()
    )
  );

revoke all on table public.invoice_sequences from anon;
revoke all on table public.invoice_sequences from authenticated;
grant select on table public.invoice_sequences to authenticated;
grant all on table public.invoice_sequences to service_role;

revoke all on table public.invoice_sellers from anon;
grant select, insert, update, delete on table public.invoice_sellers to authenticated;
grant all on table public.invoice_sellers to service_role;

revoke all on table public.invoice_clients from anon;
grant select, insert, update, delete on table public.invoice_clients to authenticated;
grant all on table public.invoice_clients to service_role;

revoke all on table public.invoices from anon;
grant select, insert, update, delete on table public.invoices to authenticated;
grant all on table public.invoices to service_role;

revoke all on table public.invoice_lines from anon;
grant select, insert, update, delete on table public.invoice_lines to authenticated;
grant all on table public.invoice_lines to service_role;
