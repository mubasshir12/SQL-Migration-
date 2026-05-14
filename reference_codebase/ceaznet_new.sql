-- FULL IDEMPOTENT NOTES + DAIRY + GALLERY + MOLECULES SYSTEM
-- =========================================================
-- FULL IDEMPOTENT NOTES + DAIRY + GALLERY + MOLECULES SYSTEM
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- 1. NOTES TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    title TEXT,

    content TEXT,

    tags TEXT[],

    is_pinned BOOLEAN DEFAULT false,

    color_theme TEXT DEFAULT 'default'
);

COMMENT ON TABLE public.notes
IS 'Stores user personal notes.';

ALTER TABLE public.notes
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS
"Users can manage their own notes."
ON public.notes;

CREATE POLICY
"Users can manage their own notes."
ON public.notes
FOR ALL
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notes_user
ON public.notes(user_id);

CREATE INDEX IF NOT EXISTS idx_notes_pinned
ON public.notes(is_pinned);

-- =========================================================
-- 2. DAIRY ITEMS TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.dairy_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    user_id UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

    name TEXT NOT NULL,

    default_price NUMERIC,

    unit TEXT,

    icon TEXT,

    created_at TIMESTAMPTZ NOT NULL
    DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.dairy_items
ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- DAIRY ITEMS POLICIES
-- =========================================================

DROP POLICY IF EXISTS
"Users can view their own dairy items"
ON public.dairy_items;

CREATE POLICY
"Users can view their own dairy items"
ON public.dairy_items
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS
"Users can insert their own dairy items"
ON public.dairy_items;

CREATE POLICY
"Users can insert their own dairy items"
ON public.dairy_items
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS
"Users can update their own dairy items"
ON public.dairy_items;

CREATE POLICY
"Users can update their own dairy items"
ON public.dairy_items
FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS
"Users can delete their own dairy items"
ON public.dairy_items;

CREATE POLICY
"Users can delete their own dairy items"
ON public.dairy_items
FOR DELETE
USING (auth.uid() = user_id);

-- =========================================================
-- 3. DAIRY ENTRIES TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.dairy_entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    user_id UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

    item_id UUID
    REFERENCES public.dairy_items(id)
    ON DELETE SET NULL,

    quantity NUMERIC NOT NULL,

    price_per_unit NUMERIC NOT NULL,

    total_price NUMERIC NOT NULL,

    entry_date DATE NOT NULL,

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL
    DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.dairy_entries
ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- DAIRY ENTRIES POLICIES
-- =========================================================

DROP POLICY IF EXISTS
"Users can view their own dairy entries"
ON public.dairy_entries;

CREATE POLICY
"Users can view their own dairy entries"
ON public.dairy_entries
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS
"Users can insert their own dairy entries"
ON public.dairy_entries;

CREATE POLICY
"Users can insert their own dairy entries"
ON public.dairy_entries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS
"Users can update their own dairy entries"
ON public.dairy_entries;

CREATE POLICY
"Users can update their own dairy entries"
ON public.dairy_entries
FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS
"Users can delete their own dairy entries"
ON public.dairy_entries;

CREATE POLICY
"Users can delete their own dairy entries"
ON public.dairy_entries
FOR DELETE
USING (auth.uid() = user_id);

-- =========================================================
-- 4. DAIRY PAYMENTS TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.dairy_payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    user_id UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

    item_id UUID
    REFERENCES public.dairy_items(id)
    ON DELETE SET NULL,

    amount NUMERIC NOT NULL,

    payment_date DATE NOT NULL,

    method TEXT,

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL
    DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.dairy_payments
ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- DAIRY PAYMENTS POLICIES
-- =========================================================

DROP POLICY IF EXISTS
"Users can view their own dairy payments"
ON public.dairy_payments;

CREATE POLICY
"Users can view their own dairy payments"
ON public.dairy_payments
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS
"Users can insert their own dairy payments"
ON public.dairy_payments;

CREATE POLICY
"Users can insert their own dairy payments"
ON public.dairy_payments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS
"Users can update their own dairy payments"
ON public.dairy_payments;

CREATE POLICY
"Users can update their own dairy payments"
ON public.dairy_payments
FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS
"Users can delete their own dairy payments"
ON public.dairy_payments;

CREATE POLICY
"Users can delete their own dairy payments"
ON public.dairy_payments
FOR DELETE
USING (auth.uid() = user_id);

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_dairy_items_user
ON public.dairy_items(user_id);

CREATE INDEX IF NOT EXISTS idx_dairy_entries_user
ON public.dairy_entries(user_id);

CREATE INDEX IF NOT EXISTS idx_dairy_entries_date
ON public.dairy_entries(entry_date);

CREATE INDEX IF NOT EXISTS idx_dairy_payments_user
ON public.dairy_payments(user_id);

CREATE INDEX IF NOT EXISTS idx_dairy_payments_date
ON public.dairy_payments(payment_date);

-- =========================================================
-- 5. GALLERY ITEMS TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.gallery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

    url TEXT NOT NULL,

    type TEXT NOT NULL,

    mime_type TEXT,

    filename TEXT,

    size BIGINT,

    width INTEGER,

    height INTEGER,

    duration INTEGER,

    created_at TIMESTAMPTZ
    DEFAULT NOW()
);

ALTER TABLE public.gallery_items
ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- GALLERY POLICIES
-- =========================================================

DROP POLICY IF EXISTS
"Users can view their own gallery items"
ON public.gallery_items;

CREATE POLICY
"Users can view their own gallery items"
ON public.gallery_items
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS
"Users can insert their own gallery items"
ON public.gallery_items;

CREATE POLICY
"Users can insert their own gallery items"
ON public.gallery_items
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS
"Users can update their own gallery items"
ON public.gallery_items;

CREATE POLICY
"Users can update their own gallery items"
ON public.gallery_items
FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS
"Users can delete their own gallery items"
ON public.gallery_items;

CREATE POLICY
"Users can delete their own gallery items"
ON public.gallery_items
FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gallery_items_user
ON public.gallery_items(user_id);

CREATE INDEX IF NOT EXISTS idx_gallery_items_type
ON public.gallery_items(type);

-- =========================================================
-- 6. USER MOLECULES TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.user_molecules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

    name TEXT NOT NULL,

    data JSONB NOT NULL,

    settings JSONB NOT NULL,

    is_favorite BOOLEAN DEFAULT true,

    last_viewed_at TIMESTAMPTZ DEFAULT now(),

    created_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(user_id, name)
);

ALTER TABLE public.user_molecules
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS
"Users can manage their own saved molecules."
ON public.user_molecules;

CREATE POLICY
"Users can manage their own saved molecules."
ON public.user_molecules
FOR ALL
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_molecules_user
ON public.user_molecules(user_id);

CREATE INDEX IF NOT EXISTS idx_user_molecules_favorite
ON public.user_molecules(is_favorite);

-- =========================================================
-- 7. USER SETTINGS SAFE MIGRATION
-- =========================================================

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS last_molecule TEXT;

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS last_molecule_settings JSONB;

-- =========================================================
-- 8. REALTIME
-- =========================================================

ALTER PUBLICATION supabase_realtime
ADD TABLE public.user_molecules;

-- =========================================================
-- DONE
-- =========================================================

-- FULL IDEMPOTENT BROADCAST + SUPPORT SYSTEM
-- =========================================================
-- FULL IDEMPOTENT BROADCAST + SUPPORT SYSTEM
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- 1. BROADCASTS TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title TEXT,

    raw_html TEXT,

    status TEXT DEFAULT 'draft',

    type VARCHAR(50) DEFAULT 'popup',

    banner_type VARCHAR(50),

    display_type TEXT DEFAULT 'popup',

    is_active BOOLEAN DEFAULT false,

    is_dismissible BOOLEAN DEFAULT true,

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
    DEFAULT timezone('utc'::text, now()),

    sent_at TIMESTAMPTZ
);

-- =========================================================
-- SAFE COLUMN MIGRATIONS
-- =========================================================

ALTER TABLE public.broadcasts
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE public.broadcasts
ADD COLUMN IF NOT EXISTS is_dismissible BOOLEAN DEFAULT true;

ALTER TABLE public.broadcasts
ADD COLUMN IF NOT EXISTS display_type TEXT DEFAULT 'popup';

ALTER TABLE public.broadcasts
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'popup';

ALTER TABLE public.broadcasts
ADD COLUMN IF NOT EXISTS banner_type VARCHAR(50);

ALTER TABLE public.broadcasts
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Backfill null type values
UPDATE public.broadcasts
SET type = 'popup'
WHERE type IS NULL;

-- =========================================================
-- RLS
-- =========================================================

ALTER TABLE public.broadcasts
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users"
ON public.broadcasts;

CREATE POLICY "Enable all for authenticated users"
ON public.broadcasts
FOR ALL
USING (auth.role() = 'authenticated');

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_broadcasts_status
ON public.broadcasts(status);

CREATE INDEX IF NOT EXISTS idx_broadcasts_active
ON public.broadcasts(is_active);

CREATE INDEX IF NOT EXISTS idx_broadcasts_type
ON public.broadcasts(type);

CREATE INDEX IF NOT EXISTS idx_broadcasts_expires
ON public.broadcasts(expires_at);

-- =========================================================
-- 2. BROADCAST ITERATIONS TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.broadcast_iterations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    broadcast_id UUID
    REFERENCES public.broadcasts(id)
    ON DELETE CASCADE,

    role TEXT NOT NULL,

    content TEXT NOT NULL,

    created_at TIMESTAMPTZ
    DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.broadcast_iterations
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users"
ON public.broadcast_iterations;

CREATE POLICY "Enable all for authenticated users"
ON public.broadcast_iterations
FOR ALL
USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_broadcast_iterations_broadcast
ON public.broadcast_iterations(broadcast_id);

-- =========================================================
-- 3. SUPPORT CONVERSATIONS TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.support_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

    type VARCHAR(20) NOT NULL
    CHECK (type IN ('chat', 'mail')),

    subject TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'pending')),

    created_at TIMESTAMPTZ NOT NULL
    DEFAULT timezone('utc'::text, now()),

    updated_at TIMESTAMPTZ NOT NULL
    DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.support_conversations
ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SUPPORT CONVERSATION POLICIES
-- =========================================================

DROP POLICY IF EXISTS
"Users can view their own support conversations"
ON public.support_conversations;

CREATE POLICY
"Users can view their own support conversations"
ON public.support_conversations
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS
"Users can create their own support conversations"
ON public.support_conversations;

CREATE POLICY
"Users can create their own support conversations"
ON public.support_conversations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS
"Users can delete their own support conversations"
ON public.support_conversations;

CREATE POLICY
"Users can delete their own support conversations"
ON public.support_conversations
FOR DELETE
USING (auth.uid() = user_id);

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_support_conversations_user
ON public.support_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_support_conversations_status
ON public.support_conversations(status);

-- =========================================================
-- 4. SUPPORT MESSAGES TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    conversation_id UUID
    REFERENCES public.support_conversations(id)
    ON DELETE CASCADE,

    sender_id UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

    sender_type VARCHAR(20)
    CHECK (sender_type IN ('user', 'admin')),

    message TEXT NOT NULL,

    is_read BOOLEAN DEFAULT FALSE,

    read_at TIMESTAMPTZ NULL,

    attachment_url TEXT,

    attachment_name TEXT,

    attachment_type TEXT,

    created_at TIMESTAMPTZ NOT NULL
    DEFAULT timezone('utc'::text, now())
);

-- =========================================================
-- SAFE COLUMN MIGRATIONS
-- =========================================================

ALTER TABLE public.support_messages
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

ALTER TABLE public.support_messages
ADD COLUMN IF NOT EXISTS attachment_name TEXT;

ALTER TABLE public.support_messages
ADD COLUMN IF NOT EXISTS attachment_type TEXT;

ALTER TABLE public.support_messages
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ NULL;

ALTER TABLE public.support_messages
ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SUPPORT MESSAGE POLICIES
-- =========================================================

DROP POLICY IF EXISTS
"Users can view messages in their conversations"
ON public.support_messages;

CREATE POLICY
"Users can view messages in their conversations"
ON public.support_messages
FOR SELECT
USING (
    conversation_id IN (
        SELECT id
        FROM public.support_conversations
        WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS
"Users can insert messages in their conversations"
ON public.support_messages;

CREATE POLICY
"Users can insert messages in their conversations"
ON public.support_messages
FOR INSERT
WITH CHECK (
    conversation_id IN (
        SELECT id
        FROM public.support_conversations
        WHERE user_id = auth.uid()
    )
    AND sender_type = 'user'
    AND sender_id = auth.uid()
);

DROP POLICY IF EXISTS
"Users can update messages setting is_read"
ON public.support_messages;

CREATE POLICY
"Users can update messages setting is_read"
ON public.support_messages
FOR UPDATE
USING (
    conversation_id IN (
        SELECT id
        FROM public.support_conversations
        WHERE user_id = auth.uid()
    )
    AND sender_type = 'admin'
)
WITH CHECK (
    conversation_id IN (
        SELECT id
        FROM public.support_conversations
        WHERE user_id = auth.uid()
    )
    AND sender_type = 'admin'
    AND is_read = true
);

DROP POLICY IF EXISTS
"Users can delete messages in their conversations"
ON public.support_messages;

CREATE POLICY
"Users can delete messages in their conversations"
ON public.support_messages
FOR DELETE
USING (
    conversation_id IN (
        SELECT id
        FROM public.support_conversations
        WHERE user_id = auth.uid()
    )
);

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_support_messages_conversation
ON public.support_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_support_messages_sender
ON public.support_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_support_messages_read
ON public.support_messages(is_read);

-- =========================================================
-- 5. REALTIME
-- =========================================================

ALTER PUBLICATION supabase_realtime
ADD TABLE public.broadcasts;

ALTER PUBLICATION supabase_realtime
ADD TABLE public.support_conversations;

ALTER PUBLICATION supabase_realtime
ADD TABLE public.support_messages;

-- =========================================================
-- DONE
-- =========================================================

-- ADMIN DATABASE MANAGEMENT RPC SYSTEM
-- =========================================================
-- ADMIN DATABASE MANAGEMENT RPC SYSTEM
-- FULL IDEMPOTENT MERGED VERSION
-- =========================================================

-- =========================================================
-- 1. DROP OLD FUNCTION SAFELY
-- (Required because return type changed)
-- =========================================================

DROP FUNCTION IF EXISTS public.get_all_tables();

-- =========================================================
-- 2. GET ALL TABLES + SEQUENCE DETECTION
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_all_tables()
RETURNS TABLE(
    table_name text,
    has_sequence boolean
)
AS $$
BEGIN

    RETURN QUERY
    SELECT
        t.tablename::text,

        EXISTS (
            SELECT 1
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = t.tablename
              AND (
                    c.column_default LIKE 'nextval(%'
                    OR c.is_identity = 'YES'
              )
        ) AS has_sequence

    FROM pg_tables t
    WHERE t.schemaname = 'public'

    ORDER BY t.tablename;

END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;

-- =========================================================
-- 3. ADMIN TRUNCATE TABLE FUNCTION
-- WITH ACTIVITY LOGGING
-- =========================================================

CREATE OR REPLACE FUNCTION public.admin_truncate_table(
    target_table_name TEXT
)
RETURNS void AS $$
BEGIN

    -- Prevent deleting activity logs accidentally
    IF target_table_name = 'activity_logs' THEN
        RAISE EXCEPTION 'Cannot truncate activity_logs table';
    END IF;

    -- Manual activity log
    INSERT INTO public.activity_logs (
        table_name,
        action_type,
        description,
        source
    )
    VALUES (
        target_table_name,
        'DELETE',
        'Admin deleted ALL data (TRUNCATE) from ' || target_table_name,
        'Admin'
    );

    -- Execute truncate safely
    EXECUTE format(
        'TRUNCATE TABLE public.%I CASCADE',
        target_table_name
    );

END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;

-- =========================================================
-- 4. ADMIN RESET SEQUENCE FUNCTION
-- WITH ACTIVITY LOGGING
-- =========================================================

CREATE OR REPLACE FUNCTION public.admin_reset_sequence(
    target_table_name TEXT
)
RETURNS void AS $$
DECLARE
    seq_name TEXT;
BEGIN

    -- Find associated sequence
    SELECT pg_get_serial_sequence(
        'public.' || target_table_name,
        'id'
    )
    INTO seq_name;

    IF seq_name IS NOT NULL THEN

        -- Restart sequence
        EXECUTE format(
            'ALTER SEQUENCE %s RESTART WITH 1',
            seq_name
        );

        -- Manual activity log
        INSERT INTO public.activity_logs (
            table_name,
            action_type,
            description,
            source
        )
        VALUES (
            target_table_name,
            'UPDATE',
            'Admin reset ID sequence for ' || target_table_name,
            'Admin'
        );

    ELSE

        RAISE NOTICE
        'No sequence found for table % on column id',
        target_table_name;

    END IF;

END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;

-- =========================================================
-- 5. ADMIN DROP TABLE FUNCTION
-- WITH ACTIVITY LOGGING
-- =========================================================

CREATE OR REPLACE FUNCTION public.admin_drop_table(
    target_table_name TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN

    -- Prevent dropping critical tables
    IF target_table_name IN (
        'activity_logs'
    ) THEN
        RAISE EXCEPTION
        'Cannot drop protected table: %',
        target_table_name;
    END IF;

    -- Manual activity log
    INSERT INTO public.activity_logs (
        table_name,
        action_type,
        description,
        source
    )
    VALUES (
        target_table_name,
        'DELETE',
        'Admin dropped table ' || target_table_name,
        'Admin'
    );

    -- Drop table safely
    EXECUTE format(
        'DROP TABLE IF EXISTS public.%I CASCADE',
        target_table_name
    );

END;
$$;

-- =========================================================
-- 6. OPTIONAL EXECUTE PERMISSIONS
-- =========================================================

REVOKE ALL
ON FUNCTION public.get_all_tables()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.admin_truncate_table(TEXT)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.admin_reset_sequence(TEXT)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.admin_drop_table(TEXT)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.get_all_tables()
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.admin_truncate_table(TEXT)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.admin_reset_sequence(TEXT)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.admin_drop_table(TEXT)
TO authenticated;

-- =========================================================
-- DONE
-- =========================================================

-- FULL IDEMPOTENT NEWS + ACTIVITY SYSTEM SETUP
-- =========================================================
-- FULL IDEMPOTENT NEWS + ACTIVITY SYSTEM SETUP
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1. ACTIVITY LOGS TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    description TEXT,
    source TEXT,
    record_id TEXT,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to authenticated users"
ON public.activity_logs;

CREATE POLICY "Allow full access to authenticated users"
ON public.activity_logs
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =========================================================
-- 2. PRUNE ACTIVITY LOGS FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION public.prune_activity_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.activity_logs
    WHERE id NOT IN (
        SELECT id
        FROM public.activity_logs
        ORDER BY created_at DESC
        LIMIT 1000
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 3. LOG TABLE ACTIVITY FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION public.log_table_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_source TEXT := 'Client';
    v_desc TEXT := '';
BEGIN

    -- Prevent recursion
    IF TG_TABLE_NAME = 'activity_logs' THEN
        RETURN NULL;
    END IF;

    -- Admin tables
    IF TG_TABLE_NAME IN (
        'update_news_logs',
        'update_news_config',
        'public_news_articles',
        'public_content',
        'public_article_cache',
        'news_api_keys',
        'news_system_config',
        'api_key_audit_logs'
    ) THEN
        v_source := 'Admin';
    END IF;

    -- DELETE
    IF TG_OP = 'DELETE' THEN

        v_desc := 'Deleted record from ' || TG_TABLE_NAME;

        INSERT INTO public.activity_logs (
            table_name,
            action_type,
            description,
            source,
            record_id,
            old_data
        )
        VALUES (
            TG_TABLE_NAME,
            TG_OP,
            v_desc,
            v_source,
            OLD.id::TEXT,
            row_to_json(OLD)::JSONB
        );

        PERFORM public.prune_activity_logs();

        RETURN OLD;

    -- UPDATE
    ELSIF TG_OP = 'UPDATE' THEN

        v_desc := 'Updated record in ' || TG_TABLE_NAME;

        INSERT INTO public.activity_logs (
            table_name,
            action_type,
            description,
            source,
            record_id,
            old_data,
            new_data
        )
        VALUES (
            TG_TABLE_NAME,
            TG_OP,
            v_desc,
            v_source,
            NEW.id::TEXT,
            row_to_json(OLD)::JSONB,
            row_to_json(NEW)::JSONB
        );

        PERFORM public.prune_activity_logs();

        RETURN NEW;

    -- INSERT
    ELSIF TG_OP = 'INSERT' THEN

        v_desc := 'Inserted record into ' || TG_TABLE_NAME;

        INSERT INTO public.activity_logs (
            table_name,
            action_type,
            description,
            source,
            record_id,
            new_data
        )
        VALUES (
            TG_TABLE_NAME,
            TG_OP,
            v_desc,
            v_source,
            NEW.id::TEXT,
            row_to_json(NEW)::JSONB
        );

        PERFORM public.prune_activity_logs();

        RETURN NEW;

    END IF;

    RETURN NULL;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 4. EVENT TRIGGER FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION public.attach_trigger_to_new_table()
RETURNS event_trigger AS $$
DECLARE
    obj RECORD;
    table_name TEXT;
    trigger_name TEXT;
BEGIN

    FOR obj IN
        SELECT *
        FROM pg_event_trigger_ddl_commands()
        WHERE command_tag = 'CREATE TABLE'
    LOOP

        table_name := obj.object_identity;

        trigger_name :=
            replace(table_name, '.', '_')
            || '_activity_trigger';

        BEGIN

            EXECUTE format(
                'DROP TRIGGER IF EXISTS %I ON %s',
                trigger_name,
                table_name
            );

            EXECUTE format(
                'CREATE TRIGGER %I
                 AFTER INSERT OR UPDATE OR DELETE
                 ON %s
                 FOR EACH ROW
                 EXECUTE FUNCTION public.log_table_activity()',
                trigger_name,
                table_name
            );

        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed attaching trigger on %', table_name;
        END;

    END LOOP;

END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 5. CREATE EVENT TRIGGER SAFELY
-- =========================================================

DROP EVENT TRIGGER IF EXISTS auto_attach_activity_trigger;

CREATE EVENT TRIGGER auto_attach_activity_trigger
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE')
EXECUTE FUNCTION public.attach_trigger_to_new_table();

-- =========================================================
-- 6. GET ALL TABLES RPC
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_all_tables()
RETURNS TABLE(table_name text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT t.table_name::text
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE';
END;
$$;

-- =========================================================
-- 7. NEWS API KEYS TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.news_api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    provider TEXT NOT NULL,

    api_key TEXT NOT NULL UNIQUE,

    account_name TEXT,

    status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'exhausted')),

    calls_count INTEGER NOT NULL DEFAULT 0,

    failure_count INTEGER NOT NULL DEFAULT 0,

    last_used_at TIMESTAMPTZ,

    last_used_category TEXT,

    last_failed_at TIMESTAMPTZ,

    last_error_message TEXT,

    cooldown_until TIMESTAMPTZ,

    created_at TIMESTAMPTZ
    DEFAULT timezone('utc'::text, now())
    NOT NULL
);

-- Safe provider constraint reset
ALTER TABLE public.news_api_keys
DROP CONSTRAINT IF EXISTS news_api_keys_provider_check;

ALTER TABLE public.news_api_keys
ADD CONSTRAINT news_api_keys_provider_check
CHECK (
    provider IN ('gnews', 'gemini', 'brevo')
);

ALTER TABLE public.news_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to authenticated users"
ON public.news_api_keys;

CREATE POLICY "Allow full access to authenticated users"
ON public.news_api_keys
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =========================================================
-- 8. API KEY AUDIT LOGS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.api_key_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    failed_key_id UUID
    REFERENCES public.news_api_keys(id),

    fallback_key_id UUID
    REFERENCES public.news_api_keys(id),

    category TEXT,

    error_reason TEXT,

    created_at TIMESTAMPTZ
    DEFAULT timezone('utc'::text, now())
    NOT NULL
);

ALTER TABLE public.api_key_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to authenticated users"
ON public.api_key_audit_logs;

CREATE POLICY "Allow full access to authenticated users"
ON public.api_key_audit_logs
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =========================================================
-- 9. NEWS SYSTEM CONFIG
-- =========================================================

CREATE TABLE IF NOT EXISTS public.news_system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    config_key TEXT UNIQUE NOT NULL,

    config_value JSONB NOT NULL,

    description TEXT,

    updated_at TIMESTAMPTZ
    DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.news_system_config
ENABLE ROW LEVEL SECURITY;

INSERT INTO public.news_system_config (
    config_key,
    config_value,
    description
)
VALUES
(
    'formatting_model',
    '"gemini-2.5-flash"',
    'Model used for formatting articles'
),
(
    'summary_model',
    '"gemini-2.5-flash"',
    'Model used for generating admin summaries'
)
ON CONFLICT (config_key)
DO NOTHING;

DROP POLICY IF EXISTS "Allow read access to config"
ON public.news_system_config;

DROP POLICY IF EXISTS "Allow update access to config"
ON public.news_system_config;

DROP POLICY IF EXISTS "Allow insert access to config"
ON public.news_system_config;

DROP POLICY IF EXISTS "Allow delete access to config"
ON public.news_system_config;

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

-- =========================================================
-- 10. REMOVE OLD TABLES/FUNCTIONS
-- =========================================================

DROP TABLE IF EXISTS public.article_processing_logs CASCADE;

DROP FUNCTION IF EXISTS public.log_skipped_article(TEXT, TEXT, TEXT);

-- =========================================================
-- 11. NEWS KEY RPCS
-- =========================================================

CREATE OR REPLACE FUNCTION public.increment_news_key_calls(
    key_id UUID
)
RETURNS void AS $$
BEGIN

    UPDATE public.news_api_keys
    SET calls_count = calls_count + 1
    WHERE id = key_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_news_key_failures(
    key_id UUID,
    max_failures INTEGER
)
RETURNS void AS $$
BEGIN

    UPDATE public.news_api_keys
    SET failure_count = failure_count + 1,
        status =
            CASE
                WHEN failure_count + 1 >= max_failures
                THEN 'exhausted'
                ELSE status
            END
    WHERE id = key_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 12. ADVANCED KEY SUCCESS RPC
-- =========================================================

CREATE OR REPLACE FUNCTION public.mark_news_key_used(
    key_id UUID,
    cat TEXT
)
RETURNS void AS $$
BEGIN

    UPDATE public.news_api_keys
    SET
        calls_count = calls_count + 1,
        last_used_at = now(),
        last_used_category = cat,
        failure_count = 0,
        status = 'active',
        cooldown_until = NULL
    WHERE id = key_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 13. ADVANCED KEY FAILURE RPC
-- =========================================================

CREATE OR REPLACE FUNCTION public.mark_news_key_failed(
    key_id UUID,
    err_msg TEXT,
    max_failures INTEGER
)
RETURNS void AS $$
DECLARE
    current_failures INTEGER;
    v_provider TEXT;
    next_reset TIMESTAMPTZ;
    current_utc TIMESTAMP;
BEGIN

    UPDATE public.news_api_keys
    SET
        failure_count = failure_count + 1,
        last_failed_at = now(),
        last_error_message = err_msg
    WHERE id = key_id
    RETURNING failure_count, provider
    INTO current_failures, v_provider;

    IF current_failures >= max_failures THEN

        current_utc := now() AT TIME ZONE 'UTC';

        IF v_provider IN ('gnews', 'brevo') THEN

            next_reset :=
                (date_trunc('day', current_utc) + interval '1 day')
                AT TIME ZONE 'UTC';

        ELSIF v_provider = 'gemini' THEN

            IF extract(hour FROM current_utc) >= 20 THEN

                next_reset :=
                    (
                        date_trunc('day', current_utc)
                        + interval '1 day 20 hours'
                    ) AT TIME ZONE 'UTC';

            ELSE

                next_reset :=
                    (
                        date_trunc('day', current_utc)
                        + interval '20 hours'
                    ) AT TIME ZONE 'UTC';

            END IF;

        ELSE

            next_reset := now() + interval '24 hours';

        END IF;

        UPDATE public.news_api_keys
        SET
            status = 'exhausted',
            cooldown_until = next_reset
        WHERE id = key_id;

    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 14. API AUDIT RPC
-- =========================================================

CREATE OR REPLACE FUNCTION public.log_api_key_audit(
    failed_id UUID,
    fallback_id UUID,
    cat TEXT,
    err TEXT
)
RETURNS void AS $$
BEGIN

    INSERT INTO public.api_key_audit_logs (
        failed_key_id,
        fallback_key_id,
        category,
        error_reason
    )
    VALUES (
        failed_id,
        fallback_id,
        cat,
        err
    );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 15. REALTIME
-- =========================================================

ALTER PUBLICATION supabase_realtime
ADD TABLE public.activity_logs;

ALTER PUBLICATION supabase_realtime
ADD TABLE public.news_system_config;

-- =========================================================
-- DONE
-- =========================================================

-- FULL IDEMPOTENT FINANCE SYSTEM SETUP
-- =========================================================
-- FULL IDEMPOTENT FINANCE SYSTEM SETUP
-- =========================================================

-- Required Extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1. FINANCE PROFILES TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.finance_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    name TEXT NOT NULL,
    type TEXT CHECK (
        type IN ('personal', 'business', 'savings', 'project')
    ),
    currency TEXT DEFAULT 'INR'
);

COMMENT ON TABLE public.finance_profiles
IS 'Stores separate finance profiles or wallets for a user.';

ALTER TABLE public.finance_profiles
ENABLE ROW LEVEL SECURITY;

-- Drop existing policy safely
DROP POLICY IF EXISTS "Users can manage their own finance profiles."
ON public.finance_profiles;

CREATE POLICY "Users can manage their own finance profiles."
ON public.finance_profiles
FOR ALL
USING (auth.uid() = user_id);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_finance_profiles_user
ON public.finance_profiles(user_id);

-- =========================================================
-- 2. FINANCE TRANSACTIONS TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.finance_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),

    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,

    type TEXT NOT NULL CHECK (
        type IN ('expense', 'income', 'transfer')
    ),

    category TEXT,

    description TEXT,

    payment_method TEXT DEFAULT 'cash'
);

COMMENT ON TABLE public.finance_transactions
IS 'Stores financial transactions for the user.';

-- Enable RLS
ALTER TABLE public.finance_transactions
ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SAFE COLUMN MIGRATIONS
-- =========================================================

DO $$
BEGIN

    -- profile_id
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'finance_transactions'
          AND column_name = 'profile_id'
    ) THEN

        ALTER TABLE public.finance_transactions
        ADD COLUMN profile_id UUID
        REFERENCES public.finance_profiles(id)
        ON DELETE CASCADE;

    END IF;

    -- location
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'finance_transactions'
          AND column_name = 'location'
    ) THEN

        ALTER TABLE public.finance_transactions
        ADD COLUMN location JSONB;

    END IF;

    -- metadata
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'finance_transactions'
          AND column_name = 'metadata'
    ) THEN

        ALTER TABLE public.finance_transactions
        ADD COLUMN metadata JSONB;

    END IF;

END $$;

-- =========================================================
-- TRANSACTIONS POLICY
-- =========================================================

DROP POLICY IF EXISTS "Users can manage their own transactions."
ON public.finance_transactions;

DROP POLICY IF EXISTS "Users can manage their own transactions"
ON public.finance_transactions;

CREATE POLICY "Users can manage their own transactions."
ON public.finance_transactions
FOR ALL
USING (auth.uid() = user_id);

-- =========================================================
-- TRANSACTIONS INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_finance_user_date
ON public.finance_transactions(user_id, transaction_date);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_profile
ON public.finance_transactions(profile_id);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_type
ON public.finance_transactions(type);

-- =========================================================
-- 3. VEHICLES TABLE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.vehicles (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    name TEXT NOT NULL,

    type TEXT NOT NULL DEFAULT 'car'
    CHECK (type IN ('car', 'bike')),

    number_plate TEXT,

    current_odometer NUMERIC(12, 2) DEFAULT 0
);

COMMENT ON TABLE public.vehicles
IS 'Stores user vehicles for fuel tracking.';

ALTER TABLE public.vehicles
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own vehicles."
ON public.vehicles;

CREATE POLICY "Users can manage their own vehicles."
ON public.vehicles
FOR ALL
USING (auth.uid() = user_id);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_user
ON public.vehicles(user_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_number_plate
ON public.vehicles(number_plate);

-- =========================================================
-- DONE
-- =========================================================

-- Idempotent Database Analytics Function Setup
-- =========================================================
-- Idempotent Database Analytics Function Setup
-- =========================================================

-- 1. Drop old function safely (required because return type changed)
DROP FUNCTION IF EXISTS public.get_database_analytics();

-- 2. Create updated function
CREATE OR REPLACE FUNCTION public.get_database_analytics()
RETURNS TABLE (
    table_name text,
    live_rows bigint,
    total_inserts bigint,
    total_updates bigint,
    total_deletes bigint,
    last_used timestamptz
)
AS $$
DECLARE
    r RECORD;
    max_time timestamptz;
    col_name text;
BEGIN
    FOR r IN
        SELECT
            relname::text AS tname,
            n_live_tup,
            n_tup_ins,
            n_tup_upd,
            n_tup_del
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY n_tup_ins DESC
    LOOP
        -- Base stats
        table_name := r.tname;
        live_rows := r.n_live_tup;
        total_inserts := r.n_tup_ins;
        total_updates := r.n_tup_upd;
        total_deletes := r.n_tup_del;
        last_used := NULL;

        -- Find best timestamp column
        SELECT c.column_name
        INTO col_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = r.tname
          AND c.column_name IN (
              'updated_at',
              'last_sign_in_at',
              'created_at',
              'created',
              'timestamp'
          )
        ORDER BY CASE c.column_name
            WHEN 'updated_at' THEN 1
            WHEN 'last_sign_in_at' THEN 2
            WHEN 'created_at' THEN 3
            WHEN 'created' THEN 4
            WHEN 'timestamp' THEN 5
            ELSE 6
        END
        LIMIT 1;

        -- Try fetching latest timestamp
        IF col_name IS NOT NULL THEN
            BEGIN
                EXECUTE format(
                    'SELECT MAX(%I) FROM public.%I',
                    col_name,
                    r.tname
                )
                INTO max_time;

                last_used := max_time;

            EXCEPTION WHEN OTHERS THEN
                last_used := NULL;
            END;
        END IF;

        RETURN NEXT;
    END LOOP;
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;

-- 3. Secure permissions
REVOKE EXECUTE ON FUNCTION public.get_database_analytics() FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.get_database_analytics()
TO service_role;

GRANT EXECUTE
ON FUNCTION public.get_database_analytics()
TO authenticated;

-- NEWS SYSTEM MASTER SCRIPT (Articles, Logs, Stats, RPC)
-- =========================================================
-- NEWS SYSTEM MASTER SCRIPT (Articles, Logs, Stats, RPC)
-- =========================================================

-- 1. DROP obsolete tables explicitly as requested
DROP TABLE IF EXISTS public.processed_articles;

-- 2. Create the central public news articles table
CREATE TABLE IF NOT EXISTS public.public_news_articles (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    category TEXT NOT NULL,
    article_data JSONB NOT NULL,
    formatted_content_md JSONB,
    views INT DEFAULT 0,
    likes INT DEFAULT 0,
    bookmarks INT DEFAULT 0
);

-- Ensure new columns are added if table already existed (idempotency)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='public_news_articles' AND column_name='formatted_content_md') THEN
        ALTER TABLE public.public_news_articles ADD COLUMN formatted_content_md JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='public_news_articles' AND column_name='views') THEN
        ALTER TABLE public.public_news_articles ADD COLUMN views INT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='public_news_articles' AND column_name='likes') THEN
        ALTER TABLE public.public_news_articles ADD COLUMN likes INT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='public_news_articles' AND column_name='bookmarks') THEN
        ALTER TABLE public.public_news_articles ADD COLUMN bookmarks INT DEFAULT 0;
    END IF;
END $$;

COMMENT ON TABLE public.public_news_articles IS 'Stores news articles fetched and pre-formatted by a cron job, visible to all users.';
COMMENT ON COLUMN public.public_news_articles.category IS 'The category of the news (e.g., technology, business).';
COMMENT ON COLUMN public.public_news_articles.article_data IS 'The JSON object for a single news article.';
COMMENT ON COLUMN public.public_news_articles.formatted_content_md IS 'Stores the Gemini-formatted summary of the article as a JSON object: {"markdown": "..."}';

ALTER TABLE public.public_news_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public news articles are viewable by everyone." ON public.public_news_articles;
CREATE POLICY "Public news articles are viewable by everyone." ON public.public_news_articles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow full access for service_role" ON public.public_news_articles;
CREATE POLICY "Allow full access for service_role" ON public.public_news_articles FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_news_category ON public.public_news_articles(category);

-- Cleanup obsolete user setting column if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_settings' AND column_name='news_cache') THEN
        ALTER TABLE public.user_settings DROP COLUMN news_cache;
    END IF;
END $$;

-- 3. Update News Function Run Logs
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

DROP POLICY IF EXISTS "Allow read access to everyone for news logs" ON public.update_news_logs;
CREATE POLICY "Allow read access to everyone for news logs" ON public.update_news_logs FOR SELECT USING (true);

-- 4. User Article Interactions Table
CREATE TABLE IF NOT EXISTS public.user_article_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    article_url TEXT NOT NULL,
    liked BOOLEAN DEFAULT false,
    bookmarked BOOLEAN DEFAULT false
);

COMMENT ON TABLE public.user_article_interactions IS 'Stores user-specific interactions like liking or bookmarking news articles.';

CREATE UNIQUE INDEX IF NOT EXISTS user_article_interactions_user_article_idx ON public.user_article_interactions(user_id, article_url);

ALTER TABLE public.user_article_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own article interactions." ON public.user_article_interactions;
CREATE POLICY "Users can manage their own article interactions." ON public.user_article_interactions FOR ALL USING (auth.uid() = user_id);

-- 5. RPC Function: Atomic Stat Increment
CREATE OR REPLACE FUNCTION increment_article_stat(p_article_url TEXT, p_stat_type TEXT, p_amount INT)
RETURNS void AS $$
BEGIN
    -- Use dynamic SQL to update the correct column securely
    EXECUTE format('UPDATE public.public_news_articles SET %I = %I + %s WHERE article_data->>''url'' = %L',
                     p_stat_type, p_stat_type, p_amount, p_article_url);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC Function: Function Execution Statistics
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
    FROM public.update_news_logs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_function_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_function_stats() TO service_role;

-- PROFILES TABLE SETUP
-- =========================================================
-- PROFILES TABLE SETUP
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ,
  full_name TEXT,
  avatar_url TEXT
);

-- Safely add missing columns if table already existed previously
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- =========================================================
-- USER SETTINGS TABLE SETUP (ALL COLUMNS INCLUDED)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  api_key TEXT,
  voice_mode_voice TEXT,
  voice_mode_persona_instruction TEXT,
  voice_mode_tone_instruction TEXT,
  voice_mode_custom_instruction TEXT,
  voice_proactive_mode BOOLEAN,
  translator_usage JSONB,
  ui_theme TEXT DEFAULT 'system',
  ui_font TEXT DEFAULT 'Geist Sans',
  ui_density TEXT DEFAULT 'comfortable'
);

-- Safely add missing columns in case an older version of the table exists
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS api_key TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS voice_mode_voice TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS voice_mode_persona_instruction TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS voice_mode_tone_instruction TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS voice_mode_custom_instruction TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS voice_proactive_mode BOOLEAN;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS translator_usage JSONB;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS ui_theme TEXT DEFAULT 'system';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS ui_font TEXT DEFAULT 'Geist Sans';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS ui_density TEXT DEFAULT 'comfortable';

COMMENT ON COLUMN public.user_settings.ui_theme IS 'User preference for app theme (light, dark, system)';
COMMENT ON COLUMN public.user_settings.ui_font IS 'User selected font family';
COMMENT ON COLUMN public.user_settings.ui_density IS 'Layout density: comfortable (default) or compact';

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own settings." ON public.user_settings;
CREATE POLICY "Users can manage their own settings." ON public.user_settings FOR ALL USING (auth.uid() = user_id);

-- =========================================================
-- AUTH TRIGGER FUNCTIONS (AUTO CREATE PROFILE/SETTINGS)
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  
  -- Insert into user_settings table
  INSERT INTO public.user_settings (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =========================================================
-- STORAGE BUCKETS & POLICIES SETUP
-- =========================================================

-- 1. AVATARS STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible." ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Users can upload their own avatar." ON storage.objects;
CREATE POLICY "Users can upload their own avatar." ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid );

DROP POLICY IF EXISTS "Users can update their own avatar." ON storage.objects;
CREATE POLICY "Users can update their own avatar." ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid );

DROP POLICY IF EXISTS "Users can delete their own avatar." ON storage.objects;
CREATE POLICY "Users can delete their own avatar." ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid );

-- 2. USER UPLOADS STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('user_uploads', 'user_uploads', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Uploaded files are publicly accessible." ON storage.objects;
CREATE POLICY "Uploaded files are publicly accessible." ON storage.objects FOR SELECT USING ( bucket_id = 'user_uploads' );

DROP POLICY IF EXISTS "Users can upload their own files." ON storage.objects;
CREATE POLICY "Users can upload their own files." ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'user_uploads' AND auth.uid() = (storage.foldername(name))[1]::uuid );

DROP POLICY IF EXISTS "Users can delete their own files." ON storage.objects;
CREATE POLICY "Users can delete their own files." ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'user_uploads' AND auth.uid() = (storage.foldername(name))[1]::uuid );

-- COMPLETE MERGED CONVERSATIONS & ARTICLES SCHEMA
-- =========================================================
-- COMPLETE MERGED CONVERSATIONS & ARTICLES SCHEMA
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- 1. CONVERSATIONS TABLE (Voice & Chat Master Table)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Safely add all required missing columns (Idempotent)
ALTER TABLE public.conversations 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS summaries JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS planner_context JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS is_voice_conversation BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS audio_url TEXT,
    ADD COLUMN IF NOT EXISTS summarization_failed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_generating_title BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Ensure owner column is not strictly forcing NOT NULL to avoid insert errors
ALTER TABLE public.conversations ALTER COLUMN owner DROP NOT NULL;

-- Enable RLS and create precise, safe policies
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.conversations;

CREATE POLICY "Users can view their own conversations" ON public.conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own conversations" ON public.conversations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own conversations" ON public.conversations FOR DELETE USING (auth.uid() = user_id);


-- =========================================================
-- 2. VOICE CONVERSATIONS STORAGE BUCKET
-- =========================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('voice_conversations', 'voice_conversations', true) 
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload their own voice conversations" ON storage.objects;
CREATE POLICY "Users can upload their own voice conversations" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'voice_conversations' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Users can view their own voice conversations" ON storage.objects;
CREATE POLICY "Users can view their own voice conversations" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'voice_conversations' AND auth.uid() = owner);


-- =========================================================
-- 3. ARTICLE CONVERSATIONS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.article_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    article_url TEXT NOT NULL,
    article_title TEXT,
    messages JSONB DEFAULT '[]'::jsonb
);

COMMENT ON TABLE public.article_conversations IS 'Stores follow-up conversations for news articles.';

CREATE UNIQUE INDEX IF NOT EXISTS article_conversations_user_article_idx ON public.article_conversations(user_id, article_url);

ALTER TABLE public.article_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own article conversations." ON public.article_conversations;
CREATE POLICY "Users can manage their own article conversations." ON public.article_conversations FOR ALL USING (auth.uid() = user_id);

-- Cleanup old deprecated column safely
ALTER TABLE public.article_conversations DROP COLUMN IF EXISTS article_content;


-- =========================================================
-- 4. PUBLIC ARTICLE CACHE TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.public_article_cache (
    article_url TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.public_article_cache IS 'Stores globally cached article content fetched from URLs to reduce redundant API calls.';

ALTER TABLE public.public_article_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public article cache is viewable by everyone." ON public.public_article_cache;
CREATE POLICY "Public article cache is viewable by everyone." ON public.public_article_cache FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert new article content." ON public.public_article_cache;
CREATE POLICY "Authenticated users can insert new article content." ON public.public_article_cache FOR INSERT TO authenticated WITH CHECK (true);