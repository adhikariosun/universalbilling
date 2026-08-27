import { NavLink, useNavigate } from 'react-router-dom';
import { Receipt, LayoutDashboard, FilePlus, FileText, Users, Package, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/lib/settings';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/bills/create', label: 'Create Bill', icon: FilePlus },
  { to: '/bills', label: 'Bills', icon: FileText },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Navbar() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { settings } = useSettings();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Receipt size={20} />
          </div>
          <span className="hidden text-lg font-bold text-gray-900 sm:block">
            {settings?.business_name ?? 'Universal Billing'}
          </span>
        </div>

        <nav className="flex items-center gap-0.5 overflow-x-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Icon size={18} />
              <span className="hidden xl:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Sign out"
        >
          <LogOut size={18} />
          <span className="hidden lg:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
