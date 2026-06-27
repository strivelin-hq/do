-- Create auth schema and users table if they don't exist (simulates Supabase Auth on raw PostgreSQL)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
  END IF;
  
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN
    CREATE TABLE auth.users (
      id uuid primary key default gen_random_uuid(),
      email varchar(255) unique,
      raw_user_meta_data jsonb
    );
  END IF;
END $$;

-- Create custom function auth.uid() if it doesn't exist to extract user ID from JWT claims
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE pg_namespace.nspname = 'auth' AND pg_proc.proname = 'uid') THEN
    CREATE FUNCTION auth.uid() 
    RETURNS uuid 
    LANGUAGE sql STABLE
    AS $_$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $_$;
  END IF;
END $$;

-- Create goals table
create table if not exists goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  completed boolean default false not null,
  tags text[] default array['general']::text[] not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS (Row Level Security)
alter table goals enable row level security;

-- Create policies for user-data isolation
create policy "Users can read their own goals"
  on goals for select
  using (auth.uid() = user_id);

create policy "Users can insert their own goals"
  on goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own goals"
  on goals for update
  using (auth.uid() = user_id);

create policy "Users can delete their own goals"
  on goals for delete
  using (auth.uid() = user_id);

-- Grant API access permissions for Supabase PostgREST roles if they exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') AND EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE goals TO authenticated, service_role;
  END IF;
END $$;


