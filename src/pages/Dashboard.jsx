import React, { useState } from 'react';
import { 
  LayoutGrid, Package, FileText, ClipboardList, Download, History, 
  Moon, User, Box, FileDigit, Hash, MapPin, CheckSquare 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

export default function FGWHDashboard() {
  const [chartView, setChartView] = useState('SO');

  // Dummy Data for Chart (Bisa diganti dengan state dari Firebase)
  const dataVolume = [
    { name: 'SO-6292', SOLID: 120, MIX: 30 },
    { name: 'SO-6293', SOLID: 80, MIX: 15 },
    { name: 'SO-6294', SOLID: 200, MIX: 50 },
    { name: 'SO-6295', SOLID: 90, MIX: 0 },
    { name: 'SO-6296', SOLID: 150, MIX: 25 },
  ];

  // Dummy Data for Recent Activity Feed
  const recentActivities = [
    { id: 1, time: '14:30 WIB', so: '10206292', ctn: 5, inner: 60, type: 'SOLID' },
    { id: 2, time: '14:15 WIB', so: '10206292', ctn: 2, inner: 24, type: 'MIX' },
    { id: 3, time: '13:45 WIB', so: '10206295', ctn: 10, inner: 120, type: 'SOLID' },
    { id: 4, time: '13:10 WIB', so: '10206296', ctn: 1, inner: 12, type: 'MIX' },
    { id: 5, time: '11:20 WIB', so: '10206293', ctn: 20, inner: 240, type: 'SOLID' },
  ];

  return (
    <div className="flex h-screen bg-[#f4f7fe] font-sans text-slate-800 overflow-hidden">
      
      {/* SIDEBAR (Dark Navy) */}
      <aside className="w-20 bg-[#111827] flex flex-col items-center py-6 gap-8 z-20 shadow-xl">
        <div className="text-white font-black text-xl tracking-wider">WMS</div>
        <nav className="flex flex-col gap-4 w-full px-4">
          <SidebarIcon icon={<LayoutGrid size={20} />} active />
          <SidebarIcon icon={<Package size={20} />} />
          <SidebarIcon icon={<FileText size={20} />} />
          <SidebarIcon icon={<ClipboardList size={20} />} />
          <SidebarIcon icon={<Download size={20} />} />
          <SidebarIcon icon={<History size={20} />} />
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* HEADER */}
        <header className="flex justify-between items-center px-8 py-6 bg-[#f4f7fe]/80 backdrop-blur-md z-10">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              Welcome back, <span className="text-indigo-600">Masfiyal Illah</span>
            </h1>
            <p className="text-sm font-semibold text-slate-500 mt-1">Finished Goods Inbound Control</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 shadow-sm transition-colors">
              <Moon size={18} />
            </button>
            <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 overflow-hidden shadow-sm">
              <User size={20} />
            </div>
          </div>
        </header>

        {/* SCROLLABLE DASHBOARD CONTENT */}
        <main className="flex-1 overflow-y-auto px-8 pb-8 pt-2 scroll-smooth">
          
          {/* 5 KPI CARDS ROW */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {/* Primary Highlight Card */}
            <div className="bg-indigo-600 rounded-2xl p-5 shadow-lg shadow-indigo-200 flex items-center gap-4 text-white transform transition hover:-translate-y-1">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Box size={24} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-100 mb-1">Total Cartons</p>
                <h3 className="text-2xl font-black leading-none">1,240</h3>
              </div>
            </div>

            {/* Standard Metrics Cards */}
            <KPICard icon={<FileDigit size={24} className="text-emerald-600" />} bgIcon="bg-emerald-100" title="Active SOs" value="12" />
            <KPICard icon={<Hash size={24} className="text-amber-600" />} bgIcon="bg-amber-100" title="Total Inner Boxes" value="14,880" />
            <KPICard icon={<MapPin size={24} className="text-rose-600" />} bgIcon="bg-rose-100" title="Pending Putaway" value="45" />
            <KPICard icon={<CheckSquare size={24} className="text-blue-600" />} bgIcon="bg-blue-100" title="Daily Target" value="85%" />
          </div>

          {/* MAIN GRID: CHART & RECENT ACTIVITY */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. INBOUND TREND CHART (Takes 2 Columns) */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-extrabold text-slate-800">Inbound Volume per SO</h2>
                <div className="flex bg-slate-100 rounded-lg p-1">
                  <button 
                    onClick={() => setChartView('SO')}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${chartView === 'SO' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
                  >
                    By Sales Order
                  </button>
                  <button 
                    onClick={() => setChartView('Type')}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${chartView === 'Type' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
                  >
                    By Type
                  </button>
                </div>
              </div>
              
              <div className="flex-1 min-h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataVolume} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip 
                      cursor={{fill: 'rgba(226, 232, 240, 0.4)'}}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 700, paddingTop: '20px' }} />
                    <Bar dataKey="SOLID" stackId="a" fill="#4f46e5" radius={[0, 0, 4, 4]} barSize={32} />
                    <Bar dataKey="MIX" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. RECENT INBOUNDS ACTIVITY FEED (Takes 1 Column) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
              <h2 className="text-lg font-extrabold text-slate-800 mb-6">Recent Inbounds</h2>
              
              <div className="flex flex-col gap-5 flex-1 overflow-y-auto pr-2">
                {recentActivities.map((act) => (
                  <div key={act.id} className="flex gap-4 items-start">
                    
                    {/* Timeline Node & Line */}
                    <div className="flex flex-col items-center mt-1">
                      <div className={`w-2.5 h-2.5 rounded-full ring-4 ring-offset-1 ${act.type === 'SOLID' ? 'bg-indigo-500 ring-indigo-50' : 'bg-amber-500 ring-amber-50'}`}></div>
                      <div className="w-0.5 h-full bg-slate-100 mt-2 min-h-[30px]"></div>
                    </div>
                    
                    {/* Activity Text Details */}
                    <div className="flex-1 pb-1 border-b border-slate-50 last:border-none">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-black text-slate-400">{act.time}</span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${act.type === 'SOLID' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>
                          {act.type}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 leading-snug">
                        SO <span className="text-indigo-600">{act.so}</span>
                      </p>
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        {act.ctn} Cartons • {act.inner} Inner Boxes
                      </p>
                    </div>

                  </div>
                ))}
              </div>
              
              <button className="mt-4 w-full py-2.5 bg-slate-50 text-indigo-600 font-extrabold text-xs rounded-xl border border-slate-100 hover:bg-indigo-50 transition-colors">
                View All Logs
              </button>
            </div>
            
          </div>
        </main>
      </div>
    </div>
  );
}

/* =========================================
   SUB-COMPONENTS (Helpers)
   ========================================= */

// 1. Sidebar Nav Icon Item
function SidebarIcon({ icon, active = false }) {
  return (
    <div className={`w-12 h-12 flex items-center justify-center rounded-xl cursor-pointer transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
      {icon}
    </div>
  );
}

// 2. Standard White KPI Card Generator
function KPICard({ icon, bgIcon, title, value }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4 transform transition hover:-translate-y-1 hover:shadow-md cursor-default">
      <div className={`w-12 h-12 ${bgIcon} rounded-xl flex items-center justify-center`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{title}</p>
        <h3 className="text-2xl font-black text-slate-800 leading-none">{value}</h3>
      </div>
    </div>
  );
}
