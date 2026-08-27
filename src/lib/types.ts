export interface Customer {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  total_spent: number;
  created_at: string;
}

export interface Bill {
  id: string;
  user_id: string;
  customer_id: string | null;
  bill_number: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount: number;
  total: number;
  notes: string | null;
  status: 'paid' | 'pending' | 'cancelled';
  bill_date: string;
  created_at: string;
  customer?: Customer | null;
  bill_items?: BillItem[];
}

export interface BillItem {
  id: string;
  bill_id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  context_type: string | null;
  customer_id: string | null;
  bill_id: string | null;
  sources: string[] | null;
  created_at: string;
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  created_at: string;
}

export interface Settings {
  id: string;
  user_id: string;
  business_name: string;
  currency: string;
  tax_rate: number;
  updated_at: string;
}

export interface DashboardStats {
  todayBillCount: number;
  todayRevenue: number;
  totalRevenue: number;
  totalCustomers: number;
  totalBills: number;
  topCustomers: Array<{
    id: string;
    name: string;
    total_spent: number;
  }>;
}
