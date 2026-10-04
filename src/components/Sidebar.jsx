import { useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  Activity,
  Boxes,
  Download,
  FileSpreadsheet,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  RefreshCw,
  Settings2,
  X,
} from 'lucide-react';
import { auth } from '../config/firebase';

const menuGroups = [
  {
    title: 'Overview',
    items: [{ id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' }],
  },
  {
    title: 'Warehouse',
    items: [
      { id: 'entry', icon: Inbox, label: 'Entry Form' },
      { id: 'stock', icon: Package, label: 'Stock List' },
      { id: 'solist', icon: FileSpreadsheet, label: 'SO Master List' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { id: 'export', icon: Download, label: 'Export & Outbound' },
      { id: 'exporthistory', icon: History, label: 'Export History' },
      { id: 'wmssync', icon: RefreshCw, label: 'WMS Auto Sync', badge: 'LIVE' },
    ],
  },
];

export default function Sidebar({ activeTab, setActiveTab }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigate = (id) => {
    setActiveTab(id);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    try { await signOut(auth); } catch (error) { console.error('Logout error:', error); }
  };

  return (
    <>
      <button onClick={() => setMobileOpen(true)} className="lg:hidden fixed top-4 left-4 z-[70] w-10 h-10 rounded-xl bg-sidebar text-white flex items-center justify-center shadow-lg">
        <Menu size={20} />
      </button>

      {mobileOpen && <div onClick={() => setMobileOpen(false)} className="lg:hidden fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[60]" />}

      <aside className={`fixed lg:static inset-y-0 left-0 z-[65] w-[245px] bg-sidebar text-white flex flex-col shrink-0 transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-[82px] px-6 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow">
              <Boxes size={21} />
            </div>
            <div>
              <p className="font-black tracking-tight leading-none">PPFG WMS</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.18em] mt-1">Warehouse System</p>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {menuGroups.map((group) => (
            <div key={group.title}>
              <p className="px-3 mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{group.title}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      className={`w-full h-11 px-3 rounded-xl flex items-center gap-3 text-left transition-all group ${active ? 'bg-primary text-white shadow-glow' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
                    >
                      <Icon size={18} className={active ? 'text-white' : 'text-slate-500 group-hover:text-white'} />
                      <span className="text-xs font-bold flex-1">{item.label}</span>
                      {item.badge && <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${active ? 'bg-white/20 text-white' : 'bg-emerald-500/15 text-emerald-400'}`}>{item.badge}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-1">
          <div className="rounded-xl bg-white/5 px-3 py-3 mb-2 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center"><Activity size={17} /></div>
            <div className="min-w-0"><p className="text-[10px] font-black">Firebase Live</p><p className="text-[9px] text-slate-500 font-semibold truncate">Realtime database</p></div>
          </div>
          <button className="w-full h-10 px-3 rounded-xl flex items-center gap-3 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><Settings2 size={17} /><span className="text-xs font-bold">System Settings</span></button>
          <button onClick={handleLogout} className="w-full h-10 px-3 rounded-xl flex items-center gap-3 text-slate-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"><LogOut size={17} /><span className="text-xs font-bold">Sign Out</span></button>
        </div>
      </aside>
    </>
  );
}
