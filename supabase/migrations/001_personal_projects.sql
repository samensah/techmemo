-- Run once in the Supabase SQL editor. Only TechMemo's server may access these tables.
begin;
create table public.tm_projects (
  id uuid primary key,
  owner_id text not null,
  name text not null,
  description text not null,
  standard text not null,
  period text not null,
  data jsonb not null,
  revision integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.tm_project_members (
  project_id uuid references public.tm_projects(id) on delete cascade,
  user_id text not null,
  email text not null,
  name text not null,
  primary key (project_id, user_id)
);
create index tm_members_user on public.tm_project_members(user_id);
create table public.tm_project_invites (
  token_hash text primary key,
  project_id uuid not null references public.tm_projects(id) on delete cascade,
  email text not null,
  expires_at timestamptz not null,
  accepted_by text,
  created_at timestamptz not null default now()
);
alter table public.tm_projects enable row level security;
alter table public.tm_project_members enable row level security;
alter table public.tm_project_invites enable row level security;
revoke all on public.tm_projects, public.tm_project_members, public.tm_project_invites from public, anon, authenticated;
grant all on public.tm_projects, public.tm_project_members, public.tm_project_invites to service_role;

create function public.tm_create_project(p_id uuid, p_user_id text, p_email text, p_user_name text, p_name text, p_description text, p_standard text, p_period text, p_data jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  insert into public.tm_projects(id,owner_id,name,description,standard,period,data)
  values(p_id,p_user_id,p_name,p_description,p_standard,p_period,p_data);
  insert into public.tm_project_members(project_id,user_id,email,name) values(p_id,p_user_id,p_email,p_user_name);
end; $$;
create function public.tm_accept_invite(p_token_hash text, p_user_id text, p_email text, p_name text)
returns uuid language plpgsql set search_path = '' as $$
declare invitation public.tm_project_invites;
begin
  select * into invitation from public.tm_project_invites where token_hash=p_token_hash for update;
  if not found or invitation.expires_at < now() or invitation.email <> lower(p_email)
     or (invitation.accepted_by is not null and invitation.accepted_by <> p_user_id) then
    raise exception 'Invitation unavailable';
  end if;
  insert into public.tm_project_members(project_id,user_id,email,name)
    values(invitation.project_id,p_user_id,lower(p_email),p_name) on conflict do nothing;
  update public.tm_project_invites set accepted_by=p_user_id where token_hash=p_token_hash;
  return invitation.project_id;
end; $$;
revoke all on function public.tm_create_project(uuid,text,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.tm_accept_invite(text,text,text,text) from public, anon, authenticated;
grant execute on function public.tm_create_project(uuid,text,text,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.tm_accept_invite(text,text,text,text) to service_role;
commit;
