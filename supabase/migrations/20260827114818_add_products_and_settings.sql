/*
# Add Products and Settings Tables

## Overview
This migration adds two new tables to support a per-user product catalog and
per-user business settings (business name, currency).

## New Tables

### 1. products
- `id` (uuid, primary key)
- `user_id` (uuid, owner — defaults to authenticated user, references auth.users)
- `name` (text, not null)
- `description` (text, nullable)
- `price` (numeric, not null, default 0)
- `unit` (text, default 'pcs' — e.g. pcs, kg, liter, box)
- `created_at` (timestamptz)

### 2. settings
- `id` (uuid, primary key)
- `user_id` (uuid, owner — one-to-one with auth.users, unique)
- `business_name` (text, default 'Universal Billing')
- `currency` (text, default 'USD' — ISO 4217 currency code)
- `tax_rate` (numeric, default 0 — default tax % to prefill on new bills)
- `updated_at` (timestamptz)

## Security (RLS)
- Both tables have RLS enabled with owner-scoped policies via `auth.uid()`.
- Four separate policies per table (SELECT, INSERT, UPDATE, DELETE).
- `settings` has a unique constraint on `user_id` to ensure one row per user.

## Indexes
- products.user_id
- settings.user_id (unique)
*/

-- ============================================================
-- PRODUCTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'pcs',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_products" ON products;
CREATE POLICY "select_own_products" ON products FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_products" ON products;
CREATE POLICY "insert_own_products" ON products FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_products" ON products;
CREATE POLICY "update_own_products" ON products FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_products" ON products;
CREATE POLICY "delete_own_products" ON products FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);

-- ============================================================
-- SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL DEFAULT 'Universal Billing',
  currency text NOT NULL DEFAULT 'USD',
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_settings" ON settings;
CREATE POLICY "select_own_settings" ON settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_settings" ON settings;
CREATE POLICY "insert_own_settings" ON settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_settings" ON settings;
CREATE POLICY "update_own_settings" ON settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_settings" ON settings;
CREATE POLICY "delete_own_settings" ON settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);