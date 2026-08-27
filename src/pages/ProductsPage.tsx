import { useEffect, useState, FormEvent } from 'react';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  Search,
} from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineSpinner, Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { fetchProducts, createProduct, updateProduct, deleteProduct } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import { formatCurrency } from '@/lib/format';
import type { Product } from '@/lib/types';

export function ProductsPage() {
  const { settings } = useSettings();
  const currency = settings?.currency ?? 'USD';
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: 0, unit: 'pcs' });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch (err) {
      console.error('Products load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filtered = search
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  const openAddModal = () => {
    setEditing(null);
    setForm({ name: '', description: '', price: 0, unit: 'pcs' });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      unit: product.unit,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim()) {
      setFormError('Product name is required');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateProduct(editing.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          price: form.price,
          unit: form.unit.trim() || 'pcs',
        });
      } else {
        await createProduct({
          name: form.name.trim(),
          description: form.description.trim() || null,
          price: form.price,
          unit: form.unit.trim() || 'pcs',
        });
      }
      setModalOpen(false);
      await loadProducts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save product');
      console.error('Save product error:', err);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProduct(deleteTarget.id);
      setDeleteTarget(null);
      await loadProducts();
    } catch (err) {
      console.error('Delete product error:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <Button onClick={openAddModal}>
            <Plus size={18} /> Add Product
          </Button>
        </div>

        <div className="mb-4">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search size={18} />}
          />
        </div>

        <Card>
          {loading ? (
            <InlineSpinner label="Loading products..." />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Package size={24} />}
              title={search ? 'No products found' : 'No products yet'}
              description={search ? 'Try a different search term' : 'Add products to use them when creating bills'}
              action={
                !search && (
                  <Button size="sm" onClick={openAddModal}>
                    <Plus size={16} /> Add Product
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
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden sm:table-cell">Description</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Unit</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Price</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((product) => (
                    <tr key={product.id} className="transition-colors hover:bg-gray-50/50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <Package size={16} />
                          </div>
                          <p className="text-sm font-medium text-gray-900">{product.name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 hidden sm:table-cell max-w-xs truncate">
                        {product.description ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{product.unit}</td>
                      <td className="px-5 py-3.5 text-right text-sm font-semibold text-gray-900">
                        {formatCurrency(product.price, currency)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(product)}
                            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(product)}
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
          )}
        </Card>

        {!loading && filtered.length > 0 && (
          <p className="mt-3 text-sm text-gray-400">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      {/* Add/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Product' : 'Add Product'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name *"
            placeholder="Product name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              placeholder="Optional description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Price"
              type="number"
              min={0}
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            />
            <Input
              label="Unit"
              placeholder="pcs, kg, liter..."
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </div>

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
              {editing ? 'Save Changes' : 'Add Product'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Product"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span>?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
            {deleting ? <Spinner size={16} className="text-white" /> : <Trash2 size={16} />}
            Delete
          </Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
