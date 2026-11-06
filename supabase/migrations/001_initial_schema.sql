-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES & PREFERENCES
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  theme text default 'cyber_ocean',
  custom_theme_json jsonb default null,
  video_bg_preset text default 'rain',
  video_bg_dim numeric default 0.6,
  video_bg_blur numeric default 8,
  ai_tone text default 'locked_in', -- 'locked_in' | 'chill_coach' | 'hyper_drive' | 'executive'
  custom_ai_api_key text default null,
  view_mode text default 'slide_drawer', -- 'slide_drawer' | 'center_modal' | 'inline'
  canvas_feed_url text default null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- TASK ITEMS
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  content text default '', -- Rich text markdown / HTML for document view
  status text default 'To Do', -- 'To Do' | 'In Progress' | 'Blocked' | 'Done'
  type text default 'General', -- 'College' | 'School' | 'Personal' | 'Club' | 'Work'
  priority text default 'Medium', -- 'Urgent' | 'High' | 'Medium' | 'Low'
  due_date timestamp with time zone,
  estimated_minutes integer default 30,
  tags text[] default array[]::text[],
  notes text default '',
  is_canvas_assignment boolean default false,
  canvas_course_code text default null,
  custom_properties jsonb default '{}'::jsonb,
  section_group text default 'TODAY', -- 'COLLEGE' | 'TODAY' | 'TMR' | 'SOON' | 'REMEMBER'
  order_index integer default 0,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ENABLE ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;

create policy "Users can only view their own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can manage their own tasks" on public.tasks
  for all using (auth.uid() = user_id);

-- Automatic profile creation trigger on auth.users signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

