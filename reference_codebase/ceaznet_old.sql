-- User Molecules Storage with RLS
-- 1. Create the molecules storage table
CREATE TABLE IF NOT EXISTS public.user_molecules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data JSONB NOT NULL,
    settings JSONB NOT NULL,
    is_favorite BOOLEAN DEFAULT true,
    last_viewed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, name)
);

-- 2. Enable Security (RLS)
ALTER TABLE public.user_molecules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own saved molecules." 
ON public.user_molecules FOR ALL USING (auth.uid() = user_id);

-- 3. Add persistence columns to User Settings
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS last_molecule TEXT,
ADD COLUMN IF NOT EXISTS last_molecule_settings JSONB;

-- 4. Enable Realtime (optional but recommended)
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_molecules;

-- Platform Settings Store with RLS Defaults
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (so the client app can read the logo/email)
CREATE POLICY "Allow public read access on platform_settings" ON public.platform_settings
    FOR SELECT TO public USING (true);

-- Allow authenticated admins to full access
CREATE POLICY "Allow authenticated admins full access on platform_settings" ON public.platform_settings
    FOR ALL TO authenticated USING (auth.role() = 'authenticated');

-- Insert defaults
INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES 
    ('support_email', '"Support@ceaznet.com"', 'The email address displayed in the support inbox and client app'),
    ('platform_logo_url', '"/logo.png"', 'The URL of the brand logo displayed in header and inbox'),
    ('platform_favicon_url', '"/logo.png"', 'The URL of the favicon for the application')
ON CONFLICT (setting_key) DO NOTHING;

-- Add Message Read Timestamp
ALTER TABLE public.support_messages ADD COLUMN read_at TIMESTAMP WITH TIME ZONE NULL;

-- Self-Serve Deletion for Support Data
-- Users can delete their own support conversations
CREATE POLICY "Users can delete their own support conversations"
    ON public.support_conversations FOR DELETE
    USING (auth.uid() = user_id);

-- Users can delete messages in their conversations
CREATE POLICY "Users can delete messages in their conversations"
    ON public.support_messages FOR DELETE
    USING (
        conversation_id IN (
            SELECT id FROM public.support_conversations WHERE user_id = auth.uid()
        )
    );

-- Add Attachment Fields to Support Messages
ALTER TABLE support_messages
ADD COLUMN attachment_url TEXT,
ADD COLUMN attachment_name TEXT,
ADD COLUMN attachment_type TEXT;

-- Update Support Admin Message Read Status
-- Allow users to update messages (to mark admin messages as read)
CREATE POLICY "Users can update messages setting is_read"
    ON public.support_messages FOR UPDATE
        USING (
                conversation_id IN (
                            SELECT id FROM public.support_conversations WHERE user_id = auth.uid()
                                    ) AND sender_type = 'admin'
                                        )
                                            WITH CHECK (
                                                    conversation_id IN (
                                                                SELECT id FROM public.support_conversations WHERE user_id = auth.uid()
                                                                        ) AND sender_type = 'admin' AND is_read = true
                                                                            );

-- Support Conversations and Messages Schema
-- 1. Create support_conversations table
CREATE TABLE public.support_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('chat', 'mail')),
    subject TEXT, -- mail mode ke liye use hoga, chat ke liye null
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create support_messages table
CREATE TABLE public.support_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.support_conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, 
    sender_type VARCHAR(20) CHECK (sender_type IN ('user', 'admin')),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on Row Level Security
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for support_conversations
-- Users can see their own
CREATE POLICY "Users can view their own support conversations"
    ON public.support_conversations FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own
CREATE POLICY "Users can create their own support conversations"
    ON public.support_conversations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- For admin panel, assuming admins have a specific role or access list. 
-- For now, if Admin panel bypassed via service role key, RLS is automatically bypassed.
-- But if using user token, create a policy allowing admins (e.g., using an admin_users table) to select/update.

-- 4. RLS Policies for support_messages
-- Users can see messages in their own conversations
CREATE POLICY "Users can view messages in their conversations"
    ON public.support_messages FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM public.support_conversations WHERE user_id = auth.uid()
        )
    );

-- Users can insert messages in their conversations
CREATE POLICY "Users can insert messages in their conversations"
    ON public.support_messages FOR INSERT
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM public.support_conversations WHERE user_id = auth.uid()
        ) AND sender_type = 'user' AND sender_id = auth.uid()
    );

-- Enable Realtime
-- Admin aur User done bina delay k messages and tickets details haasil karein
ALTER PUBLICATION supabase_realtime ADD TABLE support_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;

-- Add Broadcast Classification Columns
ALTER TABLE public.broadcasts 
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'popup',
ADD COLUMN IF NOT EXISTS banner_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Add Default Broadcast Type
ALTER TABLE public.broadcasts 
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'popup';
UPDATE public.broadcasts SET type = 'popup' WHERE type IS NULL;

-- Add Dismissible and Display Type Fields
ALTER TABLE public.broadcasts 
ADD COLUMN is_dismissible BOOLEAN DEFAULT true,
ADD COLUMN display_type TEXT DEFAULT 'popup';

-- Idempotent Conversations Schema Migration
DO $$ 
BEGIN 
    -- Title missing tha
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'title') THEN 
        ALTER TABLE public.conversations ADD COLUMN title text; 
    END IF;

    -- Messages array missing tha
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'messages') THEN 
        ALTER TABLE public.conversations ADD COLUMN messages jsonb DEFAULT '[]'::jsonb; 
    END IF;

    -- created_at missing tha (yahi error aa raha tha apko)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'created_at') THEN 
        ALTER TABLE public.conversations ADD COLUMN created_at timestamptz DEFAULT now(); 
    END IF;

    -- is_generating_title missing tha
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'is_generating_title') THEN 
        ALTER TABLE public.conversations ADD COLUMN is_generating_title boolean DEFAULT false; 
    END IF;

    -- Agar `user_id` uuid link hone se reh gaya to yeh usko fix kardega
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'user_id') THEN 
        ALTER TABLE public.conversations ADD COLUMN user_id uuid; 
    END IF;

END $$;
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create the table if it completely doesn't exist
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- 2. Add missing columns one by one (Idempotent)
DO $$
BEGIN
    -- user_id (crucial for RLS and matching your data)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'user_id') THEN
        ALTER TABLE public.conversations ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- created_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'created_at') THEN
        ALTER TABLE public.conversations ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    -- title
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'title') THEN
        ALTER TABLE public.conversations ADD COLUMN title TEXT;
    END IF;

    -- messages
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'messages') THEN
        ALTER TABLE public.conversations ADD COLUMN messages JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- summaries
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'summaries') THEN
        ALTER TABLE public.conversations ADD COLUMN summaries JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- planner_context
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'planner_context') THEN
        ALTER TABLE public.conversations ADD COLUMN planner_context JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- is_pinned
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'is_pinned') THEN
        ALTER TABLE public.conversations ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;
    END IF;

    -- is_voice_conversation
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'is_voice_conversation') THEN
        ALTER TABLE public.conversations ADD COLUMN is_voice_conversation BOOLEAN DEFAULT FALSE;
    END IF;

    -- audio_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'audio_url') THEN
        ALTER TABLE public.conversations ADD COLUMN audio_url TEXT;
    END IF;

    -- summarization_failed
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'summarization_failed') THEN
        ALTER TABLE public.conversations ADD COLUMN summarization_failed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if any to ensure idempotency when rerunning
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.conversations;

-- 5. Create Row Level Security Policies
-- SELECT policy
CREATE POLICY "Users can view their own conversations"
ON public.conversations FOR SELECT
USING (auth.uid() = user_id);

-- INSERT policy
CREATE POLICY "Users can insert their own conversations"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE policy
CREATE POLICY "Users can update their own conversations"
ON public.conversations FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE policy
CREATE POLICY "Users can delete their own conversations"
ON public.conversations FOR DELETE
USING (auth.uid() = user_id);
-- 1. Owner column se NOT NULL constraint hata dein (Isse aage ke naye inserts fail nahi honge)
ALTER TABLE "public"."conversations" ALTER COLUMN "owner" DROP NOT NULL;

-- 2. (Optional) Purane records jismein owner null tha par user_id mojood hai unhe migrate karne ke liye
UPDATE "public"."conversations" 
SET "owner" = "user_id" 
WHERE "owner" IS NULL AND "user_id" IS NOT NULL;

-- Add user_id foreign key to conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add Broadcast Expiration Timestamp
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- News API Key & Processing Auditing Extensions
-- 1. Add new tracking columns to existing news_api_keys table safely
ALTER TABLE public.news_api_keys ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.news_api_keys ADD COLUMN IF NOT EXISTS last_used_category TEXT;
ALTER TABLE public.news_api_keys ADD COLUMN IF NOT EXISTS last_failed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.news_api_keys ADD COLUMN IF NOT EXISTS last_error_message TEXT;
ALTER TABLE public.news_api_keys ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMP WITH TIME ZONE;

-- 2. Create Audit Logs Table (For tracking Fallbacks and Retries)
CREATE TABLE IF NOT EXISTS public.api_key_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    failed_key_id UUID REFERENCES public.news_api_keys(id),
    fallback_key_id UUID REFERENCES public.news_api_keys(id),
    category TEXT,
    error_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Skipped Articles Log Table (For tracking Gemini's skip reasons)
CREATE TABLE IF NOT EXISTS public.article_processing_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT,
    article_url TEXT,
    skip_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS on new tables
ALTER TABLE public.api_key_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_processing_logs ENABLE ROW LEVEL SECURITY;

-- 5. Create Policies (Admin access)
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.api_key_audit_logs;
CREATE POLICY "Allow full access to authenticated users" ON public.api_key_audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.article_processing_logs;
CREATE POLICY "Allow full access to authenticated users" ON public.article_processing_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Create Advanced RPCs for Edge Function
CREATE OR REPLACE FUNCTION mark_news_key_used(key_id UUID, cat TEXT) RETURNS void AS $$
BEGIN
    UPDATE public.news_api_keys
    SET calls_count = calls_count + 1, 
        last_used_at = now(), 
        last_used_category = cat
    WHERE id = key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_news_key_failed(key_id UUID, err_msg TEXT, max_failures INTEGER) RETURNS void AS $$
DECLARE
    current_failures INTEGER;
BEGIN
    UPDATE public.news_api_keys
    SET failure_count = failure_count + 1,
        last_failed_at = now(),
        last_error_message = err_msg
    WHERE id = key_id
    RETURNING failure_count INTO current_failures;

    -- If key fails too many times, put it on a 24-hour cooldown instead of killing it forever
    IF current_failures >= max_failures THEN
        UPDATE public.news_api_keys
        SET status = 'exhausted', 
            cooldown_until = now() + interval '24 hours'
        WHERE id = key_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_api_key_audit(failed_id UUID, fallback_id UUID, cat TEXT, err TEXT) RETURNS void AS $$
BEGIN
    INSERT INTO public.api_key_audit_logs (failed_key_id, fallback_key_id, category, error_reason)
    VALUES (failed_id, fallback_id, cat, err);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_skipped_article(cat TEXT, url TEXT, reason TEXT) RETURNS void AS $$
BEGIN
    INSERT INTO public.article_processing_logs (category, article_url, skip_reason)
    VALUES (cat, url, reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- News API Key Success/Failure Cooldown Management
-- Fix 1: Reset failure_count and cooldown states when a key succeeds. 
-- Ensures the key breaks out of the permanent cooldown exhausted loop.
CREATE OR REPLACE FUNCTION mark_news_key_used(key_id UUID, cat TEXT) RETURNS void AS $$
BEGIN
    UPDATE public.news_api_keys
    SET calls_count = calls_count + 1, 
        last_used_at = now(), 
        last_used_category = cat,
        failure_count = 0,
        status = 'active',
        cooldown_until = NULL
    WHERE id = key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 2: Sync Cooldown exact time target instead of blindly appending 24 hours.
-- It matches EXACTLY with the specific provider's daily reset counter.
CREATE OR REPLACE FUNCTION mark_news_key_failed(key_id UUID, err_msg TEXT, max_failures INTEGER) RETURNS void AS $$
DECLARE
    current_failures INTEGER;
    v_provider TEXT;
    next_reset TIMESTAMP WITH TIME ZONE;
    current_utc TIMESTAMP;
BEGIN
    UPDATE public.news_api_keys
    SET failure_count = failure_count + 1,
        last_failed_at = now(),
        last_error_message = err_msg
    WHERE id = key_id
    RETURNING failure_count, provider INTO current_failures, v_provider;

    -- If key fails too many times, calculate precise daily reset target
    IF current_failures >= max_failures THEN
        current_utc := now() AT TIME ZONE 'UTC';
        
        IF v_provider IN ('gnews', 'brevo') THEN
            -- Reset at exactly 05:30 IST (00:00 UTC Midnight)
            next_reset := (date_trunc('day', current_utc) + interval '1 day') AT TIME ZONE 'UTC';
            
        ELSIF v_provider = 'gemini' THEN
            -- Reset at exactly 01:30 IST (20:00 UTC)
            IF extract(hour from current_utc) >= 20 THEN
                -- Already past 20:00 UTC today, target is 20:00 UTC tomorrow
                next_reset := (date_trunc('day', current_utc) + interval '1 day 20 hours') AT TIME ZONE 'UTC';
            ELSE
                -- Still before 20:00 UTC today, target is 20:00 UTC today
                next_reset := (date_trunc('day', current_utc) + interval '20 hours') AT TIME ZONE 'UTC';
            END IF;
            
        ELSE
            -- Safe default
            next_reset := now() + interval '24 hours';
        END IF;

        UPDATE public.news_api_keys
        SET status = 'exhausted', 
            cooldown_until = next_reset
        WHERE id = key_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- News API Key Tracking & Activity Logging
-- 1. Fix the broken event trigger function first (Safe: Uses OR REPLACE)
CREATE OR REPLACE FUNCTION attach_trigger_to_new_table()
RETURNS event_trigger AS $$
DECLARE
    obj record;
    table_name text;
    trigger_name text;
BEGIN
    FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE'
    LOOP
        table_name := obj.object_identity;
        -- Create a safe trigger name by replacing dots with underscores
        trigger_name := replace(table_name, '.', '_') || '_activity_trigger';
        
        -- Use format() to safely construct the SQL queries
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', trigger_name, table_name);
        EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION public.log_table_activity()', trigger_name, table_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the new table safely (Safe: Uses IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.news_api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider IN ('gnews', 'gemini')),
    api_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted')),
    calls_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS (Safe to run multiple times)
ALTER TABLE public.news_api_keys ENABLE ROW LEVEL SECURITY;

-- 4. Create policies safely (Safe: Drops old policy before creating new one)
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.news_api_keys;
CREATE POLICY "Allow full access to authenticated users" ON public.news_api_keys FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Create RPCs for atomic increments (Safe: Uses OR REPLACE)
CREATE OR REPLACE FUNCTION increment_news_key_calls(key_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.news_api_keys
    SET calls_count = calls_count + 1
    WHERE id = key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_news_key_failures(key_id UUID, max_failures INTEGER)
RETURNS void AS $$
BEGIN
    UPDATE public.news_api_keys
    SET failure_count = failure_count + 1,
        status = CASE WHEN failure_count + 1 >= max_failures THEN 'exhausted' ELSE status END
    WHERE id = key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add Account Name to API Keys
ALTER TABLE public.news_api_keys ADD COLUMN IF NOT EXISTS account_name TEXT;

-- Get Public Tables With Sequence Flag
-- Pehle purane function ko drop karein
DROP FUNCTION IF EXISTS public.get_all_tables();

-- Ab naya function create karein
CREATE OR REPLACE FUNCTION public.get_all_tables()
RETURNS TABLE(table_name text, has_sequence boolean) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        t.tablename::text,
        EXISTS (
            SELECT 1 
            FROM information_schema.columns c 
            WHERE c.table_schema = 'public' 
              AND c.table_name = t.tablename 
              AND (c.column_default LIKE 'nextval(%' OR c.is_identity = 'YES')
        ) AS has_sequence
    FROM pg_tables t
    WHERE t.schemaname = 'public';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Realtime Updates for News System Config
-- Enable realtime for the news_system_config table
alter publication supabase_realtime add table news_system_config;

-- API Key Activity Logging for News Providers
-- 1. Fix the broken event trigger function first
CREATE OR REPLACE FUNCTION attach_trigger_to_new_table()
RETURNS event_trigger AS $$
DECLARE
    obj record;
        table_name text;
            trigger_name text;
            BEGIN
                FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE'
                    LOOP
                            table_name := obj.object_identity;
                                    -- Create a safe trigger name by replacing dots with underscores
                                            trigger_name := replace(table_name, '.', '_') || '_activity_trigger';
                                                    
                                                            -- Use format() to safely construct the SQL queries
                                                                    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', trigger_name, table_name);
                                                                            EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION public.log_table_activity()', trigger_name, table_name);
                                                                                END LOOP;
                                                                                END;
                                                                                $$ LANGUAGE plpgsql;

                                                                                -- 2. Create the new table (Now it will work without errors)
                                                                                CREATE TABLE public.news_api_keys (
                                                                                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                                                                                        provider TEXT NOT NULL CHECK (provider IN ('gnews', 'gemini')),
                                                                                            api_key TEXT NOT NULL UNIQUE,
                                                                                                status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted')),
                                                                                                    calls_count INTEGER NOT NULL DEFAULT 0,
                                                                                                        failure_count INTEGER NOT NULL DEFAULT 0,
                                                                                                            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
                                                                                                            );

                                                                                                            -- 3. Enable RLS
                                                                                                            ALTER TABLE public.news_api_keys ENABLE ROW LEVEL SECURITY;

                                                                                                            -- 4. Create policies (assuming admin only)
                                                                                                            CREATE POLICY "Allow full access to authenticated users" ON public.news_api_keys FOR ALL TO authenticated USING (true) WITH CHECK (true);

                                                                                                            -- 5. Create RPCs for atomic increments (Used by Edge Function)
                                                                                                            CREATE OR REPLACE FUNCTION increment_news_key_calls(key_id UUID)
                                                                                                            RETURNS void AS $$
                                                                                                            BEGIN
                                                                                                              UPDATE public.news_api_keys
                                                                                                                SET calls_count = calls_count + 1
                                                                                                                  WHERE id = key_id;
                                                                                                                  END;
                                                                                                                  $$ LANGUAGE plpgsql SECURITY DEFINER;

                                                                                                                  CREATE OR REPLACE FUNCTION increment_news_key_failures(key_id UUID, max_failures INTEGER)
                                                                                                                  RETURNS void AS $$
                                                                                                                  BEGIN
                                                                                                                    UPDATE public.news_api_keys
                                                                                                                      SET failure_count = failure_count + 1,
                                                                                                                            status = CASE WHEN failure_count + 1 >= max_failures THEN 'exhausted' ELSE status END
                                                                                                                              WHERE id = key_id;
                                                                                                                              END;
                                                                                                                              $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add Activity Logs to Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;

-- News System Configuration Store
-- Create table
CREATE TABLE IF NOT EXISTS public.news_system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert default values
INSERT INTO public.news_system_config (config_key, config_value, description)
VALUES 
('formatting_model', '"gemini-2.5-flash"', 'Model used for formatting articles'),
('summary_model', '"gemini-2.5-flash"', 'Model used for generating admin summaries')
ON CONFLICT (config_key) DO NOTHING;

-- Enable RLS (safe if already enabled)
ALTER TABLE public.news_system_config ENABLE ROW LEVEL SECURITY;

-- 🔥 Make policies idempotent
DROP POLICY IF EXISTS "Allow read access to config" ON public.news_system_config;
DROP POLICY IF EXISTS "Allow update access to config" ON public.news_system_config;
DROP POLICY IF EXISTS "Allow insert access to config" ON public.news_system_config;
DROP POLICY IF EXISTS "Allow delete access to config" ON public.news_system_config;

-- Recreate policies
CREATE POLICY "Allow read access to config"
ON public.news_system_config
FOR SELECT
USING (true);

CREATE POLICY "Allow update access to config"
ON public.news_system_config
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert access to config"
ON public.news_system_config
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow delete access to config"
ON public.news_system_config
FOR DELETE
USING (auth.role() = 'authenticated');

-- News System Configuration Store
-- SQL to create the news system config table
CREATE TABLE IF NOT EXISTS public.news_system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert default models (you can update these from your admin panel later)
INSERT INTO public.news_system_config (config_key, config_value, description)
VALUES 
('formatting_model', '"gemini-2.5-flash"', 'Model used for formatting articles'),
('summary_model', '"gemini-2.5-flash"', 'Model used for generating admin summaries')
ON CONFLICT (config_key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.news_system_config ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users or service role
CREATE POLICY "Allow read access to config" ON public.news_system_config FOR SELECT USING (true);
-- Allow update access to authenticated users
CREATE POLICY "Allow update access to config" ON public.news_system_config FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert access to config" ON public.news_system_config FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow delete access to config" ON public.news_system_config FOR DELETE USING (auth.role() = 'authenticated');

-- News API Keys & Activity Auditing Setup
-- 1. Fix the broken event trigger function first (Safe: Uses OR REPLACE)
CREATE OR REPLACE FUNCTION attach_trigger_to_new_table()
RETURNS event_trigger AS $$
DECLARE
    obj record;
    table_name text;
    trigger_name text;
BEGIN
    FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE'
    LOOP
        table_name := obj.object_identity;
        -- Create a safe trigger name by replacing dots with underscores
        trigger_name := replace(table_name, '.', '_') || '_activity_trigger';
        
        -- Use format() to safely construct the SQL queries
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', trigger_name, table_name);
        EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION public.log_table_activity()', trigger_name, table_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the new table safely (Safe: Uses IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.news_api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider IN ('gnews', 'gemini', 'brevo')),
    api_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted')),
    calls_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.1 Update existing constraint to allow 'brevo'
ALTER TABLE public.news_api_keys DROP CONSTRAINT IF EXISTS news_api_keys_provider_check;
ALTER TABLE public.news_api_keys ADD CONSTRAINT news_api_keys_provider_check CHECK (provider IN ('gnews', 'gemini', 'brevo'));

-- 3. Add new tracking columns to existing news_api_keys table safely
ALTER TABLE public.news_api_keys ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.news_api_keys ADD COLUMN IF NOT EXISTS last_used_category TEXT;
ALTER TABLE public.news_api_keys ADD COLUMN IF NOT EXISTS last_failed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.news_api_keys ADD COLUMN IF NOT EXISTS last_error_message TEXT;
ALTER TABLE public.news_api_keys ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMP WITH TIME ZONE;

-- 4. Create Audit Logs Table (For tracking Fallbacks and Retries)
CREATE TABLE IF NOT EXISTS public.api_key_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    failed_key_id UUID REFERENCES public.news_api_keys(id),
    fallback_key_id UUID REFERENCES public.news_api_keys(id),
    category TEXT,
    error_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Clean up the old article_processing_logs table and function (User requested removal)
DROP TABLE IF EXISTS public.article_processing_logs CASCADE;
DROP FUNCTION IF EXISTS log_skipped_article(TEXT, TEXT, TEXT);

-- 6. Enable RLS on all tables
ALTER TABLE public.news_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_key_audit_logs ENABLE ROW LEVEL SECURITY;

-- 7. Create Policies safely (Safe: Drops old policy before creating new one)
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.news_api_keys;
CREATE POLICY "Allow full access to authenticated users" ON public.news_api_keys FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.api_key_audit_logs;
CREATE POLICY "Allow full access to authenticated users" ON public.api_key_audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Create Advanced RPCs for Edge Function (Safe: Uses OR REPLACE)
CREATE OR REPLACE FUNCTION mark_news_key_used(key_id UUID, cat TEXT) RETURNS void AS $$
BEGIN
    UPDATE public.news_api_keys
    SET calls_count = calls_count + 1, 
        last_used_at = now(), 
        last_used_category = cat
    WHERE id = key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_news_key_failed(key_id UUID, err_msg TEXT, max_failures INTEGER) RETURNS void AS $$
DECLARE
    current_failures INTEGER;
BEGIN
    UPDATE public.news_api_keys
    SET failure_count = failure_count + 1,
        last_failed_at = now(),
        last_error_message = err_msg
    WHERE id = key_id
    RETURNING failure_count INTO current_failures;

    -- If key fails too many times, put it on a 24-hour cooldown instead of killing it forever
    IF current_failures >= max_failures THEN
        UPDATE public.news_api_keys
        SET status = 'exhausted', 
            cooldown_until = now() + interval '24 hours'
        WHERE id = key_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_api_key_audit(failed_id UUID, fallback_id UUID, cat TEXT, err TEXT) RETURNS void AS $$
BEGIN
    INSERT INTO public.api_key_audit_logs (failed_key_id, fallback_key_id, category, error_reason)
    VALUES (failed_id, fallback_id, cat, err);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Activity Audit Logging with Auto-Triggers
-- 1. Create the activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        table_name TEXT NOT NULL,
            action_type TEXT NOT NULL, -- 'GET', 'INSERT', 'UPDATE', 'DELETE'
                description TEXT,
                    source TEXT, -- 'Client' or 'Admin'
                        record_id TEXT,
                            old_data JSONB,
                                new_data JSONB,
                                    created_at TIMESTAMPTZ DEFAULT NOW()
                                    );

                                    -- 2. Function to auto-prune logs (keep only the latest 1000)
                                    CREATE OR REPLACE FUNCTION public.prune_activity_logs()
                                    RETURNS void AS $$
                                    BEGIN
                                        DELETE FROM public.activity_logs
                                            WHERE id NOT IN (
                                                    SELECT id FROM public.activity_logs
                                                            ORDER BY created_at DESC
                                                                    LIMIT 1000
                                                                        );
                                                                        END;
                                                                        $$ LANGUAGE plpgsql SECURITY DEFINER;

                                                                        -- 3. Row-level trigger function for mutations
                                                                        CREATE OR REPLACE FUNCTION public.log_table_activity()
                                                                        RETURNS TRIGGER AS $$
                                                                        DECLARE
                                                                            v_source TEXT := 'Client';
                                                                                v_desc TEXT := '';
                                                                                BEGIN
                                                                                    -- Prevent infinite loop: do not log the activity_logs table itself
                                                                                        IF TG_TABLE_NAME = 'activity_logs' THEN
                                                                                                RETURN NULL;
                                                                                                    END IF;

                                                                                                        -- Determine source (Admin tables vs Client tables)
                                                                                                            IF TG_TABLE_NAME IN ('update_news_logs', 'update_news_config', 'public_news_articles', 'public_content', 'public_article_cache') THEN
                                                                                                                    v_source := 'Admin';
                                                                                                                        END IF;

                                                                                                                            IF (TG_OP = 'DELETE') THEN
                                                                                                                                    v_desc := 'Deleted record from ' || TG_TABLE_NAME;
                                                                                                                                            INSERT INTO public.activity_logs (table_name, action_type, description, source, record_id, old_data)
                                                                                                                                                    VALUES (TG_TABLE_NAME, TG_OP, v_desc, v_source, OLD.id::TEXT, row_to_json(OLD)::JSONB);
                                                                                                                                                            PERFORM public.prune_activity_logs();
                                                                                                                                                                    RETURN OLD;
                                                                                                                                                                        ELSIF (TG_OP = 'UPDATE') THEN
                                                                                                                                                                                v_desc := 'Updated record in ' || TG_TABLE_NAME;
                                                                                                                                                                                        CREATE OR REPLACE FUNCTION get_all_tables()
                                                                                                                                                                                        RETURNS TABLE(table_name text)
                                                                                                                                                                                        LANGUAGE plpgsql SECURITY DEFINER AS $$
                                                                                                                                                                                        BEGIN
                                                                                                                                                                                          RETURN QUERY SELECT t.table_name::text
                                                                                                                                                                                            FROM information_schema.tables t
                                                                                                                                                                                              WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE';
                                                                                                                                                                                              END; $$;

-- Broadcast table
-- 1. Create table for Broadcasts (Sent logs)
CREATE TABLE public.broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    raw_html TEXT,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    sent_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users" ON public.broadcasts FOR ALL USING (auth.role() = 'authenticated');

-- 2. Create table for AI contexts (agar AI iterations save karni hain)
CREATE TABLE public.broadcast_iterations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID REFERENCES public.broadcasts(id) ON DELETE CASCADE,
    role TEXT NOT NULL, 
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.broadcast_iterations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users" ON public.broadcast_iterations FOR ALL USING (auth.role() = 'authenticated');

-- Enable Realtime for broadcasts table optionally
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;

-- Add Conversation Metadata Columns
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS is_voice_conversation BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS summarization_failed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS summaries JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS planner_context JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Dairy Tables Schema Updates
-- Dairy payments table me missing columns add karne ke liye
ALTER TABLE public.dairy_payments 
ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.dairy_items(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS method text;

-- Dairy items table me missing icon column add karne ke liye
ALTER TABLE public.dairy_items
ADD COLUMN IF NOT EXISTS icon text;

-- Dairy entries update karne ke liye (Taki item_id blank ho dake payment sync hone pe)
ALTER TABLE public.dairy_entries
ALTER COLUMN item_id DROP NOT NULL;

-- User Settings Storage & RLS Setup
-- 1. Purane incorrect user_settings table ko drop/delete karein
DROP TABLE IF EXISTS public.user_settings CASCADE;

-- 2. Nayi schema ke mutabiq table banayein
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  api_key TEXT,
  voice_mode_voice TEXT,
  voice_mode_persona_instruction TEXT,
  voice_mode_tone_instruction TEXT,
  voice_mode_custom_instruction TEXT,
  voice_proactive_mode BOOLEAN,
  translator_usage JSONB
);

-- RLS Enable karein
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Policy add karein
CREATE POLICY "Users can manage their own settings." ON public.user_settings 
  FOR ALL USING (auth.uid() = user_id);

-- 3. Signup ke baad create hone wale Trigger function ko overwrite or update karein
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  
  -- Insert into our newly formatted user_settings
  INSERT INTO public.user_settings (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles, Settings, and Avatar Storage Setup
-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ,
  full_name TEXT,
  avatar_url TEXT
);

-- Ensure profile columns exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='updated_at') THEN
    ALTER TABLE public.profiles ADD COLUMN updated_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='full_name') THEN
    ALTER TABLE public.profiles ADD COLUMN full_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='avatar_url') THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  api_key TEXT,
  voice_mode_voice TEXT,
  voice_mode_persona_instruction TEXT,
  voice_mode_tone_instruction TEXT,
  voice_mode_custom_instruction TEXT,
  voice_proactive_mode BOOLEAN,
  translator_usage JSONB
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own settings." ON public.user_settings;
CREATE POLICY "Users can manage their own settings." ON public.user_settings FOR ALL USING (auth.uid() = user_id);

-- 3. Create or replace the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  
  INSERT INTO public.user_settings (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Storage for Avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible." ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Users can upload their own avatar." ON storage.objects;
CREATE POLICY "Users can upload their own avatar." ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid );

DROP POLICY IF EXISTS "Users can update their own avatar." ON storage.objects;
CREATE POLICY "Users can update their own avatar." ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid );

DROP POLICY IF EXISTS "Users can delete their own avatar." ON storage.objects;
CREATE POLICY "Users can delete their own avatar." ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid );

-- Database Analytics with Last Used Timestamp
-- 1. Pehle purane function ko delete karein taaki naya return type set ho sake
DROP FUNCTION IF EXISTS get_database_analytics();

-- 2. Ab naya updated function create karein jisme 'last_used' column shamil hai
CREATE OR REPLACE FUNCTION get_database_analytics()
RETURNS TABLE(
  table_name text,
  live_rows bigint,
  total_inserts bigint,
  total_updates bigint,
  total_deletes bigint,
  last_used timestamptz
) AS $$
DECLARE
  r RECORD;
  max_time timestamptz;
  col_name text;
BEGIN
  FOR r IN 
    SELECT relname::text as tname, n_live_tup, n_tup_ins, n_tup_upd, n_tup_del
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY n_tup_ins DESC
  LOOP
    table_name := r.tname;
    live_rows := r.n_live_tup;
    total_inserts := r.n_tup_ins;
    total_updates := r.n_tup_upd;
    total_deletes := r.n_tup_del;
    last_used := NULL;
    
    -- Check for timestamp columns to determine last usage
    SELECT column_name INTO col_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND information_schema.columns.table_name = r.tname
    AND column_name IN ('updated_at', 'created_at', 'timestamp', 'last_sign_in_at', 'created')
    ORDER BY 
      CASE column_name 
        WHEN 'updated_at' THEN 1 
        WHEN 'last_sign_in_at' THEN 2
        WHEN 'created_at' THEN 3 
        WHEN 'created' THEN 4
        WHEN 'timestamp' THEN 5 
        ELSE 6 
      END
    LIMIT 1;

    IF col_name IS NOT NULL THEN
      BEGIN
        EXECUTE format('SELECT max(%I) FROM public.%I', col_name, r.tname) INTO max_time;
        last_used := max_time;
      EXCEPTION WHEN OTHERS THEN
        last_used := NULL;
      END;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Permissions setup
REVOKE EXECUTE ON FUNCTION get_database_analytics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_database_analytics() TO service_role;
GRANT EXECUTE ON FUNCTION get_database_analytics() TO authenticated;

-- Drop Table Utility
CREATE OR REPLACE FUNCTION admin_drop_table(target_table_name text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', target_table_name);
END; $$;

-- API Key Activity Logging for News Providers
-- 1. Fix the broken event trigger function first
CREATE OR REPLACE FUNCTION attach_trigger_to_new_table()
RETURNS event_trigger AS $$
DECLARE
    obj record;
        table_name text;
            trigger_name text;
            BEGIN
                FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE'
                    LOOP
                            table_name := obj.object_identity;
                                    -- Create a safe trigger name by replacing dots with underscores
                                            trigger_name := replace(table_name, '.', '_') || '_activity_trigger';
                                                    
                                                            -- Use format() to safely construct the SQL queries
                                                                    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', trigger_name, table_name);
                                                                            EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION public.log_table_activity()', trigger_name, table_name);
                                                                                END LOOP;
                                                                                END;
                                                                                $$ LANGUAGE plpgsql;

                                                                                -- 2. Create the new table (Now it will work without errors)
                                                                                CREATE TABLE public.news_api_keys (
                                                                                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                                                                                        provider TEXT NOT NULL CHECK (provider IN ('gnews', 'gemini')),
                                                                                            api_key TEXT NOT NULL UNIQUE,
                                                                                                status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted')),
                                                                                                    calls_count INTEGER NOT NULL DEFAULT 0,
                                                                                                        failure_count INTEGER NOT NULL DEFAULT 0,
                                                                                                            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
                                                                                                            );

                                                                                                            -- 3. Enable RLS
                                                                                                            ALTER TABLE public.news_api_keys ENABLE ROW LEVEL SECURITY;

                                                                                                            -- 4. Create policies (assuming admin only)
                                                                                                            CREATE POLICY "Allow full access to authenticated users" ON public.news_api_keys FOR ALL TO authenticated USING (true) WITH CHECK (true);

                                                                                                            -- 5. Create RPCs for atomic increments (Used by Edge Function)
                                                                                                            CREATE OR REPLACE FUNCTION increment_news_key_calls(key_id UUID)
                                                                                                            RETURNS void AS $$
                                                                                                            BEGIN
                                                                                                              UPDATE public.news_api_keys
                                                                                                                SET calls_count = calls_count + 1
                                                                                                                  WHERE id = key_id;
                                                                                                                  END;
                                                                                                                  $$ LANGUAGE plpgsql SECURITY DEFINER;

                                                                                                                  CREATE OR REPLACE FUNCTION increment_news_key_failures(key_id UUID, max_failures INTEGER)
                                                                                                                  RETURNS void AS $$
                                                                                                                  BEGIN
                                                                                                                    UPDATE public.news_api_keys
                                                                                                                      SET failure_count = failure_count + 1,
                                                                                                                            status = CASE WHEN failure_count + 1 >= max_failures THEN 'exhausted' ELSE status END
                                                                                                                              WHERE id = key_id;
                                                                                                                              END;
                                                                                                                              $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin Truncate and Sequence Reset with Activity Logging
-- 1. Updated Dynamic function to Delete All Data (Truncate) WITH Logging
CREATE OR REPLACE FUNCTION public.admin_truncate_table(target_table_name TEXT)
RETURNS void AS $$
BEGIN
    -- Log the action manually into activity_logs before truncating
        INSERT INTO public.activity_logs (table_name, action_type, description, source)
            VALUES (target_table_name, 'DELETE', 'Admin deleted ALL data (Truncate) from ' || target_table_name, 'Admin');

                -- Execute the truncate
                    EXECUTE format('TRUNCATE TABLE public.%I CASCADE', target_table_name);
                    END;
                    $$ LANGUAGE plpgsql SECURITY DEFINER;

                    -- 2. Updated Dynamic function to Reset ID Sequence WITH Logging
                    CREATE OR REPLACE FUNCTION public.admin_reset_sequence(target_table_name TEXT)
                    RETURNS void AS $$
                    DECLARE
                        seq_name TEXT;
                        BEGIN
                            -- Find the sequence associated with the table's 'id' column
                                SELECT pg_get_serial_sequence('public.' || target_table_name, 'id') INTO seq_name;
                                    
                                        IF seq_name IS NOT NULL THEN
                                                EXECUTE format('ALTER SEQUENCE %s RESTART WITH 1', seq_name);
                                                        
                                                                -- Log the action manually into activity_logs
                                                                        INSERT INTO public.activity_logs (table_name, action_type, description, source)
                                                                                VALUES (target_table_name, 'UPDATE', 'Admin reset ID sequence for ' || target_table_name, 'Admin');
                                                                                    ELSE
                                                                                            RAISE NOTICE 'No sequence found for table % on column id', target_table_name;
                                                                                                END IF;
                                                                                                END;
                                                                                                $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Acivity log trigger function
-- 1. Recreate the trigger function with the fix for tables without an 'id' column
CREATE OR REPLACE FUNCTION public.log_table_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_source TEXT := 'Client';
        v_desc TEXT := '';
            v_record_id TEXT := NULL;
                v_old_json JSONB := NULL;
                    v_new_json JSONB := NULL;
                    BEGIN
                        -- Prevent infinite loop: do not log the activity_logs table itself
                            IF TG_TABLE_NAME = 'activity_logs' THEN
                                    RETURN NULL;
                                        END IF;

                                            -- Determine source (Admin tables vs Client tables)
                                                IF TG_TABLE_NAME IN ('update_news_logs', 'update_news_config', 'public_news_articles', 'public_content', 'public_article_cache') THEN
                                                        v_source := 'Admin';
                                                            END IF;

                                                                IF (TG_OP = 'DELETE') THEN
                                                                        -- Convert row to JSON to safely extract fields without throwing errors
                                                                                v_old_json := row_to_json(OLD)::JSONB;
                                                                                        -- Safely extract ID if it exists, otherwise try user_id or key
                                                                                                v_record_id := COALESCE(v_old_json->>'id', v_old_json->>'user_id', v_old_json->>'key');
                                                                                                        v_desc := 'Deleted record from ' || TG_TABLE_NAME;
                                                                                                                
                                                                                                                        INSERT INTO public.activity_logs (table_name, action_type, description, source, record_id, old_data)
                                                                                                                                VALUES (TG_TABLE_NAME, TG_OP, v_desc, v_source, v_record_id, v_old_json);
                                                                                                                                        
                                                                                                                                                PERFORM public.prune_activity_logs();
                                                                                                                                                        RETURN OLD;
                                                                                                                                                                
                                                                                                                                                                    ELSIF (TG_OP = 'UPDATE') THEN
                                                                                                                                                                            v_old_json := row_to_json(OLD)::JSONB;
                                                                                                                                                                                    v_new_json := row_to_json(NEW)::JSONB;
                                                                                                                                                                                            v_record_id := COALESCE(v_new_json->>'id', v_new_json->>'user_id', v_new_json->>'key');
                                                                                                                                                                                                    v_desc := 'Updated record in ' || TG_TABLE_NAME;
                                                                                                                                                                                                            
                                                                                                                                                                                                                    INSERT INTO public.activity_logs (table_name, action_type, description, source, record_id, old_data, new_data)
                                                                                                                                                                                                                            VALUES (TG_TABLE_NAME, TG_OP, v_desc, v_source, v_record_id, v_old_json, v_new_json);
                                                                                                                                                                                                                                    
                                                                                                                                                                                                                                            PERFORM public.prune_activity_logs();
                                                                                                                                                                                                                                                    RETURN NEW;
                                                                                                                                                                                                                                                            
                                                                                                                                                                                                                                                                ELSIF (TG_OP = 'INSERT') THEN
                                                                                                                                                                                                                                                                        v_new_json := row_to_json(NEW)::JSONB;
                                                                                                                                                                                                                                                                                v_record_id := COALESCE(v_new_json->>'id', v_new_json->>'user_id', v_new_json->>'key');
                                                                                                                                                                                                                                                                                        v_desc := 'New record in ' || TG_TABLE_NAME;
                                                                                                                                                                                                                                                                                                
                                                                                                                                                                                                                                                                                                        INSERT INTO public.activity_logs (table_name, action_type, description, source, record_id, new_data)
                                                                                                                                                                                                                                                                                                                VALUES (TG_TABLE_NAME, TG_OP, v_desc, v_source, v_record_id, v_new_json);
                                                                                                                                                                                                                                                                                                                        
                                                                                                                                                                                                                                                                                                                                PERFORM public.prune_activity_logs();
                                                                                                                                                                                                                                                                                                                                        RETURN NEW;
                                                                                                                                                                                                                                                                                                                                            END IF;
                                                                                                                                                                                                                                                                                                                                                RETURN NULL;
                                                                                                                                                                                                                                                                                                                                                END;
                                                                                                                                                                                                                                                                                                                                                $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Activity log and automatic trigger
-- 1. Create the activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        table_name TEXT NOT NULL,
            action_type TEXT NOT NULL, -- 'GET', 'INSERT', 'UPDATE', 'DELETE'
                description TEXT,
                    source TEXT, -- 'Client' or 'Admin'
                        record_id TEXT,
                            old_data JSONB,
                                new_data JSONB,
                                    created_at TIMESTAMPTZ DEFAULT NOW()
                                    );

                                    -- 2. Function to auto-prune logs (keep only the latest 1000)
                                    CREATE OR REPLACE FUNCTION public.prune_activity_logs()
                                    RETURNS void AS $$
                                    BEGIN
                                        DELETE FROM public.activity_logs
                                            WHERE id NOT IN (
                                                    SELECT id FROM public.activity_logs
                                                            ORDER BY created_at DESC
                                                                    LIMIT 1000
                                                                        );
                                                                        END;
                                                                        $$ LANGUAGE plpgsql SECURITY DEFINER;

                                                                        -- 3. Row-level trigger function for mutations
                                                                        CREATE OR REPLACE FUNCTION public.log_table_activity()
                                                                        RETURNS TRIGGER AS $$
                                                                        DECLARE
                                                                            v_source TEXT := 'Client';
                                                                                v_desc TEXT := '';
                                                                                BEGIN
                                                                                    -- Prevent infinite loop: do not log the activity_logs table itself
                                                                                        IF TG_TABLE_NAME = 'activity_logs' THEN
                                                                                                RETURN NULL;
                                                                                                    END IF;

                                                                                                        -- Determine source (Admin tables vs Client tables)
                                                                                                            IF TG_TABLE_NAME IN ('update_news_logs', 'update_news_config', 'public_news_articles', 'public_content', 'public_article_cache') THEN
                                                                                                                    v_source := 'Admin';
                                                                                                                        END IF;

                                                                                                                            IF (TG_OP = 'DELETE') THEN
                                                                                                                                    v_desc := 'Deleted record from ' || TG_TABLE_NAME;
                                                                                                                                            INSERT INTO public.activity_logs (table_name, action_type, description, source, record_id, old_data)
                                                                                                                                                    VALUES (TG_TABLE_NAME, TG_OP, v_desc, v_source, OLD.id::TEXT, row_to_json(OLD)::JSONB);
                                                                                                                                                            PERFORM public.prune_activity_logs();
                                                                                                                                                                    RETURN OLD;
                                                                                                                                                                        ELSIF (TG_OP = 'UPDATE') THEN
                                                                                                                                                                                v_desc := 'Updated record in ' || TG_TABLE_NAME;
                                                                                                                        INSERT INTO public.activity_logs (table_name, action_type, description, source, record_id, old_data, new_data)
                                                                                                                                VALUES (TG_TABLE_NAME, TG_OP, v_desc, v_source, NEW.id::TEXT, row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB);
                                                                                                                                        PERFORM public.prune_activity_logs();
                                                                                                                                                RETURN NEW;
                                                                                                                                                    ELSIF (TG_OP = 'INSERT') THEN
                                                                                                                                                            v_desc := 'New record in ' || TG_TABLE_NAME;
                                                                                                                                                                    INSERT INTO public.activity_logs (table_name, action_type, description, source, record_id, new_data)
                                                                                                                                                                            VALUES (TG_TABLE_NAME, TG_OP, v_desc, v_source, NEW.id::TEXT, row_to_json(NEW)::JSONB);
                                                                                                                                                                                    PERFORM public.prune_activity_logs();
                                                                                                                                                                                            RETURN NEW;
                                                                                                                                                                                                END IF;
                                                                                                                                                                                                    RETURN NULL;
                                                                                                                                                                                                    END;
                                                                                                                                                                                                    $$ LANGUAGE plpgsql SECURITY DEFINER;

                                                                                                                                                                                                    -- 4. DYNAMICALLY apply triggers to ALL EXISTING tables in the public schema
                                                                                                                                                                                                    DO $$
                                                                                                                                                                                                    DECLARE
                                                                                                                                                                                                        r RECORD;
                                                                                                                                                                                                        BEGIN
                                                                                                                                                                                                            FOR r IN 
                                                                                                                                                                                                                    SELECT table_name 
                                                                                                                                                                                                                            FROM information_schema.tables 
                                                                                                                                                                                                                                    WHERE table_schema = 'public' 
                                                                                                                                                                                                                                              AND table_type = 'BASE TABLE' 
                                                                                                                                                                                                                                                        AND table_name != 'activity_logs'
                                                                                                                                                                                                                                                            LOOP
                                                                                                                                                                                                                                                                    EXECUTE format('DROP TRIGGER IF EXISTS %I_activity_trigger ON public.%I', r.table_name, r.table_name);
                                                                                                                                                                                                                                                                            EXECUTE format('CREATE TRIGGER %I_activity_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_table_activity()', r.table_name, r.table_name);
                                                                                                                                                                                                                                                                                END LOOP;
                                                                                                                                                                                                                                                                                END;
                                                                                                                                                                                                                                                                                $$;

                                                                                                                                                                                                                                                                                -- 5. EVENT TRIGGER: Automatically apply trigger to any FUTURE tables created
                                                                                                                                                                                                                                                                                CREATE OR REPLACE FUNCTION public.attach_trigger_to_new_table()
                                                                                                                                                                                                                                                                                RETURNS event_trigger AS $$
                                                                                                                                                                                                                                                                                DECLARE
                                                                                                                                                                                                                                                                                    obj record;
                                                                                                                                                                                                                                                                                    BEGIN
                                                                                                                                                                                                                                                                                        FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
                                                                                                                                                                                                                                                                                            LOOP
                                                                                                                                                                                                                                                                                                    -- If a new table is created in the public schema (and it's not activity_logs)
                                                                                                                                                                                                                                                                                                            IF obj.object_type = 'table' AND obj.schema_name = 'public' AND obj.object_identity NOT LIKE '%activity_logs%' THEN
                                                                                                                                                                                                                                                                                                                        EXECUTE format('DROP TRIGGER IF EXISTS %I_activity_trigger ON %s', obj.object_identity, obj.object_identity);
                                                                                                                                                                                                                                                                                                                                    EXECUTE format('CREATE TRIGGER %I_activity_trigger AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION public.log_table_activity()', obj.object_identity, obj.object_identity);
                                                                                                                                                                                                                                                                                                                                            END IF;
                                                                                                                                                                                                                                                                                                                                                END LOOP;
                                                                                                                                                                                                                                                                                                                                                END;
                                                                                                                                                                                                                                                                                                                                                $$ LANGUAGE plpgsql SECURITY DEFINER;

                                                                                                                                                                                                                                                                                                                                                DROP EVENT TRIGGER IF EXISTS auto_add_activity_trigger;
                                                                                                                                                                                                                                                                                                                                                CREATE EVENT TRIGGER auto_add_activity_trigger
                                                                                                                                                                                                                                                                                                                                                ON ddl_command_end
                                                                                                                                                                                                                                                                                                                                                WHEN TAG IN ('CREATE TABLE')
                                                                                                                                                                                                                                                                                                                                                EXECUTE FUNCTION public.attach_trigger_to_new_table();

                                                                                                                                                                                                                                                                                                                                                -- 6. RPC Function for Frontend to log GET requests or custom events manually
                                                                                                                                                                                                                                                                                                                                                CREATE OR REPLACE FUNCTION public.log_frontend_activity(
                                                                                                                                                                                                                                                                                                                                                    p_table_name TEXT,
                                                                                                                                                                                                                                                                                                                                                        p_action_type TEXT,
                                                                                                                                                                                                                                                                                                                                                            p_description TEXT,
                                                                                                                                                                                                                                                                                                                                                                p_source TEXT,
                                                                                                                                                                                                                                                                                                                                                                    p_payload JSONB DEFAULT NULL
                                                                                                                                                                                                                                                                                                                                                                    )
                                                                                                                                                                                                                                                                                                                                                                    RETURNS void AS $$
                                                                                                                                                                                                                                                                                                                                                                    BEGIN
                                                                                                                                                                                                                                                                                                                                                                        INSERT INTO public.activity_logs (table_name, action_type, description, source, new_data)
                                                                                                                                                                                                                                                                                                                                                                            VALUES (p_table_name, p_action_type, p_description, p_source, p_payload);
                                                                                                                                                                                                                                                                                                                                                                                
                                                                                                                                                                                                                                                                                                                                                                                    PERFORM public.prune_activity_logs();
                                                                                                                                                                                                                                                                                                                                                                                    END;
                                                                                                                                                                                                                                                                                                                                                                                    $$ LANGUAGE plpgsql SECURITY DEFINER;

-- List Public Base Table Names
CREATE OR REPLACE FUNCTION get_all_tables()
RETURNS TABLE(table_name text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT t.table_name::text
    FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE';
      END; $$;

-- User Gallery Items with RLS Access Control
CREATE TABLE public.gallery_items (
      id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
              url TEXT NOT NULL,
                  type TEXT NOT NULL,
                      mime_type TEXT,
                          filename TEXT,
                              size BIGINT,
                                  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                                      width INTEGER,
                                          height INTEGER,
                                              duration INTEGER
                                              );

                                              -- Security Policies (RLS)
                                              ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

                                              CREATE POLICY "Users can view their own gallery items"
                                                  ON public.gallery_items FOR SELECT
                                                      USING (auth.uid() = user_id);

                                                      CREATE POLICY "Users can insert their own gallery items"
                                                          ON public.gallery_items FOR INSERT
                                                              WITH CHECK (auth.uid() = user_id);

                                                              CREATE POLICY "Users can update their own gallery items"
                                                                  ON public.gallery_items FOR UPDATE
                                                                      USING (auth.uid() = user_id);

                                                                      CREATE POLICY "Users can delete their own gallery items"
                                                                          ON public.gallery_items FOR DELETE
                                                                              USING (auth.uid() = user_id);


-- Dairy Items, Entries & Payments Schema
-- ========= EXTENSIONS =========
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========= DAIRY ITEMS =========
CREATE TABLE IF NOT EXISTS public.dairy_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  default_price numeric,
  unit text,
  icon text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ========= DAIRY ENTRIES =========
CREATE TABLE IF NOT EXISTS public.dairy_entries (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES public.dairy_items(id) ON DELETE SET NULL,
  quantity numeric NOT NULL,
  price_per_unit numeric NOT NULL,
  total_price numeric NOT NULL,
  entry_date date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ========= DAIRY PAYMENTS =========
CREATE TABLE IF NOT EXISTS public.dairy_payments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES public.dairy_items(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  payment_date date NOT NULL,
  method text,
  note text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ========= ENABLE RLS =========
ALTER TABLE public.dairy_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dairy_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dairy_payments ENABLE ROW LEVEL SECURITY;

-- ========= POLICIES =========

-- Dairy Items Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dairy_items' 
    AND policyname = 'Users can view their own dairy items'
  ) THEN
    CREATE POLICY "Users can view their own dairy items"
    ON public.dairy_items FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dairy_items' 
    AND policyname = 'Users can insert their own dairy items'
  ) THEN
    CREATE POLICY "Users can insert their own dairy items"
    ON public.dairy_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dairy_items' 
    AND policyname = 'Users can update their own dairy items'
  ) THEN
    CREATE POLICY "Users can update their own dairy items"
    ON public.dairy_items FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dairy_items' 
    AND policyname = 'Users can delete their own dairy items'
  ) THEN
    CREATE POLICY "Users can delete their own dairy items"
    ON public.dairy_items FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Dairy Entries Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dairy_entries' 
    AND policyname = 'Users can view their own dairy entries'
  ) THEN
    CREATE POLICY "Users can view their own dairy entries"
    ON public.dairy_entries FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dairy_entries' 
    AND policyname = 'Users can insert their own dairy entries'
  ) THEN
    CREATE POLICY "Users can insert their own dairy entries"
    ON public.dairy_entries FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dairy_entries' 
    AND policyname = 'Users can update their own dairy entries'
  ) THEN
    CREATE POLICY "Users can update their own dairy entries"
    ON public.dairy_entries FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dairy_entries' 
    AND policyname = 'Users can delete their own dairy entries'
  ) THEN
    CREATE POLICY "Users can delete their own dairy entries"
    ON public.dairy_entries FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Dairy Payments Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dairy_payments' 
    AND policyname = 'Users can view their own dairy payments'
  ) THEN
    CREATE POLICY "Users can view their own dairy payments"
    ON public.dairy_payments FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dairy_payments' 
    AND policyname = 'Users can insert their own dairy payments'
  ) THEN
    CREATE POLICY "Users can insert their own dairy payments"
    ON public.dairy_payments FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dairy_payments' 
    AND policyname = 'Users can update their own dairy payments'
  ) THEN
    CREATE POLICY "Users can update their own dairy payments"
    ON public.dairy_payments FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dairy_payments' 
    AND policyname = 'Users can delete their own dairy payments'
  ) THEN
    CREATE POLICY "Users can delete their own dairy payments"
    ON public.dairy_payments FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Dairy Inventory, Entries, and Payments Schema
-- Create Dairy Items Table
create table if not exists public.dairy_items (
  id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
      name text not null,
        default_price numeric not null default 0,
          unit text not null default 'liter',
            created_at timestamptz default now()
            );

            -- Create Dairy Entries Table
            create table if not exists public.dairy_entries (
              id uuid primary key default gen_random_uuid(),
                user_id uuid references auth.users(id) on delete cascade not null,
                  item_id uuid references public.dairy_items(id) on delete cascade not null,
                    quantity numeric not null default 1,
                      price_per_unit numeric not null,
                        total_price numeric not null,
                          entry_date date not null default current_date,
                            is_paid boolean default false,
                              note text,
                                created_at timestamptz default now()
                                );

                                -- Create Dairy Payments Table
                                create table if not exists public.dairy_payments (
                                  id uuid primary key default gen_random_uuid(),
                                    user_id uuid references auth.users(id) on delete cascade not null,
                                      amount numeric not null,
                                        payment_date date not null default current_date,
                                          note text,
                                            created_at timestamptz default now()
                                            );

                                            -- Enable RLS
                                            alter table public.dairy_items enable row level security;
                                            alter table public.dairy_entries enable row level security;
                                            alter table public.dairy_payments enable row level security;

                                            -- Create Policies
                                            create policy "Users can manage their own dairy items" on public.dairy_items
                                              for all using (auth.uid() = user_id);

                                              create policy "Users can manage their own dairy entries" on public.dairy_entries
                                                for all using (auth.uid() = user_id);

                                                create policy "Users can manage their own dairy payments" on public.dairy_payments
                                                  for all using (auth.uid() = user_id);

-- Voice Conversations Storage Setup
-- 1. Create a conversation table for voice conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner uuid NOT NULL,
  audio_url text
);
-- 1. Create a bucket for voice conversations
INSERT INTO storage.buckets (id, name, public) VALUES ('voice_conversations', 'voice_conversations', true);

-- 2. Allow authenticated users to upload their own voice conversations
CREATE POLICY "Users can upload their own voice conversations"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'voice_conversations' AND auth.uid() = owner);

-- 3. Allow authenticated users to view their own voice conversations
CREATE POLICY "Users can view their own voice conversations"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'voice_conversations' AND auth.uid() = owner);

-- 4. Add audio_url column to the conversations table
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- User Vehicles & Transaction Metadata Setup
-- 1. Create Vehicles Table
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        name TEXT NOT NULL, -- e.g. "Honda City"
          type TEXT NOT NULL DEFAULT 'car', -- 'car' or 'bike'
            number_plate TEXT, -- e.g. "MH 02 AB 1234"
              current_odometer NUMERIC(12, 2) DEFAULT 0 -- Stores the last known reading
              );

              COMMENT ON TABLE public.vehicles IS 'Stores user vehicles for fuel tracking.';
              ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

              CREATE POLICY "Users can manage their own vehicles." ON public.vehicles
                FOR ALL USING (auth.uid() = user_id);

                -- 2. Add Metadata column to Transactions (Flexible storage for extra data)
                ALTER TABLE public.finance_transactions
                ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add Location JSONB to Finance Transactions
ALTER TABLE public.finance_transactions 
ADD COLUMN IF NOT EXISTS location JSONB;

-- Finance Profiles and Transactions Schema
-- 1. Create Finance Profiles Table
CREATE TABLE IF NOT EXISTS public.finance_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        name TEXT NOT NULL,
          type TEXT CHECK (type IN ('personal', 'business', 'savings', 'project')),
            currency TEXT DEFAULT 'INR'
            );

            COMMENT ON TABLE public.finance_profiles IS 'Stores separate finance profiles or wallets for a user.';
            ALTER TABLE public.finance_profiles ENABLE ROW LEVEL SECURITY;

            CREATE POLICY "Users can manage their own finance profiles." ON public.finance_profiles
              FOR ALL USING (auth.uid() = user_id);

              -- 2. Update Transactions Table (Create if not exists, or Add Column)
              CREATE TABLE IF NOT EXISTS public.finance_transactions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                      transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
                        amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
                          type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
                            category TEXT,
                              description TEXT,
                                payment_method TEXT DEFAULT 'cash'
                                );

                                -- Add profile_id column if it doesn't exist (Safe Migration)
                                DO $$ 
                                BEGIN 
                                  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'finance_transactions' AND column_name = 'profile_id') THEN
                                      ALTER TABLE public.finance_transactions 
                                          ADD COLUMN profile_id UUID REFERENCES public.finance_profiles(id) ON DELETE CASCADE;
                                            END IF;
                                            END $$;

                                            COMMENT ON TABLE public.finance_transactions IS 'Stores financial transactions for the user.';
                                            ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

                                            -- Drop old policy if exists to avoid conflict, then recreate
                                            DROP POLICY IF EXISTS "Users can manage their own transactions." ON public.finance_transactions;
                                            CREATE POLICY "Users can manage their own transactions." ON public.finance_transactions
                                              FOR ALL USING (auth.uid() = user_id);

-- User Finance Transactions Table with RLS
-- 1. Create the finance_transactions table
CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
          amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
            type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
              category TEXT,
                description TEXT,
                  payment_method TEXT DEFAULT 'Cash'
                  );

                  -- 2. Add a comment for documentation
                  COMMENT ON TABLE public.finance_transactions IS 'Stores financial transactions for the user.';

                  -- 3. Enable Row Level Security (RLS)
                  ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

                  -- 4. Create a policy so users can only access their own data
                  -- This single policy covers SELECT, INSERT, UPDATE, and DELETE
                  CREATE POLICY "Users can manage their own transactions" 
                  ON public.finance_transactions
                  FOR ALL 
                  USING (auth.uid() = user_id);

                  -- 5. (Optional) Create an index on user_id and date for faster queries
                  CREATE INDEX IF NOT EXISTS idx_finance_user_date 
                  ON public.finance_transactions(user_id, transaction_date);

-- User Notes Storage with RLS
-- ========= NOTES TABLE =========
-- Stores user personal notes with rich text, tags, and theming.
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          title TEXT,
            content TEXT,
              tags TEXT[], -- Array of strings for categorization
                is_pinned BOOLEAN DEFAULT false,
                  color_theme TEXT DEFAULT 'default' -- For UI styling (e.g., 'amber', 'blue', 'green')
                  );

                  -- Add comment for documentation
                  COMMENT ON TABLE public.notes IS 'Stores user personal notes.';

                  -- Enable Row Level Security (RLS)
                  ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

                  -- Policy: Allow users to manage (CRUD) ONLY their own notes
                  CREATE POLICY "Users can manage their own notes." ON public.notes
                    FOR ALL USING (auth.uid() = user_id);

-- User UI Customization Settings
-- public.user_settings table mein UI customization columns add karein
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS ui_theme TEXT DEFAULT 'system',
ADD COLUMN IF NOT EXISTS ui_font TEXT DEFAULT 'Geist Sans',
ADD COLUMN IF NOT EXISTS ui_density TEXT DEFAULT 'comfortable';

-- Optional: Comment add kar dete hain taake future mein yaad rahe
COMMENT ON COLUMN public.user_settings.ui_theme IS 'User preference for app theme (light, dark, system)';
COMMENT ON COLUMN public.user_settings.ui_font IS 'User selected font family';
COMMENT ON COLUMN public.user_settings.ui_density IS 'Layout density: comfortable (default) or compact';

-- Function Execution Statistics
CREATE OR REPLACE FUNCTION get_function_stats()
RETURNS TABLE(
  function_name text,
    total_calls bigint,
      success_count bigint,
        error_count bigint,
          last_run timestamptz
          ) AS $$
          BEGIN
            RETURN QUERY
              SELECT
                  'News Updater'::text as function_name,
                      COUNT(*) as total_calls,
                          COUNT(*) FILTER (WHERE status = 'SUCCESS') as success_count,
                              COUNT(*) FILTER (WHERE status != 'SUCCESS') as error_count,
                                  MAX(created_at) as last_run
                                    FROM update_news_logs;
                                    END;
                                    $$ LANGUAGE plpgsql SECURITY DEFINER;

                                    GRANT EXECUTE ON FUNCTION get_function_stats() TO authenticated;
                                    GRANT EXECUTE ON FUNCTION get_function_stats() TO service_role;

-- Real-Time Table Statistics Function
-- Function to get real-time database statistics
CREATE OR REPLACE FUNCTION get_database_analytics()
RETURNS TABLE(
  table_name text,
    live_rows bigint,
      total_inserts bigint,
        total_updates bigint,
          total_deletes bigint
          ) AS $$
          BEGIN
            RETURN QUERY
              SELECT
                  relname::text as table_name,
                      n_live_tup as live_rows,
                          n_tup_ins as total_inserts,
                              n_tup_upd as total_updates,
                                  n_tup_del as total_deletes
                                    FROM pg_stat_user_tables
                                      WHERE schemaname = 'public'
                                        ORDER BY n_tup_ins DESC;
                                        END;
                                        $$ LANGUAGE plpgsql SECURITY DEFINER;

                                        -- Permissions setup
                                        REVOKE EXECUTE ON FUNCTION get_database_analytics() FROM PUBLIC;
                                        GRANT EXECUTE ON FUNCTION get_database_analytics() TO service_role;
                                        GRANT EXECUTE ON FUNCTION get_database_analytics() TO authenticated;

-- Atomic Article Stat Increment
-- ========= RPC for Atomic Stat Updates =========
CREATE OR REPLACE FUNCTION increment_article_stat(p_article_url TEXT, p_stat_type TEXT, p_amount INT)
RETURNS void AS $$
BEGIN
  -- Use dynamic SQL to update the correct column
    EXECUTE format('UPDATE public.public_news_articles SET %I = %I + %s WHERE article_data->>''url'' = %L',
                     p_stat_type, p_stat_type, p_amount, p_article_url);
                     END;
                     $$ LANGUAGE plpgsql;

-- Add Engagement Metrics to News Articles
-- ========= USER ARTICLE INTERACTIONS TABLE =========
-- Stores user-specific interactions with articles (likes, bookmarks).
CREATE TABLE public.user_article_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      article_url TEXT NOT NULL,
        liked BOOLEAN DEFAULT false,
          bookmarked BOOLEAN DEFAULT false
          );

          COMMENT ON TABLE public.user_article_interactions IS 'Stores user-specific interactions like liking or bookmarking news articles.';

          -- Create a unique index to prevent duplicate entries per user per article.
          CREATE UNIQUE INDEX user_article_interactions_user_article_idx ON public.user_article_interactions(user_id, article_url);

          ALTER TABLE public.user_article_interactions ENABLE ROW LEVEL SECURITY;

          CREATE POLICY "Users can manage their own article interactions." ON public.user_article_interactions
            FOR ALL USING (auth.uid() = user_id);

-- Add Engagement Metrics to News Articles
-- Adds columns for views, likes, and bookmarks to the public news articles table.
ALTER TABLE public.public_news_articles
ADD COLUMN IF NOT EXISTS views INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS likes INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS bookmarks INT DEFAULT 0;

-- Update News Function Run Logs
-- ========= UPDATE NEWS LOGS TABLE =========
-- Stores logs from the 'update-news' function.
CREATE TABLE IF NOT EXISTS public.update_news_logs (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      status TEXT, -- 'SUCCESS' or 'FAILURE'
        duration_ms INT,
          summary JSONB, -- Stores the summary array from the logger
            details TEXT -- Stores the full raw log string
            );
            COMMENT ON TABLE public.update_news_logs IS 'Logs each run of the update-news edge function.';
            ALTER TABLE public.update_news_logs ENABLE ROW LEVEL SECURITY;
            CREATE POLICY "Allow read access to everyone for news logs" ON public.update_news_logs
              FOR SELECT USING (true);
              -- Service role will be used to insert logs, so no INSERT policy needed for users.

             

-- Article Conversation History
-- This creates a new public table to cache article content globally.
-- All users can read from this, and any authenticated user can add to it.
-- This avoids re-fetching the same article for different users.
CREATE TABLE public.public_article_cache (
  article_url TEXT PRIMARY KEY,
    title TEXT,
      content TEXT,
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        COMMENT ON TABLE public.public_article_cache IS 'Stores globally cached article content fetched from URLs to reduce redundant API calls.';

        ALTER TABLE public.public_article_cache ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Public article cache is viewable by everyone."
        ON public.public_article_cache FOR SELECT USING (true);

        CREATE POLICY "Authenticated users can insert new article content."
        ON public.public_article_cache FOR INSERT TO authenticated WITH CHECK (true);


        -- This removes the content column from the user-specific article conversation table,
        -- as the content is now stored in the global public_article_cache table.
        ALTER TABLE public.article_conversations
        DROP COLUMN IF EXISTS article_content;

-- Public News Articles Table
-- 1. DROP the old 'processed_articles' table as it's no longer needed.
DROP TABLE IF EXISTS public.processed_articles;

-- 2. DROP the old 'public_news_articles' table to recreate it with the new structure.
DROP TABLE IF EXISTS public.public_news_articles;

-- 3. Create the new table to store news articles with formatted content.
CREATE TABLE public.public_news_articles (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      category TEXT NOT NULL,
        article_data JSONB NOT NULL,
          formatted_content_md JSONB -- To store the Gemini-formatted markdown
          );

          -- 4. Add comments for clarity
          COMMENT ON TABLE public.public_news_articles IS 'Stores news articles fetched and pre-formatted by a cron job, visible to all users.';
          COMMENT ON COLUMN public.public_news_articles.formatted_content_md IS 'Stores the Gemini-formatted summary of the article as a JSON object: {"markdown": "..."}';

          -- 5. Enable Row Level Security (RLS)
          ALTER TABLE public.public_news_articles ENABLE ROW LEVEL SECURITY;

          -- 6. Policy: Allow public read access to everyone
          CREATE POLICY "Public news articles are viewable by everyone."
          ON public.public_news_articles FOR SELECT USING (true);

          -- 7. Policy: Allow only service_role to manage articles (for the Edge Function)
          CREATE POLICY "Allow full access for service_role"
          ON public.public_news_articles FOR ALL
          USING (auth.role() = 'service_role')
          WITH CHECK (auth.role() = 'service_role');

          -- 8. Create an index for faster queries by category
          CREATE INDEX idx_news_category ON public.public_news_articles(category);

-- Article Conversation History
-- ========= ARTICLE CONVERSATIONS TABLE =========
-- Stores follow-up chats for specific news articles.
CREATE TABLE public.article_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          article_url TEXT NOT NULL,
            article_title TEXT,
              messages JSONB
              );
              COMMENT ON TABLE public.article_conversations IS 'Stores follow-up conversations for news articles.';

              -- Create a unique index to allow upserting based on user and article
              CREATE UNIQUE INDEX article_conversations_user_article_idx ON public.article_conversations(user_id, article_url);

              -- Enable Row Level Security
              ALTER TABLE public.article_conversations ENABLE ROW LEVEL SECURITY;

              -- Create policy for user access
              CREATE POLICY "Users can manage their own article conversations." ON public.article_conversations
                FOR ALL USING (auth.uid() = user_id);

-- Hourly Edge News Sync Job
-- Required Extensions to let database hit edge functions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
    'hourly-news-update', -- job ka ek unique naam
    '0 * * * *', -- iska matlab hai "har ghante ke shuru mein"
    $$
    SELECT net.http_post(
        url:='https://<<TUMHARA_NAYA_PROJECT_REFERENCE_ID>>.supabase.co/functions/v1/update-news',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer <<TUMHARI_NAYI_SERVICE_ROLE_KEY>>"}'::jsonb,
        body:='{}'::jsonb,
        timeout_milliseconds:=10000
    ) AS "request_id";
    $$
);

-- Central Public News Articles Table
-- Create a new table to store news articles centrally
CREATE TABLE public.public_news_articles (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      category TEXT NOT NULL,
        article_data JSONB NOT NULL
        );

        -- Add comments for clarity
        COMMENT ON TABLE public.public_news_articles IS 'Stores news articles fetched by a cron job, visible to all users.';
        COMMENT ON COLUMN public.public_news_articles.category IS 'The category of the news (e.g., technology, business).';
        COMMENT ON COLUMN public.public_news_articles.article_data IS 'The JSON object for a single news article.';

        -- Enable Row Level Security (RLS)
        ALTER TABLE public.public_news_articles ENABLE ROW LEVEL SECURITY;

        -- Policy: Allow public read access to everyone
        CREATE POLICY "Public news articles are viewable by everyone."
        ON public.public_news_articles FOR SELECT
        USING (true);

        -- Policy: Allow only the service_role to insert, update, or delete.
        -- The Edge Function will use this role.
        CREATE POLICY "Allow full access for service_role"
        ON public.public_news_articles FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');

        -- Create an index on the category for faster queries
        CREATE INDEX idx_news_category ON public.public_news_articles(category);

        -- Now, we can remove the old user-specific news cache from the user_settings table
        ALTER TABLE public.user_settings DROP COLUMN IF EXISTS news_cache;

-- User Settings Storage with RLS Automation
-- ========= USER SETTINGS TABLE =========
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  api_key TEXT,
  voice_mode_voice TEXT,
  voice_mode_persona_instruction TEXT,
  voice_mode_tone_instruction TEXT,
  voice_mode_custom_instruction TEXT,
  voice_proactive_mode BOOLEAN,
  translator_usage JSONB
);

COMMENT ON TABLE public.user_settings IS 'Stores individual settings for each user.';

-- Enable Row Level Security (safe)
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ========= POLICIES =========
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_settings' 
    AND policyname = 'Users can manage their own settings.'
  ) THEN
    CREATE POLICY "Users can manage their own settings."
    ON public.user_settings
    FOR ALL
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- ========= FUNCTION =========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles (safe)
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert into user_settings (safe)
  INSERT INTO public.user_settings (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========= TRIGGER =========
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END $$;

-- Public user uploads bucket with RLS policies
-- Create a new bucket for user file uploads and make it public.
INSERT INTO storage.buckets (id, name, public)
VALUES ('user_uploads', 'user_uploads', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for 'user_uploads' bucket
-- Policy: Allow public read access to all uploaded files.
CREATE POLICY "Uploaded files are publicly accessible."
ON storage.objects FOR SELECT
USING ( bucket_id = 'user_uploads' );

-- Policy: Allow authenticated users to upload files into their own folder.
-- The path in the app should be: `${user.id}/${...}`.
CREATE POLICY "Users can upload their own files."
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'user_uploads' AND auth.uid() = (storage.foldername(name))[1]::uuid );

-- Policy: Allow users to delete their own files.
CREATE POLICY "Users can delete their own files."
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'user_uploads' AND auth.uid() = (storage.foldername(name))[1]::uuid );

-- Public user uploads bucket with RLS policies
-- Create profiles table first if it doesn't exist to prevent errors
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Add new columns for full name and avatar URL to the profiles table safely
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update the function to handle the new 'full_name' field during user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a new row into public.profiles, now including full_name
    INSERT INTO public.profiles (id, full_name, avatar_url)
      VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
    ON CONFLICT (id) DO NOTHING;
        RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- == SUPABASE STORAGE SETUP FOR AVATARS ==

-- 1. Create a new bucket named 'avatars' and make it public
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Set up Row Level Security (RLS) policies for the 'avatars' bucket

-- Policy: Allow anyone to view all avatars
CREATE POLICY "Avatar images are publicly accessible."
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Policy: Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload their own avatar."
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid );

-- Policy: Allow users to update their own avatar
CREATE POLICY "Users can update their own avatar."
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid );

-- Policy: Allow users to delete their own avatar
CREATE POLICY "Users can delete their own avatar."
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid );