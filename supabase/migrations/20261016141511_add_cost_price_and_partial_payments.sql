-- Add cost_price to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0;

-- Add partial payment fields to bills
ALTER TABLE bills ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS due_amount numeric DEFAULT 0;

-- Update due_amount for existing bills: if paid, due = 0; if pending/cancelled, due = total
UPDATE bills SET paid_amount = total, due_amount = 0 WHERE status = 'paid' AND paid_amount = 0;
UPDATE bills SET paid_amount = 0, due_amount = total WHERE status IN ('pending', 'cancelled') AND due_amount = 0;