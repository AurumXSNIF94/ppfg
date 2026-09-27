import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../config/firebase';
import { Search, History, Globe, MapPin, Calendar, CheckCircle2 } from 'lucide-react';

export default function ExportHistory() {
  const [historyList, setHistoryList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const historyRef = ref(db, 'export_history');
    const unsubscribe = onValue(historyRef, (snapshot) => {
      const list = [];
      snapshot.forEach((child) => {
        list.push({ id: child.key, ...child.val() });
      });
      setHistoryList(list.reverse());
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredHistory = historyList.filter(item => {
    const term = searchTerm.toUpperCase().trim();
    if (!term) return true;
    return (
      (item.so_number || "").toUpperCase().includes(term) ||
      (item.artikel || "").toUpperCase().includes(term) ||
      (item.destination || "").toUpperCase().includes(term) ||
      (item.export_date || "").includes(term)
    );
  });

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-textMain">Export & Outbound History</h2>
          <p className="text-xs font-semibold text-textMuted mt-0.5">Archive of all completed cargo shipments sent to buyers.</p>
        </div>
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-textMuted" />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 border border-borderLight rounded-xl text-xs font-bold bg-surface text-textMain outline-none focus:border-primary uppercase shadow-sm"
            placeholder="Search SO, Article, Destination..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 bg-surface border border-borderLight rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bgBody border-b border-borderLight text-[11px] font-extrabold text-textMuted uppercase tracking-wider">
                <th className="py-4 px-6">Export Date</th>
                <th className="py-4 px-6">SO Number</th>
                <th className="py-4 px-6">Article</th>
                <th className="py-4 px-6">Destination (Buyer)</th>
                <th className="py-4 px-6">Location</th>
                <th className="py-4 px-6 text-center">Shipped Cartons</th>
                <th className="py-4 px-6 text-center">Shipped Qty (Pcs)</th>
                <th className="py-4 px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLight text-xs font-semibold text-textMain">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-textMuted font-bold">Loading Export History...</td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-textMuted font-bold">No export history records found.</td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-indigo-50/40 transition-colors">
                    <td className="py-4 px-6 font-bold text-textMuted flex items-center gap-1.5">
                      <Calendar size={14} className="text-primary" /> {item.export_date}
                    </td>
                    <td className="py-4 px-6 font-extrabold text-primary">{item.so_number}</td>
                    <td className="py-4 px-6 font-extrabold">{item.artikel}</td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 font-bold">
                        <Globe size={11} className="text-primary" /> {item.destination}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-bold text-emerald-700">
                      <span className="inline-flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                        <MapPin size={11} className="text-emerald-500" /> {item.lokasi}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center font-extrabold text-indigo-600">
                      {item.total_cartons} Ctn
                    </td>
                    <td className="py-4 px-6 text-center font-black text-slate-900">
                      {item.total_pcs?.toLocaleString()} Pcs
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold">
                        <CheckCircle2 size={12} /> Shipped / Exported
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
