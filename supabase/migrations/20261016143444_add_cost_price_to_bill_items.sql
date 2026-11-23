/*
# Add cost_price to bill_items for profit calculation

1. Modified Tables
- `bill_items`: Added `cost_price` column (numeric, default 0) to track the cost
  price of each product at the time the bill was created. This enables per-item
  and per-bill profit calculation: profit = (price - cost_price) * quantity.

2. Notes
- The existing `tax_rate` and `tax_amount` columns on `bills` are NOT removed
  (data safety). They remain in the schema but will no longer be used by the
  frontend — the app no longer calculates or displays tax/VAT.
- All new bill_items will store cost_price from the matching product's cost_price,
  or 0 for custom items. Existing rows default to 0.
*/

ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0;
