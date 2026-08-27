/*
# Create Billing System Schema

## Overview
This migration creates the complete schema for a Universal Billing System with
multi-user (authenticated) data isolation. Each user owns their customers, bills,
bill items, and chat messages.

## New Tables

### 1. customers
- `id` (uuid, primary key)
- `user_id` (uuid, owner — defaults to authenticated user, references auth.users)
- `name` (text, not null)
- `phone` (text, nullable)
- `email` (text, nullable)
- `address` (text, nullable)
- `total_spent` (numeric, default 0 — maintained via trigger from bill changes)
- `created_at` (timestamptz)

### 2. bills
- `id` (uuid, primary key)
- `user_id` (uuid, owner — defaults to authenticated user)
- `customer_id` (uuid, references customers, nullable for walk-in)
- `bill_number` (text, auto-generated like BILL-0001)
- `subtotal` (numeric, default 0)
- `tax_rate` (numeric, default 0 — percentage)
- `tax_amount` (numeric, default 0)
- `discount` (numeric, default 0)
- `total` (numeric, default 0)
- `notes` (text, nullable)
- `status` (text, default 'paid' — paid/pending/cancelled)
- `bill_date` (date, default today)
- `created_at` (timestamptz)

### 3. bill_items
- `id` (uuid, primary key)
- `bill_id` (uuid, references bills ON DELETE CASCADE)
- `product_name` (text, not null)
- `quantity` (integer, not null, default 1)
- `price` (numeric, not null, default 0)
- `total` (numeric, computed = quantity * price)

### 4. chat_messages
- `id` (uuid, primary key)
- `user_id` (uuid, owner — defaults to authenticated user)
- `role` (text — 'user' or 'assistant')
- `content` (text, message text)
- `context_type` (text, nullable — 'customer-view', 'bill-view', 'dashboard', etc.)
- `customer_id` (uuid, nullable — context reference)
- `bill_id` (uuid, nullable — context reference)
- `sources` (jsonb, nullable — cited sources from RAG)
- `created_at` (timestamptz)

## Security (RLS)
- All tables have RLS enabled.
- All tables are owner-scoped via `user_id` with `auth.uid()` checks.
- `bill_items` is scoped through its parent bill via EXISTS subquery.
- Four separate policies per table (SELECT, INSERT, UPDATE, DELETE).

## Indexes
- bills.user_id, bills.customer_id, bills.bill_date
- customers.user_id, customers.phone
- bill_items.bill_id
- chat_messages.user_id

## Triggers
- `update_customer_total_spent()`: automatically maintains customers.total_spent
  when bills are inserted, updated, or deleted.
- `update_bill_items_total()`: automatically computes bill_items.total from
  quantity * price on insert/update.
*/

-- ============================================================
-- CUSTOMERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  total_spent numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_customers" ON customers;
CREATE POLICY "select_own_customers" ON customers FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_customers" ON customers;
CREATE POLICY "insert_own_customers" ON customers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_customers" ON customers;
CREATE POLICY "update_own_customers" ON customers FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_customers" ON customers;
CREATE POLICY "delete_own_customers" ON customers FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- ============================================================
-- BILLS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  bill_number text NOT NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','pending','cancelled')),
  bill_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_bills" ON bills;
CREATE POLICY "select_own_bills" ON bills FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_bills" ON bills;
CREATE POLICY "insert_own_bills" ON bills FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_bills" ON bills;
CREATE POLICY "update_own_bills" ON bills FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_bills" ON bills;
CREATE POLICY "delete_own_bills" ON bills FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_user_bill_number ON bills(user_id, bill_number);
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_bill_date ON bills(bill_date);

-- ============================================================
-- BILL_ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  total numeric(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_bill_items" ON bill_items;
CREATE POLICY "select_own_bill_items" ON bill_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM bills WHERE bills.id = bill_items.bill_id AND bills.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_bill_items" ON bill_items;
CREATE POLICY "insert_own_bill_items" ON bill_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM bills WHERE bills.id = bill_items.bill_id AND bills.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_bill_items" ON bill_items;
CREATE POLICY "update_own_bill_items" ON bill_items FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM bills WHERE bills.id = bill_items.bill_id AND bills.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM bills WHERE bills.id = bill_items.bill_id AND bills.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_bill_items" ON bill_items;
CREATE POLICY "delete_own_bill_items" ON bill_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM bills WHERE bills.id = bill_items.bill_id AND bills.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);

-- ============================================================
-- CHAT_MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  context_type text,
  customer_id uuid,
  bill_id uuid,
  sources jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chat_messages" ON chat_messages;
CREATE POLICY "select_own_chat_messages" ON chat_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_chat_messages" ON chat_messages;
CREATE POLICY "insert_own_chat_messages" ON chat_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_chat_messages" ON chat_messages;
CREATE POLICY "delete_own_chat_messages" ON chat_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);

-- ============================================================
-- TRIGGER: auto-compute bill_items.total = quantity * price
-- ============================================================
CREATE OR REPLACE FUNCTION update_bill_items_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total := NEW.quantity * NEW.price;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_bill_items_total ON bill_items;
CREATE TRIGGER trg_update_bill_items_total
  BEFORE INSERT OR UPDATE ON bill_items
  FOR EACH ROW EXECUTE FUNCTION update_bill_items_total();

-- ============================================================
-- TRIGGER: maintain customers.total_spent from bills
-- ============================================================
CREATE OR REPLACE FUNCTION update_customer_total_spent()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.customer_id IS NOT NULL THEN
      UPDATE customers
        SET total_spent = total_spent + NEW.total
        WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.customer_id IS NOT NULL THEN
      UPDATE customers
        SET total_spent = total_spent - OLD.total
        WHERE id = OLD.customer_id;
    END IF;
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF OLD.customer_id = NEW.customer_id AND OLD.total != NEW.total THEN
      IF NEW.customer_id IS NOT NULL THEN
        UPDATE customers
          SET total_spent = total_spent + (NEW.total - OLD.total)
          WHERE id = NEW.customer_id;
      END IF;
    ELSE
      IF OLD.customer_id IS NOT NULL THEN
        UPDATE customers SET total_spent = total_spent - OLD.total WHERE id = OLD.customer_id;
      END IF;
      IF NEW.customer_id IS NOT NULL THEN
        UPDATE customers SET total_spent = total_spent + NEW.total WHERE id = NEW.customer_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_customer_total_spent ON bills;
CREATE TRIGGER trg_update_customer_total_spent
  AFTER INSERT OR UPDATE OR DELETE ON bills
  FOR EACH ROW EXECUTE FUNCTION update_customer_total_spent();

-- ============================================================
-- FUNCTION: generate sequential bill_number per user
-- ============================================================
CREATE OR REPLACE FUNCTION generate_bill_number(p_user_id uuid)
RETURNS text AS $$
DECLARE
  v_count integer;
  v_bill_number text;
BEGIN
  SELECT count(*) INTO v_count FROM bills WHERE user_id = p_user_id;
  v_bill_number := 'BILL-' || lpad((v_count + 1)::text, 4, '0');
  RETURN v_bill_number;
END;
$$ LANGUAGE plpgsql;