import { useState, useCallback } from 'react';
import {
  FileSpreadsheet,
  Download,
  AlertCircle,
  TrendingUp,
  Receipt,
  DollarSign,
  Percent,
  Calendar,
} from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, StatCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { fetchAllBillsForExport } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import { formatCurrency, formatDate, getCurrencySymbol } from '@/lib/format';
import type { Bill } from '@/lib/types';

export function TaxExportPage() {
  const { settings } = useSettings();
  const currency = settings?.currency ?? 'USD';
  const businessName = settings?.business_name ?? 'Universal Billing';

  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllBillsForExport(startDate, endDate);
      setBills(data);
      setHasSearched(true);
    } catch (err) {
      setError('Failed to load sales data');
      console.error('Tax export load error:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const filteredBills =
    statusFilter === 'all' ? bills : bills.filter((b) => b.status === statusFilter);

  const totalSubtotal = filteredBills.reduce((s, b) => s + Number(b.subtotal), 0);
  const totalTax = filteredBills.reduce((s, b) => s + Number(b.tax_amount), 0);
  const totalDiscount = filteredBills.reduce((s, b) => s + Number(b.discount), 0);
  const grandTotal = filteredBills.reduce((s, b) => s + Number(b.total), 0);
  const paidCount = filteredBills.filter((b) => b.status === 'paid').length;
  const pendingCount = filteredBills.filter((b) => b.status === 'pending').length;
  const cancelledCount = filteredBills.filter((b) => b.status === 'cancelled').length;

  const downloadCSV = () => {
    const headers = [
      'Bill Number',
      'Date',
      'Customer Name',
      'Customer Phone',
      'Status',
      'Subtotal',
      'Tax Rate (%)',
      'Tax Amount',
      'Discount',
      'Total',
      'Items',
      'Notes',
    ];

    const rows = filteredBills.map((bill) => {
      const itemsStr = (bill.bill_items ?? [])
        .map((i) => `${i.product_name} x${i.quantity} @ ${i.price}`)
        .join('; ');
      return [
        bill.bill_number,
        bill.bill_date,
        bill.customer?.name ?? 'Walk-in',
        bill.customer?.phone ?? '',
        bill.status,
        bill.subtotal,
        bill.tax_rate,
        bill.tax_amount,
        bill.discount,
        bill.total,
        itemsStr,
        (bill.notes ?? '').replace(/[\n\r]/g, ' '),
      ];
    });

    const summaryRows = [
      [],
      ['SUMMARY'],
      ['Period', `${startDate} to ${endDate}`],
      ['Business', businessName],
      ['Currency', currency],
      ['Total Bills', String(filteredBills.length)],
      ['Paid Bills', String(paidCount)],
      ['Pending Bills', String(pendingCount)],
      ['Cancelled Bills', String(cancelledCount)],
      ['Total Subtotal', totalSubtotal.toFixed(2)],
      ['Total Tax Collected', totalTax.toFixed(2)],
      ['Total Discount Given', totalDiscount.toFixed(2)],
      ['Grand Total', grandTotal.toFixed(2)],
    ];

    const csvContent = [headers, ...rows, ...summaryRows]
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tax-report_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Tax Report ${startDate} to ${endDate}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #1f2937; }
            h1 { color: #2563eb; margin-bottom: 4px; }
            h2 { margin-top: 30px; margin-bottom: 10px; font-size: 1.1em; }
            .muted { color: #6b7280; font-size: 0.875em; }
            .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 20px 0; max-width: 500px; }
            .summary div { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f3f4f6; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 0.85em; }
            th { background: #f9fafb; font-weight: 600; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          <h1>${businessName}</h1>
          <p class="muted">Tax Report: ${formatDate(startDate)} to ${formatDate(endDate)}</p>
          <div class="summary">
            <div><span>Total Bills</span><strong>${filteredBills.length}</strong></div>
            <div><span>Paid</span><strong>${paidCount}</strong></div>
            <div><span>Pending</span><strong>${pendingCount}</strong></div>
            <div><span>Cancelled</span><strong>${cancelledCount}</strong></div>
            <div><span>Total Subtotal</span><strong>${formatCurrency(totalSubtotal, currency)}</strong></div>
            <div><span>Total Tax</span><strong>${formatCurrency(totalTax, currency)}</strong></div>
            <div><span>Total Discount</span><strong>${formatCurrency(totalDiscount, currency)}</strong></div>
            <div><span>Grand Total</span><strong>${formatCurrency(grandTotal, currency)}</strong></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Bill #</th><th>Date</th><th>Customer</th><th>Status</th>
                <th class="right">Subtotal</th><th class="right">Tax</th><th class="right">Discount</th><th class="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${filteredBills.map(b => `
                <tr>
                  <td>${b.bill_number}</td>
                  <td>${formatDate(b.bill_date)}</td>
                  <td>${b.customer?.name ?? 'Walk-in'}</td>
                  <td>${b.status}</td>
                  <td class="right">${formatCurrency(b.subtotal, currency)}</td>
                  <td class="right">${formatCurrency(b.tax_amount, currency)}</td>
                  <td class="right">${formatCurrency(b.discount, currency)}</td>
                  <td class="right">${formatCurrency(b.total, currency)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 250);
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tax Export</h1>
            <p className="text-sm text-gray-500">Export your sales data for tax reporting</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-5 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              icon={<Calendar size={18} />}
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              icon={<Calendar size={18} />}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Status Filter</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Bills</option>
                <option value="paid">Paid Only</option>
                <option value="pending">Pending Only</option>
                <option value="cancelled">Cancelled Only</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={loadReport} disabled={loading}>
              {loading ? <Spinner size={16} className="text-white" /> : <TrendingUp size={16} />}
              Generate Report
            </Button>
            {filteredBills.length > 0 && (
              <>
                <Button variant="outline" onClick={downloadCSV}>
                  <Download size={16} /> Download CSV
                </Button>
                <Button variant="outline" onClick={printReport}>
                  <FileSpreadsheet size={16} /> Print Report
                </Button>
              </>
            )}
          </div>
        </Card>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* Summary stats */}
        {filteredBills.length > 0 && (
          <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              title="Total Bills"
              value={filteredBills.length}
              icon={<Receipt size={22} />}
              accent="blue"
              subtitle={`${paidCount} paid, ${pendingCount} pending`}
            />
            <StatCard
              title="Total Subtotal"
              value={formatCurrency(totalSubtotal, currency)}
              icon={<DollarSign size={22} />}
              accent="gray"
            />
            <StatCard
              title="Total Tax Collected"
              value={formatCurrency(totalTax, currency)}
              icon={<Percent size={22} />}
              accent="amber"
            />
            <StatCard
              title="Grand Total"
              value={formatCurrency(grandTotal, currency)}
              icon={<TrendingUp size={22} />}
              accent="green"
              subtitle={`${formatCurrency(totalDiscount, currency)} discounts`}
            />
          </div>
        )}

        {/* Results table */}
        {loading ? (
          <Card className="flex items-center justify-center py-16">
            <Spinner size={28} />
          </Card>
        ) : hasSearched ? (
          filteredBills.length === 0 ? (
            <Card>
              <EmptyState
                icon={<FileSpreadsheet size={24} />}
                title="No bills in this period"
                description="Try selecting a different date range"
              />
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Bill #</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Subtotal</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Tax</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Discount</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredBills.map((bill) => (
                      <tr key={bill.id} className="transition-colors hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{bill.bill_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(bill.bill_date)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{bill.customer?.name ?? 'Walk-in'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={bill.status === 'paid' ? 'green' : bill.status === 'pending' ? 'amber' : 'red'}>
                            {bill.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">{formatCurrency(bill.subtotal, currency)}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">{formatCurrency(bill.tax_amount, currency)}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">{formatCurrency(bill.discount, currency)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{formatCurrency(bill.total, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-900">Totals</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(totalSubtotal, currency)}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(totalTax, currency)}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(totalDiscount, currency)}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(grandTotal, currency)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )
        ) : (
          <Card>
            <EmptyState
              icon={<FileSpreadsheet size={24} />}
              title="Generate a Tax Report"
              description="Select a date range and click Generate Report to view and export your sales data"
            />
          </Card>
        )}

        {filteredBills.length > 0 && (
          <p className="mt-3 text-xs text-gray-400">
            Showing {filteredBills.length} bills from {formatDate(startDate)} to {formatDate(endDate)} ·
            Currency: {getCurrencySymbol(currency)}{currency}
          </p>
        )}
      </div>
    </AppLayout>
  );
}
