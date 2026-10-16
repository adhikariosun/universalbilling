import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search, Plus, Trash2, Save, ArrowLeft, AlertCircle, User, Package,
} from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import {
  fetchBillById, updateBillWithItems, fetchCustomers, fetchProducts,
} from '@/lib/api';
import { useSettings } from '@/lib/settings';
import { formatCurrency } from '@/lib/format';
import type { Customer, Product } from '@/lib/types';

interface LineItem {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
}

let editItemId = 0;
function nextEditItemId() {
  editItemId += 1;
  return `edit-item-${editItemId}`;
}

export function EditBillPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const currency = settings?.currency ?? 'USD';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [items, setItems] = useState<LineItem[]>([]);
  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('pending');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProductDropdown, setActiveProductDropdown] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchBillById(id), fetchCustomers(), fetchProducts()])
      .then(([bill, customerData, productData]) => {
        if (!bill) {
          setError('Bill not found');
          return;
        }
        setCustomers(customerData);
        setProducts(productData);
        setTaxRate(bill.tax_rate);
        setDiscount(bill.discount);
        setPaidAmount(bill.paid_amount);
        setNotes(bill.notes ?? '');
        setStatus(bill.status);
        setBillDate(bill.bill_date);
        if (bill.customer) {
          setSelectedCustomer(bill.customer);
          setCustomerSearch(bill.customer.name);
        }
        setItems(
          (bill.bill_items ?? []).map((item) => ({
            id: nextEditItemId(),
            product_name: item.product_name,
            quantity: item.quantity,
            price: item.price,
          }))
        );
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load bill');
        console.error('Edit bill load error:', err);
      })
      .finally(() => setLoading(false));
  }, [id]);

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
  const paid = paidAmount === '' ? 0 : Math.min(paidAmount, total);
  const dueAmount = Math.max(0, total - paid);

  const updateItem = (itemId: string, field: keyof LineItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
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
    setItems((prev) => [...prev, { id: nextEditItemId(), product_name: '', quantity: 1, price: 0 }]);
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== itemId) : prev));
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!id) return;

    const validItems = items.filter((i) => i.product_name.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      setError('Add at least one product with a name and quantity');
      return;
    }

    setSaving(true);
    try {
      const computedStatus = dueAmount > 0 && status === 'paid' ? 'pending' : status;
      await updateBillWithItems(
        id,
        {
          customer_id: selectedCustomer?.id ?? null,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          discount,
          total,
          paid_amount: paid,
          due_amount: dueAmount,
          notes: notes.trim() || null,
          status: computedStatus,
          bill_date: billDate,
        },
        validItems.map((i) => ({
          product_name: i.product_name.trim(),
          quantity: i.quantity,
          price: i.price,
        }))
      );
      navigate('/bills');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bill');
      console.error('Update bill error:', err);
    } finally {
      setSaving(false);
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Edit Bill</h1>
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
                    {!customerSearch.trim() && filteredCustomers.length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        No customers found.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Line items */}
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
                          <p className="px-4 py-2 text-xs text-gray-400">No matching products.</p>
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
              <Input
                label={`Amount Paid (${currency})`}
                type="number"
                min={0}
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0 for unpaid"
              />
              <p className="mt-1.5 text-xs text-gray-400">
                Enter partial amount if customer hasn't paid in full. Leave empty for fully unpaid.
              </p>
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
              {paid > 0 && (
                <>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Paid</span>
                    <span className="font-medium">{formatCurrency(paid, currency)}</span>
                  </div>
                  {dueAmount > 0 && (
                    <div className="flex justify-between text-sm font-semibold text-amber-600">
                      <span>Due</span>
                      <span>{formatCurrency(dueAmount, currency)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          <div className="flex items-center gap-3 pb-8">
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? <Spinner size={18} className="text-white" /> : <Save size={18} />}
              {saving ? 'Saving...' : 'Save Changes'}
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
