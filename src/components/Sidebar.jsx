import { LayoutDashboard, Inbox, Package, FileSpreadsheet, LogOut } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'entry', icon: Inbox, label: 'Entry Form' },
    { id: 'stock', icon: Package, label: 'Stock List' },
    { id: 'solist', icon: FileSpreadsheet, label: 'SO List Database' }, // Menu untuk daftar SO
  ];

  return (
    <aside className="w-20 bg-sidebar flex flex-col items-center py-8 z-50 shrink-0 h-screen transition-all">
      <div className="text-white font-black text-xl mb-12 bg-gradient-to-br from-indigo-400 to-indigo-600 bg-clip-text text-transparent">
        WMS
      </div>
      
      <div className="flex flex-col gap-6 w-full items-center flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-12 h-12 rounded-xl flex justify-center items-center transition-all duration-300 relative group
                ${isActive ? 'bg-primary text-white shadow-[0_4px_15px_rgba(79,70,229,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/10'}
              `}
            >
              <Icon size={22} />
              <span className="absolute left-16 bg-slate-800 text-white px-3 py-1.5 rounded-md text-xs font-semibold opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all whitespace-nowrap pointer-events-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <button className="text-slate-400 hover:text-red-400 transition-colors mt-auto group relative w-12 h-12 flex justify-center items-center rounded-xl hover:bg-white/5">
        <LogOut size={22} />
        <span className="absolute left-16 bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all whitespace-nowrap pointer-events-none">
          Logout
        </span>
      </button>
    </aside>
  );
}
