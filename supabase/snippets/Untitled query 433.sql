create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  primary key (task_id, user_id)
);
alter table public.task_assignees enable row level security;
create policy "task_assignees all by authenticated" on public.task_assignees
  for all using (auth.role() = 'authenticated');
insert into public.task_assignees (task_id, user_id)
select id, assignee from public.tasks where assignee is not null
on conflict do nothing;