import { useState, FormEvent, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useSettings } from '@/lib/settings';

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'NPR', label: 'Nepali Rupee (Rs)' },
  { code: 'INR', label: 'Indian Rupee (₹)' },
  { code: 'JPY', label: 'Japanese Yen (¥)' },
  { code: 'AUD', label: 'Australian Dollar (A$)' },
  { code: 'CAD', label: 'Canadian Dollar (C$)' },
  { code: 'CHF', label: 'Swiss Franc (CHF)' },
  { code: 'CNY', label: 'Chinese Yuan (¥)' },
  { code: 'SGD', label: 'Singapore Dollar (S$)' },
  { code: 'AED', label: 'UAE Dirham (AED)' },
  { code: 'SAR', label: 'Saudi Riyal (SAR)' },
];

export function SettingsPage() {
  const { settings, loading, saveSettings, refresh } = useSettings();
  const [businessName, setBusinessName] = useState('Universal Billing');
  const [currency, setCurrency] = useState('USD');
  const [taxRate, setTaxRate] = useState(0);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setBusinessName(settings.business_name);
      setCurrency(settings.currency);
      setTaxRate(settings.tax_rate);
    }
  }, [settings]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await saveSettings({
        business_name: businessName.trim() || 'Universal Billing',
        currency,
        tax_rate: taxRate,
      });
      setSuccess(true);
      refresh();
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      console.error('Settings save error:', err);
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
      <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <SettingsIcon size={22} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        </div>

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            <CheckCircle size={18} />
            Settings saved successfully!
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Business Profile</h2>
            <Input
              label="Business Name"
              placeholder="Your business name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
            <p className="mt-2 text-xs text-gray-400">
              This name appears on bills, the navbar, and printed invoices
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Currency & Tax</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-400">
                  All amounts across the app will use this currency
                </p>
              </div>
              <Input
                label="Default Tax Rate (%)"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
              />
              <p className="text-xs text-gray-400">
                This tax rate will be pre-filled when creating new bills
              </p>
            </div>
          </Card>

          <div className="pb-8">
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? <Spinner size={18} className="text-white" /> : <Save size={18} />}
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
