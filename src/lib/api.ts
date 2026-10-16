import { supabase } from '@/lib/supabase';
import type { Customer, Bill, BillItem, ChatMessage, Product, Settings } from '@/lib/types';

// ============================================================
// CUSTOMERS API
// ============================================================

export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
    .order('name', { ascending: true })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function createCustomer(
  customer: Omit<Customer, 'id' | 'user_id' | 'total_spent' | 'created_at'>
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert(customer)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCustomer(
  id: string,
  updates: Partial<Pick<Customer, 'name' | 'phone' | 'email' | 'address'>>
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// BILLS API
// ============================================================

export async function fetchBills(page = 1, pageSize = 10): Promise<{ bills: Bill[]; count: number }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('bills')
    .select('*, customer:customers(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { bills: data ?? [], count: count ?? 0 };
}

export async function searchBills(query: string): Promise<Bill[]> {
  const { data, error } = await supabase
    .from('bills')
    .select('*, customer:customers(*)')
    .or(`bill_number.ilike.%${query}%,customer.name.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function fetchBillById(id: string): Promise<Bill | null> {
  const { data, error } = await supabase
    .from('bills')
    .select('*, customer:customers(*), bill_items(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createBill(
  bill: {
    customer_id: string | null;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    discount: number;
    total: number;
    paid_amount: number;
    due_amount: number;
    notes: string | null;
    status: string;
    bill_date: string;
  },
  items: Array<{ product_name: string; quantity: number; price: number }>
): Promise<Bill> {
  const { count: existingCount } = await supabase
    .from('bills')
    .select('id', { count: 'exact', head: true });

  const billNumber = `BILL-${String((existingCount ?? 0) + 1).padStart(4, '0')}`;

  const { data: newBill, error: insertError } = await supabase
    .from('bills')
    .insert({ ...bill, bill_number: billNumber })
    .select()
    .single();
  if (insertError) throw insertError;

  if (items.length > 0) {
    const itemsWithBillId = items.map((item) => ({ ...item, bill_id: newBill.id }));
    const { error: itemsError } = await supabase.from('bill_items').insert(itemsWithBillId);
    if (itemsError) throw itemsError;
  }

  return newBill;
}

export async function fetchDueBills(): Promise<Bill[]> {
  const { data, error } = await supabase
    .from('bills')
    .select('*, customer:customers(*)')
    .gt('due_amount', 0)
    .order('bill_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateBill(
  id: string,
  updates: Partial<Bill>
): Promise<Bill> {
  const { data, error } = await supabase
    .from('bills')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBillWithItems(
  id: string,
  bill: {
    customer_id: string | null;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    discount: number;
    total: number;
    paid_amount: number;
    due_amount: number;
    notes: string | null;
    status: string;
    bill_date: string;
  },
  items: Array<{ product_name: string; quantity: number; price: number }>
): Promise<Bill> {
  const { data: updatedBill, error: updateError } = await supabase
    .from('bills')
    .update({
      customer_id: bill.customer_id,
      subtotal: bill.subtotal,
      tax_rate: bill.tax_rate,
      tax_amount: bill.tax_amount,
      discount: bill.discount,
      total: bill.total,
      paid_amount: bill.paid_amount,
      due_amount: bill.due_amount,
      notes: bill.notes,
      status: bill.status,
      bill_date: bill.bill_date,
    })
    .eq('id', id)
    .select()
    .single();
  if (updateError) throw updateError;

  const { error: deleteItemsError } = await supabase
    .from('bill_items')
    .delete()
    .eq('bill_id', id);
  if (deleteItemsError) throw deleteItemsError;

  if (items.length > 0) {
    const itemsWithBillId = items.map((item) => ({ ...item, bill_id: id }));
    const { error: itemsError } = await supabase.from('bill_items').insert(itemsWithBillId);
    if (itemsError) throw itemsError;
  }

  return updatedBill;
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await supabase.from('bills').delete().eq('id', id);
  if (error) throw error;
}

export async function recordPayment(id: string, amount: number): Promise<Bill> {
  const { data: bill, error: fetchError } = await supabase
    .from('bills')
    .select('paid_amount, due_amount, total, status')
    .eq('id', id)
    .single();
  if (fetchError) throw fetchError;
  if (!bill) throw new Error('Bill not found');

  const newPaid = Number(bill.paid_amount) + amount;
  const newDue = Number(bill.total) - newPaid;
  const newStatus = newDue <= 0 ? 'paid' : 'pending';

  const { data, error } = await supabase
    .from('bills')
    .update({
      paid_amount: Math.max(0, newPaid),
      due_amount: Math.max(0, newDue),
      status: newStatus,
    })
    .eq('id', id)
    .select('*, customer:customers(*)')
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// TAX EXPORT API
// ============================================================

export async function fetchAllBillsForExport(
  startDate?: string,
  endDate?: string
): Promise<Bill[]> {
  let query = supabase
    .from('bills')
    .select('*, customer:customers(*), bill_items(*)')
    .order('bill_date', { ascending: true });

  if (startDate) query = query.gte('bill_date', startDate);
  if (endDate) query = query.lte('bill_date', endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ============================================================
// DASHBOARD API
// ============================================================

export async function fetchDashboardStats(): Promise<{
  todayBillCount: number;
  todayRevenue: number;
  totalRevenue: number;
  totalCustomers: number;
  totalBills: number;
  topCustomers: Array<{ id: string; name: string; total_spent: number }>;
}> {
  const today = new Date().toISOString().split('T')[0];

  const [todayBills, allBills, customers, topCustomers] = await Promise.all([
    supabase.from('bills').select('total, bill_date').eq('bill_date', today),
    supabase.from('bills').select('total'),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase
      .from('customers')
      .select('id, name, total_spent')
      .order('total_spent', { ascending: false })
      .limit(3),
  ]);

  if (todayBills.error) throw todayBills.error;
  if (allBills.error) throw allBills.error;
  if (customers.error) throw customers.error;
  if (topCustomers.error) throw topCustomers.error;

  const todayRevenue = (todayBills.data ?? []).reduce((sum, b) => sum + Number(b.total), 0);
  const totalRevenue = (allBills.data ?? []).reduce((sum, b) => sum + Number(b.total), 0);

  return {
    todayBillCount: todayBills.data?.length ?? 0,
    todayRevenue,
    totalRevenue,
    totalCustomers: customers.count ?? 0,
    totalBills: allBills.data?.length ?? 0,
    topCustomers: topCustomers.data ?? [],
  };
}

// ============================================================
// PRODUCTS API
// ============================================================

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createProduct(
  product: Omit<Product, 'id' | 'user_id' | 'created_at'>
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProduct(
  id: string,
  updates: Partial<Pick<Product, 'name' | 'description' | 'price' | 'cost_price' | 'unit'>>
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// SETTINGS API
// ============================================================

export async function fetchSettings(): Promise<Settings | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertSettings(
  settings: Pick<Settings, 'business_name' | 'currency' | 'tax_rate'>
): Promise<Settings> {
  const { data: existing } = await supabase.from('settings').select('id').maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('settings')
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('settings')
    .insert(settings)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// CHAT API
// ============================================================

export async function fetchChatHistory(): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function sendChatMessage(
  message: string,
  context: { context_type: string; customer_id: string | null; bill_id: string | null }
): Promise<{ reply: string; sources: string[] }> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ message, ...context }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed (${response.status})`);
  }

  const data = await response.json();
  return { reply: data.reply, sources: data.sources ?? [] };
}

export async function saveChatMessage(
  message: Omit<ChatMessage, 'id' | 'user_id' | 'created_at'>
): Promise<void> {
  const { error } = await supabase.from('chat_messages').insert(message);
  if (error) throw error;
}

export async function clearChatHistory(): Promise<void> {
  const { error } = await supabase.from('chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}
