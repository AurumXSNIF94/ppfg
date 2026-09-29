// src/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from './firebase';
import { Menu, X, LayoutDashboard, Package, FileText, Settings, Bell, Search, Box } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [inboundData, setInboundData] = useState([]);
  const [summary, setSummary] = useState({ totalSO: 0, totalKarton: 0, totalQty: 0 });
  const [loading, setLoading] = useState(true);

  // SEDOT DATA FIREBASE SECARA REAL-TIME
  useEffect(() => {
    const dbRef = ref(database, 'stok_inbound_wh');
    
    const unsubscribe = onValue(dbRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let tempTotalKarton = 0;
        let tempTotalQty = 0;
        const chartData = [];

        // Looping data Firebase lo yang strukturnya: SO_... -> informasi_master & karton
        Object.keys(data).forEach((soKey) => {
          const soData = data[soKey];
          const info = soData.informasi_master || {};
          const kartons = soData.karton || {};
          
          let soKartonCount = 0;
          let soQtyCount = 0;

          // Hitung qty dan jumlah karton per SO
          Object.values(kartons).forEach((k) => {
            soKartonCount += 1;
            soQtyCount += Number(k.isi_karton) || 0;
          });

          tempTotalKarton += soKartonCount;
          tempTotalQty += soQtyCount;

          chartData.push({
            soName: soKey.replace('SO_', ''),
            artikel: info.artikel || '-',
            whCust: info.wh_cust || '-',
            qty: soQtyCount,
            karton: soKartonCount,
            lastUpdate: info.terakhir_update ? new Date(info.terakhir_update).toLocaleString('id-ID') : '-'
          });
        });

        setSummary({
          totalSO: Object.keys(data).length,
          totalKarton: tempTotalKarton,
          totalQty: tempTotalQty
        });
        
        setInboundData(chartData);
      } else {
        setInboundData([]);
        setSummary({ totalSO: 0, totalKarton: 0, totalQty: 0 });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* ========================================== */}
      {/* SIDEBAR (Responsive) */}
      {/* ========================================== */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out 
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 flex flex-col shadow-xl`}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white">
              <Box size={24} />
            </div>
            <span className="text-xl font-bold text-white tracking-wide">WMS<span className="text-blue-500">PRO</span></span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden">
            <X className="w-6 h-6 hover:text-white" />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <a href="#" className="flex items-center gap-3 p-3 bg-blue-600/10 text-blue-500 rounded-xl font-medium border border-blue-600/20">
            <LayoutDashboard size={20} /> Dashboard
          </a>
          <a href="#" className="flex items-center gap-3 p-3 hover:bg-slate-800 rounded-xl transition-colors hover:text-white">
            <Package size={20} /> Data Inbound
          </a>
          <a href="#" className="flex items-center gap-3 p-3 hover:bg-slate-800 rounded-xl transition-colors hover:text-white">
            <FileText size={20} /> Master Data
          </a>
        </nav>
      </aside>

      {/* OVERLAY UNTUK MOBILE */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* ========================================== */}
      {/* MAIN CONTENT AREA */}
      {/* ========================================== */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* HEADER */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition">
              <Menu size={24} />
            </button>
            <div className="hidden md:flex items-center bg-slate-100 rounded-lg px-4 py-2 border border-slate-200">
              <Search size={18} className="text-slate-400 mr-2" />
              <input type="text" placeholder="Cari SO atau Artikel..." className="bg-transparent border-none focus:outline-none text-sm w-64 text-slate-700" />
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="relative cursor-pointer">
              <Bell size={22} className="text-slate-500 hover:text-slate-800" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold shadow-md cursor-pointer border-2 border-white">
              MI
            </div>
          </div>
        </header>

        {/* CONTENT SCROLLABLE */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Overview Inbound</h1>
              <p className="text-slate-500 text-sm mt-1">Pantau stok barang masuk secara real-time dari Gudang.</p>
            </div>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-500">Memuat data dari Firebase...</div>
          ) : (
            <>
              {/* KARTU METRIK */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex items-center gap-5">
                  <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><FileText size={28} /></div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Total SO Aktif</p>
                    <p className="text-3xl font-bold text-slate-800">{summary.totalSO}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex items-center gap-5">
                  <div className="p-4 bg-amber-50 text-amber-600 rounded-xl"><Package size={28} /></div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Total Karton</p>
                    <p className="text-3xl font-bold text-slate-800">{summary.totalKarton.toLocaleString('id-ID')}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex items-center gap-5">
                  <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl"><LayoutDashboard size={28} /></div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Total Qty (Pcs)</p>
                    <p className="text-3xl font-bold text-slate-800">{summary.totalQty.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              </div>

              {/* GRAFIK & TABEL */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* GRAFIK */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
                  <h2 className="text-lg font-bold text-slate-800 mb-6">Grafik Volume per SO</h2>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={inboundData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="soName" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                        <Tooltip cursor={{fill: '#F1F5F9'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}}/>
                        <Bar dataKey="qty" name="Total Qty" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={32} />
                        <Bar dataKey="karton" name="Total Karton" fill="#F59E0B" radius={[6, 6, 0, 0]} barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* TABEL REAL-TIME */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col">
                  <h2 className="text-lg font-bold text-slate-800 mb-4">Rincian SO Terbaru</h2>
                  <div className="flex-1 overflow-auto pr-2">
                    <div className="space-y-4">
                      {inboundData.map((so, index) => (
                        <div key={index} className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-md">SO {so.soName}</span>
                              <p className="text-sm font-semibold text-slate-800 mt-2">{so.artikel}</p>
                            </div>
                            <span className="text-xs text-slate-500">{so.whCust}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-2 mt-2">
                            <span className="text-slate-600">📦 {so.karton} Karton</span>
                            <span className="font-bold text-slate-800">{so.qty.toLocaleString('id-ID')} Pcs</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
