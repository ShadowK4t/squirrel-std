alter table public.users add column if not exists banner_color text default '#6272a4';

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

create policy "Avatars are publicly accessible" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "Users can upload avatars" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');

create policy "Users can update their own avatar" on storage.objects
  for update to authenticated using (bucket_id = 'avatars');
