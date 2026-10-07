-- Migration: 20261004000000_telegram_integration.sql
-- Description: Telegram Bot notification and webhook schema, recipients table, and triggers

-- 1. Enable pg_net extension for asynchronous HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Update leads.status constraint to include 'notified_sold'
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS chk_lead_status;
ALTER TABLE public.leads ADD CONSTRAINT chk_lead_status 
  CHECK (status IN ('new', 'contacted', 'closed', 'notified_sold'));

-- 3. Create telegram_recipients table
CREATE TABLE IF NOT EXISTS public.telegram_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT UNIQUE NOT NULL,
  name TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_recipients_active 
  ON public.telegram_recipients (active);

ALTER TABLE public.telegram_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admin full access on telegram_recipients" ON public.telegram_recipients;
CREATE POLICY "Allow admin full access on telegram_recipients"
  ON public.telegram_recipients
  FOR ALL
  TO authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- 4. Create telegram_lead_notifications table (records sent message IDs per recipient for multi-chat editing)
CREATE TABLE IF NOT EXISTS public.telegram_lead_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  message_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (lead_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_lead_notifications_lead_id 
  ON public.telegram_lead_notifications (lead_id);

ALTER TABLE public.telegram_lead_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service full access on telegram_lead_notifications" ON public.telegram_lead_notifications;
CREATE POLICY "Allow service full access on telegram_lead_notifications"
  ON public.telegram_lead_notifications
  FOR ALL
  TO authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- 5. Trigger Function and Trigger using pg_net to invoke notify-new-lead Edge Function
CREATE OR REPLACE FUNCTION public.trg_fn_notify_new_lead()
RETURNS TRIGGER AS $$
DECLARE
  edge_url TEXT := 'https://aevssooayvieyhdnshse.supabase.co/functions/v1/notify-new-lead';
  payload JSONB;
BEGIN
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'leads',
    'schema', 'public',
    'record', row_to_json(NEW)
  );

  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_new_lead ON public.leads;
CREATE TRIGGER trg_notify_new_lead
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_notify_new_lead();
