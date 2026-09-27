import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../config/firebase';
import { Search, FileText } from 'lucide-react';

export default function Planning() {
  const [soGroupData, setSoGroupData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const kartonRef = ref(db, 'stok_inbound_wh');
    const unsubscribe = onValue(kartonRef, (snapshot) => {
      const soMap = {};
      
      snapshot.forEach((child) => {
        const d = { id: child.key, ...child.val() };
        const so = d.so_number || "UNKNOWN";

        if (!soMap[so]) {
          soMap[so] = {
            so: so,
            artikel: d.artikel || "-",
            destination: d.destination || "-",
            lokasi: d.lokasi || "-",
            items: []
          };
        }
        soMap[so].items.push(d);
      });

      setSoGroupData(soMap);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredSoKeys = Object.keys(soGroupData).filter(soKey => {
    const group = soGroupData[soKey];
    const term = searchTerm.toUpperCase().trim();
    if (!term) return true;
    return (
      soKey.includes(term) ||
      group.artikel.toUpperCase().includes(term) ||
      group.destination.toUpperCase().includes(term)
    );
  }).reverse();

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full relative">
      
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-textMain">SO Planning Overview</h2>
          <p className="text-xs font-semibold text-textMuted mt-0.5">Monitor total cartons, size breakdown, and quantity planning per Sales Order.</p>
        </div>
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-textMuted" />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 border border-borderLight rounded-xl text-xs font-bold bg-surface text-textMain outline-none focus:border-primary focus:ring-4 focus:ring-indigo-50 shadow-sm uppercase"
            placeholder="Search SO or Article..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Planning Table */}
      <div className="flex-1 bg-surface border border-borderLight rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bgBody border-b border-borderLight text-[11px] font-extrabold text-textMuted uppercase tracking-wider">
                <th className="py-4 px-6">SO Number</th>
                <th className="py-4 px-6">Article</th>
                <th className="py-4 px-6">Destination</th>
                <th className="py-4 px-6">Location</th>
                <th className="py-4 px-6 text-center">Size Breakdown (Ctn / Pcs)</th>
                <th className="py-4 px-6 text-center">Total Cartons</th>
                <th className="py-4 px-6 text-center">Total Qty (Pcs)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLight text-xs font-semibold text-textMain">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-textMuted font-bold">Loading Planning Data...</td>
                </tr>
              ) : filteredSoKeys.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-textMuted font-bold">No planning records found.</td>
                </tr>
              ) : (
                filteredSoKeys.map((soKey) => {
                  const group = soGroupData[soKey];
                  
                  const sizeSummary = {};
                  let totalPcs = 0;
                  group.items.forEach(item => {
                    const sz = item.size || "-";
                    const qty = parseInt(item.isi_karton) || 0;
                    totalPcs += qty;
                    if (!sizeSummary[sz]) sizeSummary[sz] = { ctn: 0, pcs: 0 };
                    sizeSummary[sz].ctn += 1;
                    sizeSummary[sz].pcs += qty;
                  });

                  return (
                    <tr key={soKey} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="py-4 px-6 font-extrabold text-primary flex items-center gap-2">
                        <FileText size={16} className="text-primary/70 shrink-0" />
                        {group.so}
                      </td>
                      <td className="py-4 px-6 font-extrabold">{group.artikel}</td>
                      <td className="py-4 px-6 font-bold text-slate-600">{group.destination}</td>
                      <td className="py-4 px-6 font-bold text-emerald-700">{group.lokasi}</td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {Object.keys(sizeSummary).sort().map(sz => (
                            <span key={sz} className="bg-bgBody border border-borderLight px-2 py-0.5 rounded text-[10px] font-bold">
                              {sz}: {sizeSummary[sz].ctn} Ctn ({sizeSummary[sz].pcs}p)
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center font-extrabold text-indigo-600">
                        {group.items.length} Ctn
                      </td>
                      <td className="py-4 px-6 text-center font-black text-slate-900">
                        {totalPcs.toLocaleString()} Pcs
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
