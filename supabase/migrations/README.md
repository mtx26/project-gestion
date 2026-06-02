// Follow this naming convention: 20240602000000_description.sql
// Example migration file:
/*
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.users enable row level security;

create policy "Users can read their own data"
  on public.users
  for select
  using (auth.uid() = id);
*/
