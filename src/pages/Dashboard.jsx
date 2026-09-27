import { useState, useEffect, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../config/firebase';
import { Package, FileText, Hash, MapPin, ClipboardCheck, X } from 'lucide-react';
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
  const [stats, setStats] = useState({ totalCtn: 0, uniqueSo: 0, totalQty: 0, uniqueLoc: 0, planningCount: 0, completedCount: 0 });
  const [recentList, setRecentList] = useState([]);
  const [chartData, setChartData] = useState({ labels: [], data: [] });
  const [rawDataStorage, setRawDataStorage] = useState([]);
  
  const [selectedSoData, setSelectedSoData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const chartRef = useRef(null);

  useEffect(() => {
    const kartonRef = ref(db, 'stok_inbound_wh');
    const planningRef = ref(db, 'so_planning');
    
    let inboundSnapshotData = [];
    let planningSnapshotData = [];

    const updateDashboardMetrics = () => {
      let totalQty = 0;
      const uniqueSoSet = new Set();
      const uniqueLocSet = new Set();
      const destMap = {};
      const soGroup = {};
      const inboundMap = {};
      const rawList = [];

      inboundSnapshotData.forEach((child) => {
        const data = child.val();
        data.id = child.key;
        rawList.push(data);

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

        const soKey = so.toUpperCase().trim();
        if (!inboundMap[soKey]) inboundMap[soKey] = 0;
        inboundMap[soKey] += parseInt(data.isi_karton) || 0;
      });

      let completedPlans = 0;
      let totalPlans = planningSnapshotData.length;

      planningSnapshotData.forEach((plan) => {
        const p = plan.val();
        const soKey = (p.so_number || "").toUpperCase().trim();
        const actual = inboundMap[soKey] || 0;
        if (actual >= (p.target_qty || 0)) {
          completedPlans++;
        }
      });

      setRawDataStorage(rawList);
      setStats({
        totalCtn: rawList.length,
        uniqueSo: uniqueSoSet.size,
        totalQty: totalQty,
        uniqueLoc: uniqueLocSet.size,
        planningCount: totalPlans,
        completedCount: completedPlans
      });

      const sortedDest = Object.entries(destMap).sort((a, b) => b[1] - a[1]);
      setChartData({
        labels: sortedDest.map(i => i[0]),
        data: sortedDest.map(i => i[1])
      });

      const recentKeys = Object.keys(soGroup).slice(-6).reverse();
      setRecentList(recentKeys.map(key => soGroup[key]));
    };

    const unsubInbound = onValue(kartonRef, (snapshot) => {
      inboundSnapshotData = [];
      snapshot.forEach((child) => inboundSnapshotData.push(child));
      updateDashboardMetrics();
    });

    const unsubPlanning = onValue(planningRef, (snapshot) => {
      planningSnapshotData = [];
      snapshot.forEach((child) => planningSnapshotData.push(child));
      updateDashboardMetrics();
    });

    return () => {
      unsubInbound();
      unsubPlanning();
    };
  }, []);

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
      y: { beginAtZero: true, grid: { color: '#E2E8F0', drawBorder: false }, ticks: { color: '#64748B' } },
      x: { grid: { display: false }, ticks: { color: '#64748B', font: { weight: '700' } } }
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
        fill: true,
        tension: 0.4
      }
    ]
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 relative">
      
      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
        <div className="bg-primary text-white p-5 rounded-2xl shadow-[0_10px_20px_rgba(79,70,229,0.2)] flex items-center gap-4">
          <div className="w-11 h-11 bg-white/20 rounded-xl flex justify-center items-center shrink-0">
            <Package size={22} className="text-white" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-white/80 uppercase tracking-wider mb-0.5">Total Cartons</div>
            <div className="text-2xl font-extrabold">{stats.totalCtn.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-surface border border-borderLight p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 bg-emerald-100 rounded-xl flex justify-center items-center shrink-0">
            <FileText size={22} className="text-emerald-600" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-textMuted uppercase tracking-wider mb-0.5">Unique SO</div>
            <div className="text-2xl font-extrabold text-textMain">{stats.uniqueSo.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-surface border border-borderLight p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 bg-amber-100 rounded-xl flex justify-center items-center shrink-0">
            <Hash size={22} className="text-amber-600" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-textMuted uppercase tracking-wider mb-0.5">Total Qty (Pcs)</div>
            <div className="text-2xl font-extrabold text-textMain">{stats.totalQty.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-surface border border-borderLight p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 bg-rose-100 rounded-xl flex justify-center items-center shrink-0">
            <MapPin size={22} className="text-rose-600" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-textMuted uppercase tracking-wider mb-0.5">Active Locations</div>
            <div className="text-2xl font-extrabold text-textMain">{stats.uniqueLoc.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-surface border border-borderLight p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 bg-indigo-100 rounded-xl flex justify-center items-center shrink-0">
            <ClipboardCheck size={22} className="text-primary" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-textMuted uppercase tracking-wider mb-0.5">Plans Fulfilled</div>
            <div className="text-2xl font-extrabold text-primary">{stats.completedCount} / {stats.planningCount}</div>
          </div>
        </div>
      </div>

      {/* CHARTS & RECENT LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface border border-borderLight p-6 rounded-2xl shadow-sm flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-extrabold text-textMain">Inbound Quantity Trend</h2>
            <span className="text-xs font-bold text-textMuted bg-bgBody px-3 py-1.5 rounded-lg border border-borderLight">By Destination</span>
          </div>
          <div className="flex-1 relative w-full">
            {chartData.labels.length > 0 ? (
              <Line ref={chartRef} data={chartConfig} options={chartOptions} />
            ) : (
              <div className="flex h-full justify-center items-center text-textMuted font-semibold">Loading Chart Data...</div>
            )}
          </div>
        </div>

        <div className="bg-surface border border-borderLight p-6 rounded-2xl shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-extrabold text-textMain">Recent Inbounds</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[350px]">
            {recentList.length === 0 ? (
              <p className="text-sm font-semibold text-textMuted text-center mt-10">No inbound records yet.</p>
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
          <div className="bg-surface w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-borderLight">
            <div className="flex justify-between items-center pb-4 border-b border-borderLight mb-4">
              <h3 className="text-lg font-extrabold text-primary">Sales Order Details: {selectedSoData.so}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-bgBody flex items-center justify-center">
                <X size={18} />
              </button>
            </div>
            <div className="bg-bgBody p-4 rounded-xl border border-borderLight mb-5 flex justify-between items-center">
              <div>
                <div className="text-[10px] font-bold text-textMuted uppercase">Article</div>
                <div className="text-sm font-extrabold text-textMain">{selectedSoData.artikel}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-textMuted uppercase">Location / Destination</div>
                <div className="text-sm font-extrabold text-primary">📍 {selectedSoData.lokasi} | 🌍 {selectedSoData.destination}</div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
