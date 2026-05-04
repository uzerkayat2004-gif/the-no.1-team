-- World's Number One Team — Supabase Schema
-- Run this in the Supabase SQL Editor

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    name TEXT,
    task TEXT,
    task_type TEXT,
    status TEXT DEFAULT 'in-progress',
    senior_agent TEXT,
    agents TEXT[], -- Array of agent names
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.memory_learnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    topic TEXT,
    content TEXT,
    task_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.agent_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    agent_id TEXT NOT NULL,
    name TEXT,
    capabilities JSONB,
    settings JSONB,
    UNIQUE(user_id, agent_id)
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies

-- Sessions: Users can only read/write their own sessions
CREATE POLICY "Users can view own sessions" ON public.sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions" ON public.sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON public.sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON public.sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Memory Learnings: Users can only read/write their own memory
CREATE POLICY "Users can view own memory" ON public.memory_learnings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memory" ON public.memory_learnings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Agent Profiles: Users can manage their own agent configs
CREATE POLICY "Users can manage own profiles" ON public.agent_profiles
    USING (auth.uid() = user_id);
