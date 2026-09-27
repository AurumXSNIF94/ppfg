import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../config/firebase';
import { Search, MapPin, Globe, X, FileText, ChevronRight, Copy, Check } from 'lucide-react';

export default function SoList() {
  const [soGroupData, setSoGroupData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedSoData, setSelectedSoData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [_, year, month, day] = isoMatch;
      const dateObj = new Date(year, month - 1, day);
      return dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const parsed = new Date(dateString);
    if (!isNaN(parsed)) {
      return parsed.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return dateString;
  };

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
            tanggal: formatDate(d.tanggal),
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
      group.destination.toUpperCase().includes(term) ||
      group.lokasi.toUpperCase().includes(term)
    );
  }).reverse();

  const handleOpenModal = (group) => {
    const sizeGroup = {};
    let grandTotalPcs = 0;

    group.items.forEach(d => {
      const sz = d.size || "-";
      const qty = parseInt(d.isi_karton) || 0;
      grandTotalPcs += qty;

      if (!sizeGroup[sz]) {
        sizeGroup[sz] = { cartons: [], totalQty: 0 };
      }
      sizeGroup[sz].cartons.push(d.nomor_karton);
      sizeGroup[sz].totalQty += qty;
    });

    setSelectedSoData({
      so: group.so,
      artikel: group.artikel,
      lokasi: group.lokasi,
      destination: group.destination,
      tanggal: group.tanggal,
      totalCtn: group.items.length,
      grandTotalPcs,
      sizeGroup
    });
    setCopied(false);
    setIsModalOpen(true);
  };

  const handleCopySummary = () => {
    if (!selectedSoData) return;
    
    let text = `📦 SALES ORDER SUMMARY\n`;
    text += `SO No.: ${selectedSoData.so}\n`;
    text += `Article: ${selectedSoData.artikel}\n`;
    text += `Destination: ${selectedSoData.destination}\n`;
    text += `Location: ${selectedSoData.lokasi}\n`;
    text += `Total: ${selectedSoData.totalCtn} Cartons (${selectedSoData.grandTotalPcs} Pcs)\n\n`;
    text += `Size Details:\n`;

    Object.keys(selectedSoData.sizeGroup).sort().forEach(sz => {
      const s = selectedSoData.sizeGroup[sz];
      text += `- Size ${sz}: ${s.cartons.length} Ctn (${s.totalQty} Pcs) | No.: ${s.cartons.join(', ')}\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full relative">
      
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-textMain">Sales Order (SO) Master List</h2>
          <p className="text-xs font-semibold text-textMuted mt-0.5">Summary of all inbound data stored in the database.</p>
        </div>
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-textMuted" />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 border border-borderLight rounded-xl text-xs font-bold bg-surface text-textMain outline-none focus:border-primary focus:ring-4 focus:ring-indigo-50 shadow-sm uppercase"
            placeholder="Search SO, Article, Destination..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
          />
        </div>
      </div>

      {/* Enterprise Data Table */}
      <div className="flex-1 bg-surface border border-borderLight rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bgBody border-b border-borderLight text-[11px] font-extrabold text-textMuted uppercase tracking-wider">
                <th className="py-4 px-6">SO No.</th>
                <th className="py-4 px-6">Date</th>
                <th className="py-4 px-6">Article / Style</th>
                <th className="py-4 px-6">Destination</th>
                <th className="py-4 px-6">Warehouse Location</th>
                <th className="py-4 px-6 text-center">Total Cartons</th>
                <th className="py-4 px-6 text-center">Total Pcs</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLight text-xs font-semibold text-textMain">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-textMuted font-bold">Loading Data from Database...</td>
                </tr>
              ) : filteredSoKeys.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-textMuted font-bold">No Sales Order data found.</td>
                </tr>
              ) : (
                filteredSoKeys.map((soKey) => {
                  const group = soGroupData[soKey];
                  const totalPcs = group.items.reduce((acc, curr) => acc + (parseInt(curr.isi_karton) || 0), 0);

                  return (
                    <tr 
                      key={soKey} 
                      onClick={() => handleOpenModal(group)}
                      className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-4 px-6 font-extrabold text-primary flex items-center gap-2">
                        <FileText size={16} className="text-primary/70 shrink-0" />
                        {group.so}
                      </td>
                      <td className="py-4 px-6 text-textMuted font-bold">{group.tanggal}</td>
                      <td className="py-4 px-6 font-extrabold">{group.artikel}</td>
                      <td className="py-4 px-6 font-bold text-slate-600">
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                          <Globe size={12} className="text-primary" /> {group.destination}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-bold text-emerald-700">
                        <span className="inline-flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                          <MapPin size={12} className="text-emerald-500" /> {group.lokasi}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-1 rounded-md border border-indigo-100">
                          {group.items.length} Ctn
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center font-extrabold text-slate-800">
                        {totalPcs.toLocaleString()} Pcs
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button className="w-8 h-8 rounded-lg bg-bgBody border border-borderLight inline-flex justify-center items-center text-textMuted group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                          <ChevronRight size={16} />
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

      {/* SO Detail Modal */}
      {isModalOpen && selectedSoData && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-surface w-full max-w-2xl rounded-2xl p-6 shadow-2xl border border-borderLight animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-borderLight mb-5">
              <div>
                <span className="text-[10px] font-extrabold bg-indigo-50 text-primary px-2 py-0.5 rounded uppercase">Sales Order Detail</span>
                <h3 className="text-xl font-black text-textMain mt-1">{selectedSoData.so}</h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-bgBody border border-borderLight flex justify-center items-center text-textMain hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Information Summary Box */}
            <div className="bg-bgBody p-4 rounded-xl border border-borderLight mb-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-[10px] font-bold text-textMuted uppercase">Article</div>
                <div className="text-xs font-extrabold text-textMain mt-0.5 truncate">{selectedSoData.artikel}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-textMuted uppercase">Warehouse Location</div>
                <div className="text-xs font-extrabold text-emerald-600 mt-0.5">📍 {selectedSoData.lokasi}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-textMuted uppercase">Destination</div>
                <div className="text-xs font-extrabold text-primary mt-0.5">🌍 {selectedSoData.destination}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-textMuted uppercase">Total Quantity</div>
                <div className="text-xs font-extrabold text-slate-800 mt-0.5">{selectedSoData.totalCtn} Ctn ({selectedSoData.grandTotalPcs} Pcs)</div>
              </div>
            </div>

            {/* Mini Table Size Details */}
            <div className="text-xs font-extrabold text-textMain mb-2">Size & Carton Number Details:</div>
            <div className="flex-1 overflow-y-auto border border-borderLight rounded-xl mb-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bgBody border-b border-borderLight text-[10px] font-extrabold text-textMuted uppercase">
                    <th className="py-2.5 px-4">Size</th>
                    <th className="py-2.5 px-4 text-center">Ctn Qty</th>
                    <th className="py-2.5 px-4 text-center">Total Pcs</th>
                    <th className="py-2.5 px-4">Carton Numbers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLight text-xs font-semibold">
                  {Object.keys(selectedSoData.sizeGroup).sort().map((sz, idx) => {
                    const s = selectedSoData.sizeGroup[sz];
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-extrabold text-primary">{sz}</td>
                        <td className="py-3 px-4 text-center font-bold">{s.cartons.length} Ctn</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">{s.totalQty} Pcs</td>
                        <td className="py-3 px-4 text-textMuted font-medium text-[11px] leading-relaxed">
                          {s.cartons.join(', ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer with Quick Actions */}
            <div className="flex justify-between items-center pt-2">
              <button 
                onClick={handleCopySummary}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-bgBody border border-borderLight rounded-xl text-xs font-bold text-textMain hover:bg-slate-100 transition-colors"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} className="text-textMuted" />}
                {copied ? 'Copied Successfully!' : 'Copy SO Summary'}
              </button>

              <button 
                onClick={() => setIsModalOpen(false)}
                className="btn-primary py-2.5 px-6 text-xs"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
