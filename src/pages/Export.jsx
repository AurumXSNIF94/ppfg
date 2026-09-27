import { useState, useEffect } from 'react';
import { ref, onValue, remove } from 'firebase/database';
import { db } from '../config/firebase';
import { Search, Download, FileText } from 'lucide-react';

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

  // Handle Export CSV & Outbound Process
  const handleExportCSV = async (group) => {
    if (window.confirm(`Export CSV and execute Outbound for SO: ${group.so}? This will clear the items from active warehouse stock.`)) {
      try {
        let csvContent = "data:text/csv;charset=utf-8,SO,Article,Destination,Location,Size,CartonNo,Qty\n";
        group.items.forEach(item => {
          csvContent += `"${group.so}","${group.artikel}","${group.destination}","${group.lokasi}","${item.size}","${item.nomor_karton}",${item.isi_karton}\n`;
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Outbound_SO_${group.so}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Remove from active database upon successful outbound export
        const deletePromises = group.items.map(item => remove(ref(db, `stok_inbound_wh/${item.id}`)));
        await Promise.all(deletePromises);

        alert(`Successfully exported and processed outbound for SO: ${group.so}`);
      } catch (err) {
        alert("Failed to export: " + err.message);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full relative">
      
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-textMain">Export & Outbound Operations</h2>
          <p className="text-xs font-semibold text-textMuted mt-0.5">Download CSV reports and process outbound shipments per Sales Order.</p>
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

      {/* Export Table */}
      <div className="flex-1 bg-surface border border-borderLight rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bgBody border-b border-borderLight text-[11px] font-extrabold text-textMuted uppercase tracking-wider">
                <th className="py-4 px-6">SO Number</th>
                <th className="py-4 px-6">Article</th>
                <th className="py-4 px-6">Destination</th>
                <th className="py-4 px-6">Location</th>
                <th className="py-4 px-6 text-center">Total Cartons</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLight text-xs font-semibold text-textMain">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-textMuted font-bold">Loading Export Data...</td>
                </tr>
              ) : filteredSoKeys.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-textMuted font-bold">No outbound records available.</td>
                </tr>
              ) : (
                filteredSoKeys.map((soKey) => {
                  const group = soGroupData[soKey];

                  return (
                    <tr key={soKey} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="py-4 px-6 font-extrabold text-primary flex items-center gap-2">
                        <FileText size={16} className="text-primary/70 shrink-0" />
                        {group.so}
                      </td>
                      <td className="py-4 px-6 font-extrabold">{group.artikel}</td>
                      <td className="py-4 px-6 font-bold text-slate-600">{group.destination}</td>
                      <td className="py-4 px-6 font-bold text-emerald-700">{group.lokasi}</td>
                      <td className="py-4 px-6 text-center font-extrabold text-indigo-600">
                        {group.items.length} Cartons
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button 
                          onClick={() => handleExportCSV(group)}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center gap-2"
                        >
                          <Download size={14} /> Export CSV & Outbound
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
