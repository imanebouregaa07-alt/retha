-- Migration: 20260928000000_retha_schema.sql
-- Description: RETHA Real Estate Backend Schema with RLS, Triggers, and Indexes

-- 1. Helper function for updated_at timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. TABLE: properties
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  reference_code TEXT UNIQUE,
  description TEXT,
  property_type TEXT,
  price NUMERIC,
  area_sqm NUMERIC,
  city TEXT,
  neighborhood TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_property_status CHECK (status IN ('available', 'reserved', 'sold')),
  CONSTRAINT chk_property_type CHECK (property_type IS NULL OR property_type IN ('villa', 'apartment', 'office', 'land'))
);

-- 3. TABLE: property_images
CREATE TABLE IF NOT EXISTS public.property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_type TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. TABLE: leads
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  budget_range TEXT,
  preferred_contact_method TEXT DEFAULT 'phone',
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_lead_status CHECK (status IN ('new', 'contacted', 'closed')),
  CONSTRAINT chk_contact_method CHECK (preferred_contact_method IS NULL OR preferred_contact_method IN ('whatsapp', 'phone', 'email'))
);

-- 5. TABLE: property_status_history
CREATE TABLE IF NOT EXISTS public.property_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_via TEXT DEFAULT 'system'
);

-- 6. INDEXES
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties (status);
CREATE INDEX IF NOT EXISTS idx_properties_city ON public.properties (city);
CREATE INDEX IF NOT EXISTS idx_properties_type ON public.properties (property_type);
CREATE INDEX IF NOT EXISTS idx_properties_price ON public.properties (price);
CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON public.property_images (property_id);
CREATE INDEX IF NOT EXISTS idx_property_images_display_order ON public.property_images (property_id, display_order);
CREATE INDEX IF NOT EXISTS idx_leads_property_id ON public.leads (property_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_status_history_property_id ON public.property_status_history (property_id);

-- 7. TRIGGERS
-- Trigger: update updated_at on properties
DROP TRIGGER IF EXISTS trg_properties_updated_at ON public.properties;
CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Function & Trigger: property status audit log
CREATE OR REPLACE FUNCTION public.log_property_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.property_status_history (
      property_id,
      old_status,
      new_status,
      changed_at,
      changed_via
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      now(),
      COALESCE(current_setting('request.jwt.claim.role', true), 'system')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_property_status_change ON public.properties;
CREATE TRIGGER trg_log_property_status_change
  AFTER UPDATE OF status ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.log_property_status_change();

-- 8. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_status_history ENABLE ROW LEVEL SECURITY;

-- Policies for: properties
-- Public visitors can read all properties
DROP POLICY IF EXISTS "Allow public read access on properties" ON public.properties;
CREATE POLICY "Allow public read access on properties"
  ON public.properties
  FOR SELECT
  TO public
  USING (true);

-- Authenticated admin users can perform INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "Allow admin full access on properties" ON public.properties;
CREATE POLICY "Allow admin full access on properties"
  ON public.properties
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for: property_images
-- Public visitors can view property images
DROP POLICY IF EXISTS "Allow public read access on property_images" ON public.property_images;
CREATE POLICY "Allow public read access on property_images"
  ON public.property_images
  FOR SELECT
  TO public
  USING (true);

-- Authenticated admin users can manage property images
DROP POLICY IF EXISTS "Allow admin full access on property_images" ON public.property_images;
CREATE POLICY "Allow admin full access on property_images"
  ON public.property_images
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for: leads
-- Public visitors can submit inquiry leads
DROP POLICY IF EXISTS "Allow public insert on leads" ON public.leads;
CREATE POLICY "Allow public insert on leads"
  ON public.leads
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Authenticated admins can view and manage leads
DROP POLICY IF EXISTS "Allow admin full access on leads" ON public.leads;
CREATE POLICY "Allow admin full access on leads"
  ON public.leads
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for: property_status_history
-- Only authenticated admins can read/manage status history
DROP POLICY IF EXISTS "Allow admin full access on property_status_history" ON public.property_status_history;
CREATE POLICY "Allow admin full access on property_status_history"
  ON public.property_status_history
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
