import { useEffect, useState, FormEvent, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, Save, ArrowLeft, CheckCircle, AlertCircle, User, Printer, Package } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { fetchCustomers, createBill, createCustomer, fetchProducts, fetchBillById } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Customer, Product, Bill } from '@/lib/types';

interface LineItem {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
}

let itemId = 0;
function nextItemId() {
  itemId += 1;
  return `item-${itemId}`;
}

export function CreateBillPage() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const currency = settings?.currency ?? 'USD';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [items, setItems] = useState<LineItem[]>([
    { id: nextItemId(), product_name: '', quantity: 1, price: 0 },
  ]);
  const [taxRate, setTaxRate] = useState(settings?.tax_rate ?? 0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('paid');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBill, setCreatedBill] = useState<Bill | null>(null);

  // Product dropdown state per line item
  const [activeProductDropdown, setActiveProductDropdown] = useState<string | null>(null);

  // Customer creation state
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  useEffect(() => {
    Promise.all([fetchCustomers(), fetchProducts()])
      .then(([customerData, productData]) => {
        setCustomers(customerData);
        setProducts(productData);
      })
      .catch((err) => console.error('Failed to load data:', err))
      .finally(() => setLoading(false));
  }, []);

  // Update tax rate when settings load
  useEffect(() => {
    if (settings) setTaxRate(settings.tax_rate);
  }, [settings]);

  const filteredCustomers = customerSearch
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
          (c.phone ?? '').includes(customerSearch)
      )
    : customers;

  const filteredProducts = (query: string) =>
    query
      ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
      : products;

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const total = Math.max(0, subtotal + taxAmount - discount);

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, [field]: field === 'product_name' ? String(value) : Number(value) }
          : item
      )
    );
  };

  const selectProduct = (itemId: string, product: Product) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, product_name: product.name, price: product.price }
          : item
      )
    );
    setActiveProductDropdown(null);
  };

  const addItem = () => {
    setItems((prev) => [...prev, { id: nextItemId(), product_name: '', quantity: 1, price: 0 }]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
  };

  const handleCreateCustomer = async () => {
    if (!customerSearch.trim()) return;
    setCreatingCustomer(true);
    try {
      const newCustomer = await createCustomer({
        name: customerSearch.trim(),
        phone: null,
        email: null,
        address: null,
      });
      setCustomers((prev) => [newCustomer, ...prev]);
      setSelectedCustomer(newCustomer);
      setShowCustomerDropdown(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customer');
      console.error('Create customer error:', err);
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const validItems = items.filter((i) => i.product_name.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      setError('Add at least one product with a name and quantity');
      return;
    }

    setSaving(true);
    try {
      const bill = await createBill(
        {
          customer_id: selectedCustomer?.id ?? null,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          discount,
          total,
          notes: notes.trim() || null,
          status,
          bill_date: billDate,
        },
        validItems.map((i) => ({
          product_name: i.product_name.trim(),
          quantity: i.quantity,
          price: i.price,
        }))
      );
      // Fetch the full bill with items for printing
      const fullBill = await fetchBillById(bill.id);
      setCreatedBill(fullBill);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bill');
      console.error('Create bill error:', err);
    } finally {
      setSaving(false);
    }
  };

  const printBill = (bill: Bill) => {
    const businessName = settings?.business_name ?? 'Universal Billing';
    const win = window.open('', '_blank');
    if (!win) return;
    const billItems = bill.bill_items ?? [];
    win.document.write(`
      <html>
        <head>
          <title>${bill.bill_number}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #1f2937; }
            h1 { color: #2563eb; margin-bottom: 4px; }
            .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .section { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            th { background: #f9fafb; font-weight: 600; }
            .total-row { font-weight: bold; font-size: 1.1em; }
            .muted { color: #6b7280; font-size: 0.875em; }
            .totals { margin-top: 20px; margin-left: auto; width: 250px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${businessName}</h1>
              <p class="muted">Invoice ${bill.bill_number}</p>
            </div>
            <div style="text-align: right;">
              <p class="muted">Date: ${formatDate(bill.bill_date)}</p>
              <p class="muted">Status: ${bill.status}</p>
            </div>
          </div>
          <div class="section">
            <p class="muted">Billed To</p>
            <p style="font-weight: 600; font-size: 1.1em;">${bill.customer?.name ?? 'Walk-in Customer'}</p>
            ${bill.customer?.phone ? `<p class="muted">${bill.customer.phone}</p>` : ''}
          </div>
          <table>
            <thead>
              <tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${billItems.map(i => `
                <tr>
                  <td>${i.product_name}</td>
                  <td>${i.quantity}</td>
                  <td>${formatCurrency(i.price, currency)}</td>
                  <td>${formatCurrency(i.total, currency)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="totals">
            <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span class="muted">Subtotal</span><span>${formatCurrency(bill.subtotal, currency)}</span></div>
            <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span class="muted">Tax (${bill.tax_rate}%)</span><span>${formatCurrency(bill.tax_amount, currency)}</span></div>
            <div style="display: flex; justify-content: space-between; padding: 4px 0;"><span class="muted">Discount</span><span>-${formatCurrency(bill.discount, currency)}</span></div>
            <div class="total-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-top: 2px solid #e5e7eb; margin-top: 8px;"><span>Total</span><span>${formatCurrency(bill.total, currency)}</span></div>
          </div>
          ${bill.notes ? `<div class="section" style="margin-top: 30px;"><p class="muted">Notes</p><p>${bill.notes}</p></div>` : ''}
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 250);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Spinner size={28} />
        </div>
      </AppLayout>
    );
  }

  if (success && createdBill) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle size={28} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Bill Created Successfully!</h2>
            <p className="mt-1 text-sm text-gray-500">Bill {createdBill.bill_number} has been saved</p>
            <div className="mt-6 flex gap-3">
              <Button onClick={() => printBill(createdBill)}>
                <Printer size={18} /> Print Bill
              </Button>
              <Button variant="outline" onClick={() => navigate('/bills')}>
                Go to Bills
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate('/bills')}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Create Bill</h1>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Customer selection */}
          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Customer</h2>
            <div className="relative">
              <Input
                placeholder="Search existing customer or type a new name..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerDropdown(true);
                  setSelectedCustomer(null);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                icon={<Search size={18} />}
              />
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={handleClearCustomer}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600"
                >
                  <Trash2 size={16} />
                </button>
              )}
              {showCustomerDropdown && !selectedCustomer && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowCustomerDropdown(false)} />
                  <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    {filteredCustomers.length > 0 && (
                      <>
                        <p className="px-4 py-1.5 text-xs font-semibold uppercase text-gray-400">Existing Customers</p>
                        {filteredCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => handleSelectCustomer(customer)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-blue-50"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                              <User size={15} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                              {customer.phone && <p className="text-xs text-gray-500">{customer.phone}</p>}
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                    {customerSearch.trim() && !filteredCustomers.some((c) => c.name.toLowerCase() === customerSearch.toLowerCase().trim()) && (
                      <>
                        <div className="border-t border-gray-100" />
                        <button
                          type="button"
                          onClick={handleCreateCustomer}
                          disabled={creatingCustomer}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-green-50"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
                            {creatingCustomer ? <Spinner size={14} /> : <Plus size={15} />}
                          </div>
                          <p className="text-sm font-medium text-green-700">
                            {creatingCustomer ? 'Creating...' : `Create "${customerSearch.trim()}" as new customer`}
                          </p>
                        </button>
                      </>
                    )}
                    {!customerSearch.trim() && filteredCustomers.length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        No customers yet. Type a name above to create one.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            {!selectedCustomer && (
              <p className="mt-2 text-xs text-gray-400">
                Select an existing customer or type a new name to add them
              </p>
            )}
          </Card>

          {/* Line items with product catalog */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Products</h2>
              <Button type="button" variant="secondary" size="sm" onClick={addItem}>
                <Plus size={16} /> Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.id} className="flex items-end gap-2">
                  <div className="relative flex-1">
                    {idx === 0 && (
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Product</label>
                    )}
                    <input
                      type="text"
                      placeholder="Type to search products or enter custom name"
                      value={item.product_name}
                      onChange={(e) => updateItem(item.id, 'product_name', e.target.value)}
                      onFocus={() => setActiveProductDropdown(item.id)}
                      onBlur={() => setTimeout(() => setActiveProductDropdown(null), 150)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {activeProductDropdown === item.id && products.length > 0 && (
                      <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                        {filteredProducts(item.product_name).length === 0 ? (
                          <p className="px-4 py-2 text-xs text-gray-400">No matching products. Custom name will be used.</p>
                        ) : (
                          filteredProducts(item.product_name).map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectProduct(item.id, product)}
                              className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-blue-50"
                            >
                              <div className="flex h-7 w-7 items-center justify-center rounded bg-blue-50 text-blue-600">
                                <Package size={13} />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{product.name}</p>
                                <p className="text-xs text-gray-500">{formatCurrency(product.price, currency)} / {product.unit}</p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <div className="w-20">
                    {idx === 0 && (
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Qty</label>
                    )}
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="w-28">
                    {idx === 0 && (
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Price</label>
                    )}
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="w-24 text-right">
                    {idx === 0 && (
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Total</label>
                    )}
                    <p className="py-2.5 text-sm font-semibold text-gray-900">
                      {formatCurrency(item.quantity * item.price, currency)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    disabled={items.length === 1}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            {products.length > 0 && (
              <p className="mt-3 text-xs text-gray-400">
                Tip: Start typing a product name to auto-fill its price from your catalog
              </p>
            )}
          </Card>

          {/* Bill details */}
          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Bill Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Bill Date"
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <Input
                label="Tax Rate (%)"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
              />
              <Input
                label={`Discount (${currency})`}
                type="number"
                min={0}
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </div>
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes..."
                className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </Card>

          {/* Summary */}
          <Card className="p-5">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax ({taxRate}%)</span>
                <span className="font-medium">{formatCurrency(taxAmount, currency)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Discount</span>
                <span className="font-medium">-{formatCurrency(discount, currency)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-gray-100 pt-3 text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>{formatCurrency(total, currency)}</span>
              </div>
            </div>
          </Card>

          <div className="flex items-center gap-3 pb-8">
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? <Spinner size={18} className="text-white" /> : <Save size={18} />}
              {saving ? 'Saving...' : 'Save Bill'}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => navigate('/bills')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
