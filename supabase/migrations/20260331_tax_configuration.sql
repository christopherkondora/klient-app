-- ============================================================
-- KLIENT – Tax Configuration Schema
-- Hungarian tax system support: KIVA, AFA, AAM, Atalanyadozas, Kft (TAO), KATA
-- ============================================================

-- 1. Business type lookup table
CREATE TABLE IF NOT EXISTS public.tax_business_types (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name_hu     TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Year-specific tax rules and rates
CREATE TABLE IF NOT EXISTS public.tax_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type   TEXT NOT NULL REFERENCES public.tax_business_types(id),
  year            INTEGER NOT NULL,
  rate_percent    NUMERIC(6,3) NOT NULL,
  rate_label      TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (business_type, year, rate_label)
);

-- 3. Eligibility criteria per business type per year
CREATE TABLE IF NOT EXISTS public.tax_eligibility_criteria (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type     TEXT NOT NULL REFERENCES public.tax_business_types(id),
  year              INTEGER NOT NULL,
  max_revenue_huf   BIGINT,
  max_employees     INTEGER,
  conditions_json   JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (business_type, year)
);

-- 4. Tax calculation audit log
CREATE TABLE IF NOT EXISTS public.tax_calculations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_type     TEXT NOT NULL REFERENCES public.tax_business_types(id),
  year              INTEGER NOT NULL,
  revenue           NUMERIC(15,2) NOT NULL,
  expenses          NUMERIC(15,2) DEFAULT 0,
  tax_amount        NUMERIC(15,2) NOT NULL,
  calculation_json  JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 5. User's chosen tax settings
CREATE TABLE IF NOT EXISTS public.user_tax_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_type   TEXT NOT NULL REFERENCES public.tax_business_types(id),
  year            INTEGER NOT NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, year)
);

-- ============================================================
-- Row Level Security
-- ============================================================

-- tax_business_types and tax_rules/eligibility are read-only reference data
ALTER TABLE public.tax_business_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_eligibility_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tax_settings ENABLE ROW LEVEL SECURITY;

-- Reference tables: all authenticated users can read
CREATE POLICY "Authenticated users can read business types"
  ON public.tax_business_types FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read tax rules"
  ON public.tax_rules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read eligibility criteria"
  ON public.tax_eligibility_criteria FOR SELECT
  USING (auth.role() = 'authenticated');

-- User-scoped tables: users can only access their own data
CREATE POLICY "Users can read own tax calculations"
  ON public.tax_calculations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tax calculations"
  ON public.tax_calculations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own tax settings"
  ON public.user_tax_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tax settings"
  ON public.user_tax_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tax settings"
  ON public.user_tax_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tax settings"
  ON public.user_tax_settings FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_tax_rules_type_year ON public.tax_rules(business_type, year);
CREATE INDEX idx_tax_eligibility_type_year ON public.tax_eligibility_criteria(business_type, year);
CREATE INDEX idx_tax_calculations_user ON public.tax_calculations(user_id, year);
CREATE INDEX idx_user_tax_settings_user ON public.user_tax_settings(user_id, year);

-- ============================================================
-- Seed data: 2026 Hungarian tax rules
-- ============================================================

-- Business types
INSERT INTO public.tax_business_types (id, code, name_hu, description, sort_order) VALUES
  ('kiva',           'KIVA',           'Kisvallalati Ado',              'Kisvallalati ado - kis- es kozepvallalkozasoknak',       1),
  ('afa',            'AFA',            'Altalanos Forgalmi Ado',        'AFA - 27%-os altalanos forgalmi ado',                   2),
  ('aam',            'AAM',            'Alanyi Adomentesseg',           'Alanyi adomentesseg - AFA-mentes mukodes',              3),
  ('atalanyadozas',  'ATALANYADOZAS',  'Atalanyadozas',                 'Egyszerusitett SZJA egyeni vallalkozoknak',              4),
  ('kft_tao',        'KFT_TAO',        'Kft (TAO)',                     'Korlátolt felelosségu tarsasag - tarsasagi ado',        5),
  ('kata',           'KATA',           'Kisadozo Vallalkozasok Teteles Adoja', 'Teteles ado egyeni vallalkozoknak (korlatozott)', 6)
ON CONFLICT (id) DO NOTHING;

-- 2026 Tax rates
INSERT INTO public.tax_rules (business_type, year, rate_percent, rate_label, notes) VALUES
  ('kiva',          2026, 11.000, 'base',     'Specialis adoalap: beralapú szamitas'),
  ('afa',           2026, 27.000, 'standard', 'EU egyik legmagasabb AFA kulcsa'),
  ('afa',           2026, 18.000, 'reduced',  'Csökkentett kulcs (pl. egyes elelmiszerek)'),
  ('afa',           2026,  5.000, 'super_reduced', 'Szuper csökkentett kulcs (pl. könyvek)'),
  ('aam',           2026,  0.000, 'exempt',   'AFA-mentes - 20M Ft bevételi határ'),
  ('atalanyadozas', 2026, 40.000, 'deemed_cost_general', 'Altalanos velelmezett költséghanyadék'),
  ('atalanyadozas', 2026, 80.000, 'deemed_cost_retail',  'Kiskereskedelmi velelmezett költséghanyadék'),
  ('kft_tao',       2026,  9.000, 'base',     'Tarsasagi ado alapkulcs'),
  ('kata',          2026, 50000,  'monthly_flat', 'Havi teteles ado (Ft, nem százalék)')
ON CONFLICT (business_type, year, rate_label) DO NOTHING;

-- 2026 Eligibility criteria
INSERT INTO public.tax_eligibility_criteria (business_type, year, max_revenue_huf, max_employees, conditions_json) VALUES
  ('kiva',          2026, 12000000000, 200, '{"replaces": ["tao", "szocho", "szakkepzesi_hozzajarulas"]}'),
  ('aam',           2026, 20000000,    NULL, '{"progressive_increase": {"2027": 22000000, "2028": 24000000}}'),
  ('atalanyadozas', 2026, NULL,        NULL, '{"entity_type": "egyeni_vallalkozo", "simplified_szja": true}'),
  ('kata',          2026, NULL,        NULL, '{"entity_type": "egyeni_vallalkozo", "restricted_since": 2022, "no_corporate_clients": true}'),
  ('kft_tao',       2026, NULL,        NULL, '{"entity_type": "kft", "alternative": "kiva"}')
ON CONFLICT (business_type, year) DO NOTHING;
