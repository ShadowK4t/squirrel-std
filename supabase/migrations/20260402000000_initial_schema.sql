-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================================
-- USERS
-- ============================================================================
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text unique not null,
  description text check (char_length(description) <= 200),
  avatar_url text,
  role text not null default 'normal' check (role in ('admin', 'lead', 'normal')),
  created_at timestamptz default now() not null
);

-- ============================================================================
-- JOB TITLES
-- ============================================================================
create table public.job_titles (
  id uuid default uuid_generate_v4() primary key,
  name text unique not null
);

create table public.user_job_titles (
  user_id uuid references public.users(id) on delete cascade not null,
  job_title_id uuid references public.job_titles(id) on delete cascade not null,
  primary key (user_id, job_title_id)
);

-- ============================================================================
-- TEAMS
-- ============================================================================
create table public.teams (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  color text not null default '#6272a4',
  created_at timestamptz default now() not null
);

create table public.user_teams (
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  is_lead boolean default false not null,
  primary key (team_id, user_id)
);

-- ============================================================================
-- STATUSES
-- ============================================================================
create table public.statuses (
  id uuid default uuid_generate_v4() primary key,
  label text unique not null,
  color text not null default '#6272a4',
  position smallint not null default 0,
  is_default boolean default false not null
);

-- Seed default statuses
insert into public.statuses (label, color, position, is_default) values
  ('Request',  '#a29bfe', 0, true),
  ('To Do',    '#6272a4', 1, true),
  ('Doing',    '#ffb86c', 2, true),
  ('Review',   '#ff79c6', 3, true),
  ('Done',     '#50fa7b', 4, true);

-- ============================================================================
-- TASKS
-- ============================================================================
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  parent_id uuid references public.tasks(id) on delete set null,
  type text not null default 'task' check (type in ('story', 'task')),
  title text not null,
  description text,
  status_id uuid references public.statuses(id) on delete restrict not null,
  priority smallint default 2 check (priority >= 0 and priority <= 4),
  start_date date,
  end_date date,
  version integer default 1 not null,
  is_future boolean default false not null,
  visible_from date,
  needs_acceptance boolean default false not null,
  created_by uuid references public.users(id) on delete set null,
  assignee uuid references public.users(id) on delete set null,
  reviewer_id uuid references public.users(id) on delete set null,
  related_task_ids uuid[] default '{}',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================================================
-- TASK TEAMS
-- ============================================================================
create table public.task_teams (
  task_id uuid references public.tasks(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete cascade not null,
  is_responsible boolean default false not null,
  primary key (task_id, team_id)
);

-- ============================================================================
-- TASK ATTACHMENTS
-- ============================================================================
create table public.task_attachments (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  type text not null check (type in ('image', 'url')),
  url text not null,
  file_name text,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now() not null
);

-- ============================================================================
-- SUBTASKS
-- ============================================================================
create table public.subtasks (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  title text not null,
  is_done boolean default false not null,
  position smallint default 0 not null
);

-- ============================================================================
-- LIBRARY
-- ============================================================================
create table public.library_categories (
  id uuid default uuid_generate_v4() primary key,
  name text unique not null,
  color text not null default '#6272a4'
);

create table public.library_links (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  url text not null,
  description text,
  category_id uuid references public.library_categories(id) on delete set null,
  added_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now() not null
);

create table public.task_library_links (
  task_id uuid references public.tasks(id) on delete cascade not null,
  library_link_id uuid references public.library_links(id) on delete cascade not null,
  primary key (task_id, library_link_id)
);

-- ============================================================================
-- COMMENTS
-- ============================================================================
create table public.comments (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  content text not null,
  edited_at timestamptz,
  created_at timestamptz default now() not null
);

create table public.comment_mentions (
  comment_id uuid references public.comments(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  primary key (comment_id, user_id)
);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  type text not null check (type in ('task_assigned', 'mentioned', 'review_requested', 'task_accepted', 'meeting_assignment')),
  task_id uuid references public.tasks(id) on delete cascade,
  message text not null,
  is_read boolean default false not null,
  created_at timestamptz default now() not null
);

-- ============================================================================
-- BROADCASTS (meeting assignment popups)
-- ============================================================================
create table public.broadcasts (
  id uuid default uuid_generate_v4() primary key,
  created_by uuid references public.users(id) on delete set null,
  title text not null,
  message text,
  created_at timestamptz default now() not null
);

create table public.broadcast_recipients (
  broadcast_id uuid references public.broadcasts(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  is_dismissed boolean default false not null,
  primary key (broadcast_id, user_id)
);

create table public.broadcast_tasks (
  broadcast_id uuid references public.broadcasts(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete cascade not null,
  primary key (broadcast_id, task_id)
);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at on tasks
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_updated_at
  before update on public.tasks
  for each row execute function public.handle_updated_at();

-- Auto-create user record when someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.users enable row level security;
alter table public.job_titles enable row level security;
alter table public.user_job_titles enable row level security;
alter table public.teams enable row level security;
alter table public.user_teams enable row level security;
alter table public.statuses enable row level security;
alter table public.tasks enable row level security;
alter table public.task_teams enable row level security;
alter table public.task_attachments enable row level security;
alter table public.subtasks enable row level security;
alter table public.library_categories enable row level security;
alter table public.library_links enable row level security;
alter table public.task_library_links enable row level security;
alter table public.comments enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.notifications enable row level security;
alter table public.broadcasts enable row level security;
alter table public.broadcast_recipients enable row level security;
alter table public.broadcast_tasks enable row level security;

-- Helper: get current user's role
create or replace function public.current_user_role()
returns text as $$
  select role from public.users where id = auth.uid();
$$ language sql security definer stable;

-- USERS
create policy "Users can view all users" on public.users
  for select to authenticated using (true);

create policy "Users can update their own profile" on public.users
  for update to authenticated using (id = auth.uid());

-- JOB TITLES
create policy "Anyone can view job titles" on public.job_titles
  for select to authenticated using (true);

create policy "Admins can manage job titles" on public.job_titles
  for all to authenticated using (public.current_user_role() = 'admin');

-- USER JOB TITLES
create policy "Anyone can view user job titles" on public.user_job_titles
  for select to authenticated using (true);

create policy "Admins and leads can manage user job titles" on public.user_job_titles
  for all to authenticated using (public.current_user_role() in ('admin', 'lead'));

-- TEAMS
create policy "Anyone can view teams" on public.teams
  for select to authenticated using (true);

create policy "Admins and leads can manage teams" on public.teams
  for all to authenticated using (public.current_user_role() in ('admin', 'lead'));

-- USER TEAMS
create policy "Anyone can view user teams" on public.user_teams
  for select to authenticated using (true);

create policy "Admins and leads can manage user teams" on public.user_teams
  for all to authenticated using (public.current_user_role() in ('admin', 'lead'));

-- STATUSES
create policy "Anyone can view statuses" on public.statuses
  for select to authenticated using (true);

create policy "Admins and leads can manage statuses" on public.statuses
  for all to authenticated using (public.current_user_role() in ('admin', 'lead'));

-- TASKS: normal users cannot see future tasks
create policy "Users can view tasks" on public.tasks
  for select to authenticated using (
    is_future = false
    or (visible_from is not null and visible_from <= current_date)
    or public.current_user_role() in ('admin', 'lead')
  );

create policy "Authenticated users can create tasks" on public.tasks
  for insert to authenticated with check (true);

create policy "Task participants and leads can update tasks" on public.tasks
  for update to authenticated using (
    created_by = auth.uid()
    or assignee = auth.uid()
    or reviewer_id = auth.uid()
    or public.current_user_role() in ('admin', 'lead')
  );

create policy "Admins and leads can delete tasks" on public.tasks
  for delete to authenticated using (
    public.current_user_role() in ('admin', 'lead')
  );

-- TASK TEAMS
create policy "Anyone can view task teams" on public.task_teams
  for select to authenticated using (true);

create policy "Admins and leads can manage task teams" on public.task_teams
  for all to authenticated using (public.current_user_role() in ('admin', 'lead'));

-- TASK ATTACHMENTS
create policy "Anyone can view task attachments" on public.task_attachments
  for select to authenticated using (true);

create policy "Authenticated users can add attachments" on public.task_attachments
  for insert to authenticated with check (true);

create policy "Uploader or leads can delete attachments" on public.task_attachments
  for delete to authenticated using (
    uploaded_by = auth.uid()
    or public.current_user_role() in ('admin', 'lead')
  );

-- SUBTASKS
create policy "Anyone can view subtasks" on public.subtasks
  for select to authenticated using (true);

create policy "Authenticated users can manage subtasks" on public.subtasks
  for all to authenticated using (true);

-- LIBRARY CATEGORIES
create policy "Anyone can view library categories" on public.library_categories
  for select to authenticated using (true);

create policy "Admins and leads can manage library categories" on public.library_categories
  for all to authenticated using (public.current_user_role() in ('admin', 'lead'));

-- LIBRARY LINKS
create policy "Anyone can view library links" on public.library_links
  for select to authenticated using (true);

create policy "Authenticated users can add library links" on public.library_links
  for insert to authenticated with check (true);

create policy "Adder or leads can delete library links" on public.library_links
  for delete to authenticated using (
    added_by = auth.uid()
    or public.current_user_role() in ('admin', 'lead')
  );

-- TASK LIBRARY LINKS
create policy "Anyone can view task library links" on public.task_library_links
  for select to authenticated using (true);

create policy "Authenticated users can manage task library links" on public.task_library_links
  for all to authenticated using (true);

-- COMMENTS
create policy "Anyone can view comments" on public.comments
  for select to authenticated using (true);

create policy "Authenticated users can create comments" on public.comments
  for insert to authenticated with check (user_id = auth.uid());

create policy "Users can update their own comments" on public.comments
  for update to authenticated using (user_id = auth.uid());

create policy "Users or leads can delete comments" on public.comments
  for delete to authenticated using (
    user_id = auth.uid()
    or public.current_user_role() in ('admin', 'lead')
  );

-- COMMENT MENTIONS
create policy "Anyone can view comment mentions" on public.comment_mentions
  for select to authenticated using (true);

create policy "Authenticated users can manage comment mentions" on public.comment_mentions
  for all to authenticated using (true);

-- NOTIFICATIONS
create policy "Users can view their own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy "System can create notifications" on public.notifications
  for insert to authenticated with check (true);

create policy "Users can update their own notifications" on public.notifications
  for update to authenticated using (user_id = auth.uid());

-- BROADCASTS
create policy "Anyone can view broadcasts" on public.broadcasts
  for select to authenticated using (true);

create policy "Admins and leads can create broadcasts" on public.broadcasts
  for insert to authenticated with check (public.current_user_role() in ('admin', 'lead'));

-- BROADCAST RECIPIENTS
create policy "Users can view their own broadcast receipts" on public.broadcast_recipients
  for select to authenticated using (user_id = auth.uid());

create policy "Admins and leads can manage broadcast recipients" on public.broadcast_recipients
  for insert to authenticated with check (public.current_user_role() in ('admin', 'lead'));

create policy "Users can dismiss their own broadcasts" on public.broadcast_recipients
  for update to authenticated using (user_id = auth.uid());

-- BROADCAST TASKS
create policy "Anyone can view broadcast tasks" on public.broadcast_tasks
  for select to authenticated using (true);

create policy "Admins and leads can manage broadcast tasks" on public.broadcast_tasks
  for all to authenticated using (public.current_user_role() in ('admin', 'lead'));

-- ============================================================================
-- INDEXES
-- ============================================================================
create index idx_tasks_parent_id on public.tasks(parent_id);
create index idx_tasks_status_id on public.tasks(status_id);
create index idx_tasks_assignee on public.tasks(assignee);
create index idx_tasks_created_by on public.tasks(created_by);
create index idx_tasks_is_future on public.tasks(is_future);
create index idx_task_teams_task_id on public.task_teams(task_id);
create index idx_task_teams_team_id on public.task_teams(team_id);
create index idx_subtasks_task_id on public.subtasks(task_id);
create index idx_comments_task_id on public.comments(task_id);
create index idx_notifications_user_id on public.notifications(user_id);
create index idx_notifications_is_read on public.notifications(user_id, is_read);
create index idx_broadcast_recipients_user_id on public.broadcast_recipients(user_id);
create index idx_library_links_category_id on public.library_links(category_id);