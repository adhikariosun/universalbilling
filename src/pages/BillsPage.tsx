import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Receipt,
  Trash2,
  Eye,
  FilePlus,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Download,
  X,
  Printer,
} from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner, InlineSpinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { fetchBills, searchBills, deleteBill, fetchBillById } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Bill } from '@/lib/types';

const PAGE_SIZE = 10;

export function BillsPage() {
  const { settings } = useSettings();
  const currency = settings?.currency ?? 'USD';
  const businessName = settings?.business_name ?? 'Universal Billing';
  const [bills, setBills] = useState<Bill[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewBill, setViewBill] = useState<Bill | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const loadBills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (searchMode && search.trim()) {
        const results = await searchBills(search.trim());
        setBills(results);
        setCount(results.length);
      } else {
        const { bills: data, count: total } = await fetchBills(page, PAGE_SIZE);
        setBills(data);
        setCount(total);
      }
    } catch (err) {
      setError('Failed to load bills');
      console.error('Bills load error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, searchMode, search]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (value.trim()) {
      setSearchMode(true);
      setPage(1);
    } else {
      setSearchMode(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBill(deleteTarget.id);
      setDeleteTarget(null);
      await loadBills();
    } catch (err) {
      setError('Failed to delete bill');
      console.error('Delete bill error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleView = async (bill: Bill) => {
    setViewLoading(true);
    setViewBill(bill);
    try {
      const full = await fetchBillById(bill.id);
      if (full) setViewBill(full);
    } catch (err) {
      console.error('Fetch bill detail error:', err);
    } finally {
      setViewLoading(false);
    }
  };

  const printBill = (bill: Bill) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const items = bill.bill_items ?? [];
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
              ${items.map(i => `
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

  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
          <Link to="/bills/create">
            <Button>
              <FilePlus size={18} /> New Bill
            </Button>
          </Link>
        </div>

        <div className="mb-4">
          <Input
            placeholder="Search by bill number or customer name..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            icon={<Search size={18} />}
          />
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <Card>
          {loading ? (
            <InlineSpinner label="Loading bills..." />
          ) : bills.length === 0 ? (
            <EmptyState
              icon={<Receipt size={24} />}
              title={search ? 'No bills found' : 'No bills yet'}
              description={search ? 'Try a different search term' : 'Create your first bill to get started'}
              action={
                !search && (
                  <Link to="/bills/create">
                    <Button size="sm">
                      <FilePlus size={16} /> Create Bill
                    </Button>
                  </Link>
                )
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Bill #</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Customer</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Total</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bills.map((bill) => (
                      <tr key={bill.id} className="transition-colors hover:bg-gray-50/50">
                        <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{bill.bill_number}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{bill.customer?.name ?? 'Walk-in'}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{formatDate(bill.bill_date)}</td>
                        <td className="px-5 py-3.5">
                          <Badge variant={bill.status === 'paid' ? 'green' : bill.status === 'pending' ? 'amber' : 'red'}>
                            {bill.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm font-semibold text-gray-900">
                          {formatCurrency(bill.total, currency)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleView(bill)}
                              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                              title="View"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => exportBillPDF(bill)}
                              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                              title="Export PDF"
                            >
                              <Download size={16} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(bill)}
                              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!searchMode && totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                  <p className="text-sm text-gray-500">
                    Page {page} of {totalPages} · {count} bills
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Bill"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete bill <span className="font-semibold">{deleteTarget?.bill_number}</span>?
          This action cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
            {deleting ? <Spinner size={16} className="text-white" /> : <Trash2 size={16} />}
            Delete
          </Button>
        </div>
      </Modal>

      {/* Bill detail view */}
      <Modal
        open={!!viewBill}
        onClose={() => setViewBill(null)}
        title={viewBill?.bill_number ?? ''}
        size="lg"
      >
        {viewLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size={24} />
          </div>
        ) : viewBill ? (
          <div>
            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium uppercase text-gray-400">Customer</p>
                <p className="text-sm font-medium text-gray-900">{viewBill.customer?.name ?? 'Walk-in'}</p>
                {viewBill.customer?.phone && <p className="text-sm text-gray-500">{viewBill.customer.phone}</p>}
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-400">Date</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(viewBill.bill_date)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-400">Status</p>
                <Badge variant={viewBill.status === 'paid' ? 'green' : viewBill.status === 'pending' ? 'amber' : 'red'}>
                  {viewBill.status}
                </Badge>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Product</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Qty</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Price</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(viewBill.bill_items ?? []).map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2.5 text-sm text-gray-900">{item.product_name}</td>
                      <td className="px-4 py-2.5 text-right text-sm text-gray-600">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-sm text-gray-600">{formatCurrency(item.price, currency)}</td>
                      <td className="px-4 py-2.5 text-right text-sm font-medium text-gray-900">{formatCurrency(item.total, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span><span>{formatCurrency(viewBill.subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tax ({viewBill.tax_rate}%)</span><span>{formatCurrency(viewBill.tax_amount, currency)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Discount</span><span>-{formatCurrency(viewBill.discount, currency)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
                <span>Total</span><span>{formatCurrency(viewBill.total, currency)}</span>
              </div>
            </div>

            {viewBill.notes && (
              <div className="mt-4 rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-medium uppercase text-gray-400">Notes</p>
                <p className="mt-1 text-sm text-gray-600">{viewBill.notes}</p>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => printBill(viewBill)}>
                <Printer size={16} /> Print
              </Button>
              <Button onClick={() => setViewBill(null)}>
                <X size={16} /> Close
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </AppLayout>
  );
}
