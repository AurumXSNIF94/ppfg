import {
  LayoutDashboard,
  PackagePlus,
  Boxes,
  Warehouse,
  LogOut,
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const menus = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'entry',
      label: 'Inbound Entry',
      icon: PackagePlus,
    },
    {
      id: 'stock',
      label: 'Stock List',
      icon: Boxes,
    },
  ];

  return (
    <aside className="w-64 shrink-0 h-screen bg-sidebar text-white flex flex-col p-4">
      {/* LOGO */}
      <div className="px-4 py-5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow">
            <Warehouse size={22} />
          </div>

          <div>
            <h1 className="text-lg font-extrabold tracking-tight">
              WMS Inbound
            </h1>
            <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">
              Warehouse System
            </p>
          </div>
        </div>
      </div>

      {/* MENU */}
      <nav className="flex-1 space-y-2">
        <div className="px-4 mb-3">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/40">
            Main Menu
          </span>
        </div>

        {menus.map((menu) => {
          const Icon = menu.icon;
          const active = activeTab === menu.id;

          return (
            <button
              key={menu.id}
              type="button"
              onClick={() => setActiveTab(menu.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl
                text-sm font-bold transition-all duration-200
                ${
                  active
                    ? 'bg-primary text-white shadow-glow'
                    : 'text-white/60 hover:text-white hover:bg-sidebar-hover'
                }
              `}
            >
              <Icon size={19} strokeWidth={active ? 2.5 : 2} />

              <span>{menu.label}</span>
            </button>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div className="border-t border-white/10 pt-4 mt-4">
        <div className="px-4 py-3 mb-2">
          <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
            System
          </div>

          <div className="text-xs text-white/70 font-semibold mt-1">
            PPFG Warehouse
          </div>
        </div>

        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-white/50 hover:text-white hover:bg-sidebar-hover transition-all"
          onClick={() => {
            alert('Logout belum diaktifkan.');
          }}
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}