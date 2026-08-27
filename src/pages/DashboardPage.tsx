import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, DollarSign, Users, TrendingUp, FilePlus, ArrowRight, Receipt } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { StatCard, Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { InlineSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { fetchDashboardStats, fetchBills } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import { formatCurrency, formatDate } from '@/lib/format';
import type { DashboardStats, Bill } from '@/lib/types';

export function DashboardPage() {
  const { settings } = useSettings();
  const currency = settings?.currency ?? 'USD';
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [dashboardStats, billsData] = await Promise.all([
          fetchDashboardStats(),
          fetchBills(1, 5),
        ]);
        setStats(dashboardStats);
        setRecentBills(billsData.bills);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <AppLayout>
        <InlineSpinner label="Loading dashboard..." />
      </AppLayout>
    );
  }

  const s = stats!;

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Link to="/bills/create">
            <Button>
              <FilePlus size={18} />
              New Bill
            </Button>
          </Link>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Today's Bills"
            value={s.todayBillCount}
            icon={<FileText size={22} />}
            accent="blue"
            subtitle={`${s.totalBills} total bills`}
          />
          <StatCard
            title="Today's Revenue"
            value={formatCurrency(s.todayRevenue, currency)}
            icon={<DollarSign size={22} />}
            accent="green"
            subtitle={`${formatCurrency(s.totalRevenue, currency)} all-time`}
          />
          <StatCard
            title="Customers"
            value={s.totalCustomers}
            icon={<Users size={22} />}
            accent="amber"
          />
          <StatCard
            title="Total Revenue"
            value={formatCurrency(s.totalRevenue, currency)}
            icon={<TrendingUp size={22} />}
            accent="gray"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Recent bills */}
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Recent Bills</h2>
              <Link to="/bills" className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            {recentBills.length === 0 ? (
              <EmptyState
                icon={<Receipt size={24} />}
                title="No bills yet"
                description="Create your first bill to get started"
                action={
                  <Link to="/bills/create">
                    <Button size="sm">
                      <FilePlus size={16} /> Create Bill
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-gray-100">
                {recentBills.map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Receipt size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{bill.bill_number}</p>
                        <p className="text-xs text-gray-500">
                          {bill.customer?.name ?? 'Walk-in'} · {formatDate(bill.bill_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={bill.status === 'paid' ? 'green' : bill.status === 'pending' ? 'amber' : 'red'}>
                        {bill.status}
                      </Badge>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(bill.total, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Top customers */}
          <Card>
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Top Customers</h2>
            </div>
            {s.topCustomers.length === 0 ? (
              <EmptyState
                icon={<Users size={24} />}
                title="No customers yet"
                description="Add customers to track spending"
              />
            ) : (
              <div className="divide-y divide-gray-100">
                {s.topCustomers.map((customer, idx) => (
                  <div key={customer.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(customer.total_spent, currency)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
