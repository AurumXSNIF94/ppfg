import { useState, useEffect, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../config/firebase';
import { Package, FileText, Hash, MapPin, X } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

export default function Dashboard() {
  const [stats, setStats] = useState({ totalCtn: 0, uniqueSo: 0, totalQty: 0, uniqueLoc: 0 });
  const [recentList, setRecentList] = useState([]);
  const [chartData, setChartData] = useState({ labels: [], data: [] });
  const [rawDataStorage, setRawDataStorage] = useState([]); // Menyimpan data mentah untuk modal
  
  // Modal State
  const [selectedSoData, setSelectedSoData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const chartRef = useRef(null);

  useEffect(() => {
    const kartonRef = ref(db, 'stok_inbound_wh');
    
    const unsubscribe = onValue(kartonRef, (snapshot) => {
      const rawData = [];
      let totalQty = 0;
      const uniqueSoSet = new Set();
      const uniqueLocSet = new Set();
      const destMap = {};
      const soGroup = {};

      snapshot.forEach((child) => {
        const data = child.val();
        data.id = child.key;
        rawData.push(data);

        totalQty += parseInt(data.isi_karton) || 0;
        if (data.so_number) uniqueSoSet.add(data.so_number);
        if (data.lokasi) uniqueLocSet.add(data.lokasi);

        const dest = (data.destination || "Other").toUpperCase();
        if (!destMap[dest]) destMap[dest] = 0;
        destMap[dest] += parseInt(data.isi_karton) || 0;

        const so = data.so_number || "UNKNOWN";
        if (!soGroup[so]) {
          soGroup[so] = { so, artikel: data.artikel, dest: data.destination, date: data.tanggal, items: [] };
        }
        soGroup[so].items.push(data);
      });

      setRawDataStorage(rawData); // Simpan state mentah
      setStats({
        totalCtn: rawData.length,
        uniqueSo: uniqueSoSet.size,
        totalQty: totalQty,
        uniqueLoc: uniqueLocSet.size
      });

      const sortedDest = Object.entries(destMap).sort((a, b) => b[1] - a[1]);
      setChartData({
        labels: sortedDest.map(i => i[0]),
        data: sortedDest.map(i => i[1])
      });

      const recentKeys = Object.keys(soGroup).slice(-6).reverse();
      const recentData = recentKeys.map(key => soGroup[key]);
      setRecentList(recentData);
    });

    return () => unsubscribe();
  }, []);

  // Fungsi saat SO diklik
  const handleOpenModal = (soNumber) => {
    const items = rawDataStorage.filter(d => d.so_number === soNumber);
    if (items.length === 0) return;

    const first = items[0];
    const sizeGroup = {};

    items.forEach(d => {
      const sz = d.size || "-";
      if (!sizeGroup[sz]) {
        sizeGroup[sz] = { cartons: [], totalQty: 0 };
      }
      sizeGroup[sz].cartons.push(d.nomor_karton);
      sizeGroup[sz].totalQty += (parseInt(d.isi_karton) || 0);
    });

    setSelectedSoData({
      so: soNumber,
      artikel: first.artikel,
      lokasi: first.lokasi || '-',
      destination: first.destination || '-',
      totalCtn: items.length,
      sizeGroup
    });
    setIsModalOpen(true);
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E293B',
        padding: 12,
        titleFont: { family: 'Plus Jakarta Sans', size: 13 },
        bodyFont: { family: 'Plus Jakarta Sans', weight: 'bold', size: 14 },
        cornerRadius: 8,
        displayColors: false,
      }
    },
    scales: {
      y: { 
        beginAtZero: true, 
        grid: { color: '#E2E8F0', drawBorder: false }, 
        ticks: { color: '#64748B', font: { family: 'Plus Jakarta Sans', weight: '600' } } 
      },
      x: { 
        grid: { display: false }, 
        ticks: { color: '#64748B', font: { family: 'Plus Jakarta Sans', weight: '700' } } 
      }
    }
  };

  const chartConfig = {
    labels: chartData.labels,
    datasets: [
      {
        label: 'Total Pcs',
        data: chartData.data,
        borderColor: '#4F46E5',
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(79, 70, 229, 0.4)');
          gradient.addColorStop(1, 'rgba(79, 70, 229, 0.0)');
          return gradient;
        },
        borderWidth: 3,
        pointBackgroundColor: '#FFFFFF',
        pointBorderColor: '#4F46E5',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.4
      }
    ]
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 relative">
      
      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-primary text-white p-6 rounded-2xl shadow-[0_10px_20px_rgba(79,70,229,0.2)] flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex justify-center items-center shrink-0">
            <Package size={24} className="text-white" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white/80 uppercase tracking-wider mb-1">Total Karton</div>
            <div className="text-3xl font-extrabold">{stats.totalCtn.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-surface border border-borderLight p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex justify-center items-center shrink-0">
            <FileText size={24} className="text-emerald-600" />
          </div>
          <div>
            <div className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-1">Unique SO</div>
            <div className="text-3xl font-extrabold text-textMain">{stats.uniqueSo.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-surface border border-borderLight p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex justify-center items-center shrink-0">
            <Hash size={24} className="text-amber-600" />
          </div>
          <div>
            <div className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-1">Total Qty (Pcs)</div>
            <div className="text-3xl font-extrabold text-textMain">{stats.totalQty.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-surface border border-borderLight p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-100 rounded-xl flex justify-center items-center shrink-0">
            <MapPin size={24} className="text-rose-600" />
          </div>
          <div>
            <div className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-1">Lokasi Aktif</div>
            <div className="text-3xl font-extrabold text-textMain">{stats.uniqueLoc.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* CHARTS & RECENT LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CHART PANEL */}
        <div className="lg:col-span-2 bg-surface border border-borderLight p-6 rounded-2xl shadow-sm flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-extrabold text-textMain">Tren Kuantitas Inbound</h2>
            <span className="text-xs font-bold text-textMuted bg-bgBody px-3 py-1.5 rounded-lg border border-borderLight">Berdasarkan Destinasi</span>
          </div>
          <div className="flex-1 relative w-full">
            {chartData.labels.length > 0 ? (
              <Line ref={chartRef} data={chartConfig} options={chartOptions} />
            ) : (
              <div className="flex h-full justify-center items-center text-textMuted font-semibold">Memuat Data Grafik...</div>
            )}
          </div>
        </div>

        {/* RECENT INBOUNDS PANEL */}
        <div className="bg-surface border border-borderLight p-6 rounded-2xl shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-extrabold text-textMain">Recent Inbounds</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[350px]">
            {recentList.length === 0 ? (
              <p className="text-sm font-semibold text-textMuted text-center mt-10">Belum ada data masuk.</p>
            ) : (
              recentList.map((item, idx) => (
                <div 
                  key={idx} 
                  onClick={() => handleOpenModal(item.so)}
                  className="flex justify-between items-center p-3 bg-bgBody border border-borderLight rounded-xl hover:border-primary hover:bg-surface transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 text-primary flex justify-center items-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                      <Package size={18} />
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-textMain">{item.so}</div>
                      <div className="text-xs font-semibold text-textMuted mt-0.5">{item.artikel}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-textMuted">{item.date}</div>
                    <div className="text-[10px] font-extrabold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md mt-1 inline-block">
                      {item.items.length} Ctn
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* MODAL DETAIL SO */}
      {isModalOpen && selectedSoData && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-borderLight animate-in fade-in zoom-in duration-200">
            
            {/* Header Modal */}
            <div className="flex justify-between items-center pb-4 border-b border-borderLight mb-4">
              <h3 className="text-lg font-extrabold text-primary">Data Sales Order: {selectedSoData.so}</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-bgBody border border-borderLight flex justify-center items-center text-textMain hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Info Singkat */}
            <div className="bg-bgBody p-4 rounded-xl border border-borderLight mb-5 flex justify-between items-center">
              <div>
                <div className="text-[10px] font-bold text-textMuted uppercase">Artikel</div>
                <div className="text-sm font-extrabold text-textMain">{selectedSoData.artikel}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-textMuted uppercase">Lokasi / Destinasi</div>
                <div className="text-sm font-extrabold text-primary">📍 {selectedSoData.lokasi} | 🌍 {selectedSoData.destination}</div>
              </div>
            </div>

            {/* Rincian Ukuran & Karton */}
            <div className="text-xs font-extrabold text-textMain mb-3">Rincian Ukuran ({selectedSoData.totalCtn} Karton):</div>
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
              {Object.keys(selectedSoData.sizeGroup).sort().map((sz, idx) => {
                const sData = selectedSoData.sizeGroup[sz];
                return (
                  <div key={idx} className="border border-borderLight p-3 rounded-xl bg-surface">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-extrabold text-sm text-primary">Size: {sz}</span>
                      <span className="text-[11px] font-bold bg-bgBody px-2.5 py-1 rounded-md border border-borderLight">
                        {sData.cartons.length} Ctn | {sData.totalQty} Pcs
                      </span>
                    </div>
                    <div className="text-xs text-textMuted font-semibold">
                      <span className="font-bold text-textMain">Karton: </span> {sData.cartons.join(', ')}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
