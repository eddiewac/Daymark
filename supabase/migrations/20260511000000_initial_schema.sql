--
-- PostgreSQL database dump
--

\restrict clSS5HOMNar2PX8VzVEDcQcNTyhPtE5vLoowMjoYBmtF2sLa8giXjxejqxlYScE

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: accept_workspace_invite(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_workspace_invite(invite_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_invite record;
  v_user_email text;
begin
  -- Get the invite
  select * into v_invite
  from public.workspace_invites
  where id = invite_id and accepted_at is null;

  if not found then
    raise exception 'Invite not found or already accepted';
  end if;

  -- Get the current user's email
  select email into v_user_email from auth.users where id = auth.uid();

  -- Confirm the invite was for this user
  if v_invite.invited_email != lower(v_user_email) then
    raise exception 'This invite is not for you';
  end if;

  -- Add the user as a workspace member (idempotent — no error if already there)
  insert into public.workspace_members (workspace_id, user_id, email)
  values (v_invite.workspace_id, auth.uid(), v_user_email)
  on conflict do nothing;

  -- Mark the invite accepted
  update public.workspace_invites
  set accepted_at = now(), accepted_by = auth.uid()
  where id = invite_id;
end;
$$;


--
-- Name: delete_my_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_my_account() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_user_id uuid;
  v_email text;
  v_workspace_id uuid;
  v_new_owner_id uuid;
  v_owned record;
  v_summary json;
  v_workspaces_deleted int := 0;
  v_workspaces_transferred int := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not signed in';
  end if;

  select email into v_email from auth.users where id = v_user_id;

  -- ── Handle workspaces the user OWNS ───────────────────────────────────────
  -- For each owned workspace:
  --   - If other members exist → transfer ownership to the member with the
  --     lowest user_id (stable, predictable).
  --   - If no other members → delete the workspace.
  for v_owned in
    select id, name from public.workspaces where owner_id = v_user_id
  loop
    -- Find another member to transfer to (lowest user_id, not the owner)
    select user_id into v_new_owner_id
    from public.workspace_members
    where workspace_id = v_owned.id
      and user_id <> v_user_id
    order by user_id
    limit 1;

    if v_new_owner_id is not null then
      -- Transfer
      update public.workspaces
      set owner_id = v_new_owner_id
      where id = v_owned.id;
      v_workspaces_transferred := v_workspaces_transferred + 1;
    else
      -- Lone owner — delete the workspace.
      -- Clean up app_storage rows for the workspace first (no FK cascade for these).
      delete from public.app_storage
      where key like 'ws:' || v_owned.id::text || ':%';
      -- Then the workspace itself (cascade deletes tasks/projects/notes/etc).
      delete from public.workspaces where id = v_owned.id;
      v_workspaces_deleted := v_workspaces_deleted + 1;
    end if;
  end loop;

  -- ── Remove user from any remaining workspaces (where they were a member) ─
  delete from public.workspace_members where user_id = v_user_id;

  -- ── Delete personal app_storage rows (keys starting with user_id) ─────────
  -- Examples: ${user_id}:settings-v1, ${user_id}:goals-v1,
  -- ${user_id}:user-prefs-v1, ${user_id}:${ws}:priority-history-v1, etc.
  delete from public.app_storage
  where key like v_user_id::text || ':%'
     or key like '%:' || v_user_id::text || ':%';

  -- ── Delete tasks/projects/notes the user owns in PERSONAL workspace ─────
  -- Team-workspace data was already cascaded with workspaces above (when alone)
  -- or remains in transferred workspaces (where it belongs to others now).
  -- But personal-scope rows (workspace_id null) belong only to this user:
  delete from public.tasks where user_id = v_user_id and workspace_id is null;
  delete from public.projects where user_id = v_user_id and workspace_id is null;
  delete from public.notes where user_id = v_user_id and workspace_id is null;
  delete from public.time_entries where user_id = v_user_id and workspace_id is null;
  delete from public.congresses where user_id = v_user_id and workspace_id is null;
  delete from public.status_rounds where user_id = v_user_id and workspace_id is null;

  -- ── Delete workspace_invites the user sent or received ──────────────────
  delete from public.workspace_invites
  where invited_by = v_user_id
     or invited_email = lower(coalesce(v_email, ''));

  -- ── Build summary ────────────────────────────────────────────────────────
  v_summary := json_build_object(
    'workspaces_deleted', v_workspaces_deleted,
    'workspaces_transferred', v_workspaces_transferred,
    'user_id', v_user_id,
    'email', v_email
  );

  -- ── Finally, delete the auth.users row ──────────────────────────────────
  -- This invalidates the user's session and removes them from Supabase auth.
  delete from auth.users where id = v_user_id;

  return v_summary;
end;
$_$;


--
-- Name: get_invited_workspace_name(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_invited_workspace_name(p_workspace_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_email text;
  v_name  text;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then
    return null;
  end if;

  -- Only return the name if there's a pending invite for this user
  if not exists (
    select 1 from public.workspace_invites
    where workspace_id = p_workspace_id
      and invited_email = v_email
      and accepted_at is null
  ) then
    return null;
  end if;

  select name into v_name from public.workspaces where id = p_workspace_id;
  return v_name;
end;
$$;


--
-- Name: get_my_workspace_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_workspace_ids() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  select workspace_id from workspace_members where user_id = auth.uid();
$$;


--
-- Name: is_workspace_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_workspace_member(_workspace_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from workspace_members wm
    where wm.workspace_id = _workspace_id
    and wm.user_id = auth.uid()
  );
$$;


--
-- Name: preview_delete_my_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preview_delete_my_account() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_email text;
  v_owned_workspaces json;
  v_member_workspaces json;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not signed in';
  end if;

  select email into v_email from auth.users where id = v_user_id;

  -- For each workspace the user OWNS, work out what would happen
  with owned as (
    select w.id, w.name
    from public.workspaces w
    where w.owner_id = v_user_id
  ),
  resolution as (
    select
      o.id,
      o.name,
      (
        select user_id
        from public.workspace_members wm
        where wm.workspace_id = o.id and wm.user_id <> v_user_id
        order by user_id
        limit 1
      ) as new_owner_id
    from owned o
  )
  select json_agg(json_build_object(
    'id', r.id,
    'name', r.name,
    'action', case when r.new_owner_id is null then 'delete' else 'transfer' end,
    'new_owner_email', case
      when r.new_owner_id is null then null
      else (select email from auth.users where id = r.new_owner_id)
    end
  )) into v_owned_workspaces
  from resolution r;

  -- Workspaces the user is just a MEMBER of (not owner) — they leave these
  select json_agg(json_build_object('id', w.id, 'name', w.name))
  into v_member_workspaces
  from public.workspaces w
  join public.workspace_members wm on wm.workspace_id = w.id
  where wm.user_id = v_user_id
    and w.owner_id <> v_user_id;

  return json_build_object(
    'email', v_email,
    'owned_workspaces', coalesce(v_owned_workspaces, '[]'::json),
    'member_workspaces', coalesce(v_member_workspaces, '[]'::json)
  );
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_storage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_storage (
    key text NOT NULL,
    value text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id text NOT NULL,
    workspace_id uuid,
    workspace_name text,
    assigned_to uuid,
    assigned_by uuid,
    task_snapshot text,
    dismissed boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: congresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.congresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    workspace_id uuid,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes (
    id text NOT NULL,
    workspace_id uuid,
    user_id uuid,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id text NOT NULL,
    workspace_id uuid,
    user_id uuid,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: status_rounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.status_rounds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    user_id uuid NOT NULL,
    date date NOT NULL,
    title text,
    notes text,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id text NOT NULL,
    workspace_id uuid,
    user_id uuid,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    done boolean DEFAULT false NOT NULL,
    done_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: time_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    workspace_id uuid,
    task_id text NOT NULL,
    date date NOT NULL,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    hours numeric DEFAULT 0 NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_data (
    user_id uuid NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workspace_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    invited_email text NOT NULL,
    invited_by uuid NOT NULL,
    accepted_at timestamp with time zone,
    accepted_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: workspace_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_members (
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    email text,
    joined_at timestamp with time zone DEFAULT now()
);


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    invite_code text DEFAULT lower(substr(md5((random())::text), 1, 8)),
    owner_id uuid,
    paid boolean DEFAULT false,
    trial_ends_at timestamp with time zone DEFAULT (now() + '14 days'::interval),
    created_at timestamp with time zone DEFAULT now(),
    subscription_status text DEFAULT 'trial'::text,
    trial_started_at timestamp with time zone DEFAULT now(),
    stripe_customer_id text,
    stripe_subscription_id text
);


--
-- Name: app_storage app_storage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_storage
    ADD CONSTRAINT app_storage_pkey PRIMARY KEY (key);


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);


--
-- Name: congresses congresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.congresses
    ADD CONSTRAINT congresses_pkey PRIMARY KEY (id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: status_rounds status_rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_rounds
    ADD CONSTRAINT status_rounds_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: time_entries time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_pkey PRIMARY KEY (id);


--
-- Name: user_data user_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_data
    ADD CONSTRAINT user_data_pkey PRIMARY KEY (user_id);


--
-- Name: workspace_invites workspace_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invites
    ADD CONSTRAINT workspace_invites_pkey PRIMARY KEY (id);


--
-- Name: workspace_invites workspace_invites_workspace_id_invited_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invites
    ADD CONSTRAINT workspace_invites_workspace_id_invited_email_key UNIQUE (workspace_id, invited_email);


--
-- Name: workspace_members workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (workspace_id, user_id);


--
-- Name: workspaces workspaces_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_invite_code_key UNIQUE (invite_code);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: idx_congresses_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_congresses_user ON public.congresses USING btree (user_id);


--
-- Name: idx_congresses_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_congresses_workspace ON public.congresses USING btree (workspace_id);


--
-- Name: idx_status_rounds_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status_rounds_date ON public.status_rounds USING btree (date DESC);


--
-- Name: idx_status_rounds_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status_rounds_user ON public.status_rounds USING btree (user_id);


--
-- Name: idx_status_rounds_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status_rounds_workspace ON public.status_rounds USING btree (workspace_id);


--
-- Name: idx_time_entries_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_entries_date ON public.time_entries USING btree (date);


--
-- Name: idx_time_entries_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_entries_task ON public.time_entries USING btree (task_id);


--
-- Name: idx_time_entries_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_entries_user ON public.time_entries USING btree (user_id);


--
-- Name: idx_time_entries_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_entries_workspace ON public.time_entries USING btree (workspace_id);


--
-- Name: idx_workspace_invites_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_invites_email ON public.workspace_invites USING btree (invited_email);


--
-- Name: idx_workspace_invites_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_invites_workspace ON public.workspace_invites USING btree (workspace_id);


--
-- Name: assignments assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: congresses congresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.congresses
    ADD CONSTRAINT congresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: congresses congresses_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.congresses
    ADD CONSTRAINT congresses_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: notes notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notes notes_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: projects projects_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: status_rounds status_rounds_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_rounds
    ADD CONSTRAINT status_rounds_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: status_rounds status_rounds_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_rounds
    ADD CONSTRAINT status_rounds_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: time_entries time_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: time_entries time_entries_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: user_data user_data_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_data
    ADD CONSTRAINT user_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspace_invites workspace_invites_accepted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invites
    ADD CONSTRAINT workspace_invites_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES auth.users(id);


--
-- Name: workspace_invites workspace_invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invites
    ADD CONSTRAINT workspace_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspace_invites workspace_invites_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invites
    ADD CONSTRAINT workspace_invites_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspaces workspaces_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_data Users can delete own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own data" ON public.user_data FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_data Users can insert own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own data" ON public.user_data FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_data Users can read own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own data" ON public.user_data FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_data Users can update own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own data" ON public.user_data FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: app_storage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_storage ENABLE ROW LEVEL SECURITY;

--
-- Name: assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: assignments assignments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assignments_delete ON public.assignments FOR DELETE USING (((assigned_to = auth.uid()) OR (assigned_by = auth.uid())));


--
-- Name: assignments assignments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assignments_insert ON public.assignments FOR INSERT WITH CHECK ((assigned_by = auth.uid()));


--
-- Name: assignments assignments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assignments_select ON public.assignments FOR SELECT USING (((assigned_to = auth.uid()) OR (assigned_by = auth.uid())));


--
-- Name: assignments assignments_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assignments_update ON public.assignments FOR UPDATE USING (((assigned_to = auth.uid()) OR (assigned_by = auth.uid())));


--
-- Name: congresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.congresses ENABLE ROW LEVEL SECURITY;

--
-- Name: congresses congresses_personal_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY congresses_personal_owner ON public.congresses USING (((workspace_id IS NULL) AND (auth.uid() = user_id))) WITH CHECK (((workspace_id IS NULL) AND (auth.uid() = user_id)));


--
-- Name: congresses congresses_workspace_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY congresses_workspace_member ON public.congresses USING (((workspace_id IS NOT NULL) AND (workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids)))) WITH CHECK (((workspace_id IS NOT NULL) AND (workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids))));


--
-- Name: workspace_invites invites_self_accept; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invites_self_accept ON public.workspace_invites FOR UPDATE USING ((invited_email = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))));


--
-- Name: workspace_invites invites_self_decline; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invites_self_decline ON public.workspace_invites FOR DELETE USING ((invited_email = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))));


--
-- Name: workspace_invites invites_self_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invites_self_read ON public.workspace_invites FOR SELECT USING ((invited_email = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))));


--
-- Name: workspace_invites invites_workspace_members_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invites_workspace_members_create ON public.workspace_invites FOR INSERT WITH CHECK (((workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids)) AND (invited_by = auth.uid())));


--
-- Name: workspace_invites invites_workspace_members_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invites_workspace_members_delete ON public.workspace_invites FOR DELETE USING ((workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids)));


--
-- Name: workspace_invites invites_workspace_members_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invites_workspace_members_read ON public.workspace_invites FOR SELECT USING ((workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids)));


--
-- Name: workspace_members members_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_delete ON public.workspace_members FOR DELETE USING (((user_id = auth.uid()) OR (workspace_id IN ( SELECT workspaces.id
   FROM public.workspaces
  WHERE (workspaces.owner_id = auth.uid())))));


--
-- Name: workspace_members members_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_insert ON public.workspace_members FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: workspace_members members_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_select ON public.workspace_members FOR SELECT USING ((workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids)));


--
-- Name: workspace_members members_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY members_update_own ON public.workspace_members FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

--
-- Name: notes notes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notes_delete ON public.notes FOR DELETE USING (((user_id = auth.uid()) OR (workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids))));


--
-- Name: notes notes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notes_insert ON public.notes FOR INSERT WITH CHECK (((user_id = auth.uid()) AND ((workspace_id IS NULL) OR (workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids)))));


--
-- Name: notes notes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notes_select ON public.notes FOR SELECT USING (((user_id = auth.uid()) OR (workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids))));


--
-- Name: notes notes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notes_update ON public.notes FOR UPDATE USING (((user_id = auth.uid()) OR (workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids))));


--
-- Name: app_storage personal_storage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY personal_storage ON public.app_storage USING ((key ~~ ((auth.uid())::text || ':%'::text))) WITH CHECK ((key ~~ ((auth.uid())::text || ':%'::text)));


--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: projects projects_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_delete ON public.projects FOR DELETE USING (((user_id = auth.uid()) OR (workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids))));


--
-- Name: projects projects_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_insert ON public.projects FOR INSERT WITH CHECK (((user_id = auth.uid()) AND ((workspace_id IS NULL) OR (workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids)))));


--
-- Name: projects projects_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_select ON public.projects FOR SELECT USING (((user_id = auth.uid()) OR (workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids))));


--
-- Name: projects projects_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_update ON public.projects FOR UPDATE USING (((user_id = auth.uid()) OR (workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids))));


--
-- Name: status_rounds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.status_rounds ENABLE ROW LEVEL SECURITY;

--
-- Name: status_rounds status_rounds_personal_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY status_rounds_personal_owner ON public.status_rounds USING (((workspace_id IS NULL) AND (auth.uid() = user_id))) WITH CHECK (((workspace_id IS NULL) AND (auth.uid() = user_id)));


--
-- Name: status_rounds status_rounds_workspace_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY status_rounds_workspace_member ON public.status_rounds USING (((workspace_id IS NOT NULL) AND (workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids)))) WITH CHECK (((workspace_id IS NOT NULL) AND (workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids))));


--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks tasks_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_delete ON public.tasks FOR DELETE USING (((user_id = auth.uid()) OR (workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids))));


--
-- Name: tasks tasks_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_insert ON public.tasks FOR INSERT WITH CHECK (((user_id = auth.uid()) AND ((workspace_id IS NULL) OR (workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids)))));


--
-- Name: tasks tasks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_select ON public.tasks FOR SELECT USING (((user_id = auth.uid()) OR (workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids))));


--
-- Name: tasks tasks_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_update ON public.tasks FOR UPDATE USING (((user_id = auth.uid()) OR (workspace_id IN ( SELECT public.get_my_workspace_ids() AS get_my_workspace_ids))));


--
-- Name: time_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: time_entries time_entries_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY time_entries_owner_all ON public.time_entries USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

--
-- Name: app_storage workspace_storage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_storage ON public.app_storage USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.user_id = auth.uid()) AND (app_storage.key ~~ ((wm.workspace_id)::text || ':%'::text)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.user_id = auth.uid()) AND (app_storage.key ~~ ((wm.workspace_id)::text || ':%'::text))))));


--
-- Name: workspaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

--
-- Name: workspaces workspaces_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_delete ON public.workspaces FOR DELETE USING ((owner_id = auth.uid()));


--
-- Name: workspaces workspaces_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_insert ON public.workspaces FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: workspaces workspaces_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_select ON public.workspaces FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = workspaces.id) AND (wm.user_id = auth.uid())))) OR (invite_code IS NOT NULL)));


--
-- Name: workspaces workspaces_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_update ON public.workspaces FOR UPDATE USING ((owner_id = auth.uid()));


--
-- PostgreSQL database dump complete
--

\unrestrict clSS5HOMNar2PX8VzVEDcQcNTyhPtE5vLoowMjoYBmtF2sLa8giXjxejqxlYScE

