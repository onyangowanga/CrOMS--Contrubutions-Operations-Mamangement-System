export const schemaSql = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE app_role AS ENUM ('admin', 'treasurer', 'viewer');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'identity_type') THEN
    CREATE TYPE identity_type AS ENUM ('individual', 'titled_individual', 'family', 'group', 'organization', 'anonymous');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_status') THEN
    CREATE TYPE campaign_status AS ENUM ('active', 'closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_type') THEN
    CREATE TYPE source_type AS ENUM ('mpesa', 'bank', 'manual');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type') THEN
    CREATE TYPE payment_method_type AS ENUM ('paybill', 'till', 'phone', 'bank');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'confirmation_status') THEN
    CREATE TYPE confirmation_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  reset_token TEXT,
  reset_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  brand_name TEXT,
  brand_color TEXT,
  brand_logo_path TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(14, 2),
  whatsapp_header_text TEXT,
  whatsapp_additional_info TEXT,
  status campaign_status NOT NULL DEFAULT 'active',
  total_raised NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  formal_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  identity_type identity_type NOT NULL DEFAULT 'individual',
  alternate_senders JSONB NOT NULL DEFAULT '[]'::jsonb,
  canonical_id UUID NOT NULL,
  total_contributed NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES contributors(id) ON DELETE RESTRICT,
  amount NUMERIC(14, 2) NOT NULL,
  transaction_code TEXT UNIQUE NOT NULL,
  message_raw TEXT NOT NULL,
  source source_type NOT NULL,
  sender_name TEXT NOT NULL,
  event_time TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  method_type payment_method_type NOT NULL,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS confirmation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  suggested_contributor_id UUID REFERENCES contributors(id) ON DELETE SET NULL,
  parsed_amount NUMERIC(14, 2) NOT NULL,
  parsed_sender_name TEXT NOT NULL,
  parsed_transaction_code TEXT UNIQUE NOT NULL,
  parsed_timestamp TEXT NOT NULL,
  parsed_source source_type NOT NULL,
  raw_text TEXT NOT NULL,
  proposed_display_name TEXT,
  proposed_identity_type identity_type,
  match_score NUMERIC(5, 2),
  review_reason TEXT,
  status confirmation_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS brand_color TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS brand_logo_path TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS whatsapp_header_text TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS whatsapp_additional_info TEXT;
`;
