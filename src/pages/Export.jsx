import { useState, useEffect } from 'react';
import { ref, onValue, remove, push, set } from 'firebase/database';
import { db } from '../config/firebase';
import { Search, Send, FileText, Globe, MapPin } from 'lucide-react';

export default function ExportPage() {
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

  // Proses Ekspor: Simpan ke History & Hapus dari Stok Aktif
  const handleExecuteExportToBuyer = async (group) => {
    const totalPcs = group.items.reduce((acc, curr) => acc + (parseInt(curr.isi_karton) || 0), 0);
    
    if (window.confirm(`Execute Export/Outbound shipment for SO: ${group.so} to Buyer (${group.destination})? This will ship out ${group.items.length} cartons (${totalPcs} Pcs) and save to export history.`)) {
      try {
        const exportDate = new Date().toISOString().split('T')[0];

        // 1. Catat ke History Transaksi Ekspor
        await push(ref(db, 'export_history'), {
          so_number: group.so,
          artikel: group.artikel,
          destination: group.destination,
          lokasi: group.lokasi,
          total_cartons: group.items.length,
          total_pcs: totalPcs,
          export_date: exportDate,
          items: group.items
        });

        // 2. Hapus dari stok inbound aktif
        const deletePromises = group.items.map(item => remove(ref(db, `stok_inbound_wh/${item.id}`)));
        await Promise.all(deletePromises);

        alert(`Successfully exported SO: ${group.so}! Transaction recorded in Export History.`);
      } catch (err) {
        alert("Failed to process export: " + err.message);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-textMain">Buyer Export & Outbound Shipping</h2>
          <p className="text-xs font-semibold text-textMuted mt-0.5">Process cargo shipments to buyers. Records will be safely archived in Export History.</p>
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
                <th className="py-4 px-6">SO Number</th>
                <th className="py-4 px-6">Article</th>
                <th className="py-4 px-6">Destination (Buyer)</th>
                <th className="py-4 px-6">Warehouse Location</th>
                <th className="py-4 px-6 text-center">Total Cartons</th>
                <th className="py-4 px-6 text-center">Total Qty (Pcs)</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLight text-xs font-semibold text-textMain">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-textMuted font-bold">Loading Export Data...</td>
                </tr>
              ) : filteredSoKeys.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-textMuted font-bold">No active shipments available for export.</td>
                </tr>
              ) : (
                filteredSoKeys.map((soKey) => {
                  const group = soGroupData[soKey];
                  const totalPcs = group.items.reduce((acc, curr) => acc + (parseInt(curr.isi_karton) || 0), 0);

                  return (
                    <tr key={soKey} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="py-4 px-6 font-extrabold text-primary flex items-center gap-2">
                        <FileText size={16} className="text-primary/70 shrink-0" />
                        {group.so}
                      </td>
                      <td className="py-4 px-6 font-extrabold">{group.artikel}</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 font-bold">
                          <Globe size={12} className="text-primary" /> {group.destination}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-bold text-emerald-700">
                        <span className="inline-flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                          <MapPin size={12} className="text-emerald-500" /> {group.lokasi}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center font-extrabold text-indigo-600">
                        {group.items.length} Ctn
                      </td>
                      <td className="py-4 px-6 text-center font-black text-slate-900">
                        {totalPcs.toLocaleString()} Pcs
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button 
                          onClick={() => handleExecuteExportToBuyer(group)}
                          className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center gap-2"
                        >
                          <Send size={14} /> Ship to Buyer (Export)
                        </button>
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
