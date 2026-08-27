import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  UserPlus,
  Users as UsersIcon,
  Pencil,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  DollarSign,
  FilePlus,
} from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineSpinner, Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { fetchCustomers, searchCustomers, createCustomer, updateCustomer } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Customer } from '@/lib/types';

export function CustomersPage() {
  const { settings } = useSettings();
  const currency = settings?.currency ?? 'USD';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = search.trim()
        ? await searchCustomers(search.trim())
        : await fetchCustomers();
      setCustomers(data);
    } catch (err) {
      setError('Failed to load customers');
      console.error('Customers load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search]);

  const openAddModal = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', address: '' });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditing(customer);
    setForm({
      name: customer.name,
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      address: customer.address ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateCustomer(editing.id, {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
        });
      } else {
        await createCustomer({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
        });
      }
      setModalOpen(false);
      await loadCustomers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save customer');
      console.error('Save customer error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <Button onClick={openAddModal}>
            <UserPlus size={18} /> Add Customer
          </Button>
        </div>

        <div className="mb-4">
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            <InlineSpinner label="Loading customers..." />
          ) : customers.length === 0 ? (
            <EmptyState
              icon={<UsersIcon size={24} />}
              title={search ? 'No customers found' : 'No customers yet'}
              description={search ? 'Try a different search term' : 'Add your first customer to get started'}
              action={
                !search && (
                  <Button size="sm" onClick={openAddModal}>
                    <UserPlus size={16} /> Add Customer
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Contact</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Joined</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Total Spent</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="transition-colors hover:bg-gray-50/50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600">
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                            {customer.address && (
                              <p className="flex items-center gap-1 text-xs text-gray-400">
                                <MapPin size={11} /> {customer.address}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {customer.phone ? (
                          <p className="flex items-center gap-1.5 text-sm text-gray-600">
                            <Phone size={13} className="text-gray-400" /> {customer.phone}
                          </p>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                        {customer.email && (
                          <p className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Mail size={12} /> {customer.email}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{formatDate(customer.created_at)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="flex items-center justify-end gap-1 text-sm font-semibold text-gray-900">
                          <DollarSign size={13} className="text-green-500" />
                          {formatCurrency(customer.total_spent, currency)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => openEditModal(customer)}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {!loading && customers.length > 0 && (
          <p className="mt-3 text-sm text-gray-400">{customers.length} customer{customers.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      {/* Add/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Customer' : 'Add Customer'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name *"
            placeholder="Customer name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />
          <Input
            label="Phone"
            placeholder="Phone number"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            icon={<Phone size={18} />}
          />
          <Input
            label="Email"
            type="email"
            placeholder="email@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            icon={<Mail size={18} />}
          />
          <Input
            label="Address"
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            icon={<MapPin size={18} />}
          />

          {formError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle size={16} />
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner size={16} className="text-white" /> : null}
              {editing ? 'Save Changes' : 'Add Customer'}
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
