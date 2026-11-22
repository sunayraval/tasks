-- Migration: Add subtasks column to tasks table (if not exists)
alter table public.tasks add column if not exists subtasks jsonb default '[]'::jsonb;
