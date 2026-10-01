import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Bell, ChevronDown, Moon, Search } from 'lucide-react';
import { auth } from './config/firebase';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import EntryForm from './pages/EntryForm';
import StockList from './pages/StockList';
import SoList from './pages/SoList';
import Planning from './pages/Planning';
import ExportPage from './pages/Export';
import ExportHistory from './pages/ExportHistory';
import WmsSync from './pages/WmsSync';
import OfflineStatus from './components/OfflineStatus';
import { syncOfflineQueue } from './services/offlineSync';
import { warmOfflineCache } from './services/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const sync = () => { void syncOfflineQueue(); };
    sync();
    void warmOfflineCache().catch(() => {});
    window.addEventListener('online', sync);
    const timer = window.setInterval(sync, 15000);
    return () => {
      window.removeEventListener('online', sync);
      window.clearInterval(timer);
    };
  }, [user]);

  if (loadingAuth) {
    return <div className="flex h-screen items-center justify-center bg-bgBody text-textMuted font-bold">Loading WMS Application...</div>;
  }

  if (!user) return <Login />;

  const userName = user.displayName || user.email?.split('@')[0] || 'User';
  const initials = userName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  const pages = {
    dashboard: <Dashboard />,
    entry: <EntryForm />,
    stock: <StockList />,
    solist: <SoList />,
    planning: <Planning />,
    export: <ExportPage />,
    exporthistory: <ExportHistory />,
    wmssync: <WmsSync />,
  };

  const titles = {
    dashboard: ['Dashboard', 'Warehouse overview & inbound monitoring'],
    entry: ['Entry Form', 'Register inbound warehouse data'],
    stock: ['Stock List', 'Search and manage inbound cartons'],
    solist: ['SO Master List', 'Sales order and inbound master data'],
    planning: ['SO Planning', 'Plan and monitor warehouse workload'],
    export: ['Export & Outbound', 'Outbound and export operations'],
    exporthistory: ['Export History', 'Historical outbound activity'],
    wmssync: ['WMS Auto Sync', 'Google Sheets → Firebase synchronization'],
  };

  const [title, subtitle] = titles[activeTab] || titles.dashboard;

  return (
    <div className="flex h-screen bg-bgBody overflow-hidden font-sans text-textMain">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="h-[82px] shrink-0 bg-surface/95 backdrop-blur border-b border-borderLight px-5 lg:px-8 flex items-center justify-between gap-6">
          <div className="min-w-0 pl-12 lg:pl-0">
            <p className="text-[9px] uppercase tracking-[0.18em] font-black text-primary">PPFG WMS / {activeTab}</p>
            <h1 className="text-lg lg:text-xl font-black truncate mt-0.5">{title}</h1>
            <p className="hidden md:block text-[10px] font-semibold text-textMuted truncate mt-0.5">{subtitle}</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <OfflineStatus />
            <div className="hidden xl:flex items-center gap-2 w-64 h-10 rounded-xl border border-borderLight bg-bgBody px-3 text-textMuted">
              <Search size={15} />
              <span className="text-xs font-semibold">Quick search...</span>
              <span className="ml-auto text-[9px] font-black bg-surface border border-borderLight px-1.5 py-0.5 rounded">/</span>
            </div>
            <button className="w-10 h-10 rounded-xl border border-borderLight bg-surface flex items-center justify-center text-textMuted hover:text-primary transition-colors"><Bell size={17} /></button>
            <button className="hidden sm:flex w-10 h-10 rounded-xl border border-borderLight bg-surface items-center justify-center text-textMuted hover:text-primary transition-colors"><Moon size={17} /></button>
            <div className="h-9 w-px bg-borderLight mx-1" />
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-black text-xs shadow-glow overflow-hidden">
                {user.photoURL ? <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" /> : initials}
              </div>
              <div className="hidden md:block max-w-32">
                <p className="text-xs font-black truncate">{userName}</p>
                <p className="text-[9px] font-semibold text-textMuted truncate">WMS User</p>
              </div>
              <ChevronDown size={14} className="hidden md:block text-textMuted" />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 lg:p-8">
          {pages[activeTab] || pages.dashboard}
        </div>
      </main>
    </div>
  );
}
