import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../config/firebase';
import { Search, MapPin, Globe, X, FileText } from 'lucide-react';

export default function SoList() {
  const [soGroupData, setSoGroupData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State untuk Detail SO
  const [selectedSoData, setSelectedSoData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
            tanggal: d.tanggal || "-",
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

  // Filter Daftar SO Berdasarkan Input Pencarian
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

  // Fungsi untuk membuka Modal Detail SO
  const handleOpenModal = (group) => {
    const sizeGroup = {};
    group.items.forEach(d => {
      const sz = d.size || "-";
      if (!sizeGroup[sz]) {
        sizeGroup[sz] = { cartons: [], totalQty: 0 };
      }
      sizeGroup[sz].cartons.push(d.nomor_karton);
      sizeGroup[sz].totalQty += (parseInt(d.isi_karton) || 0);
    });

    setSelectedSoData({
      so: group.so,
      artikel: group.artikel,
      lokasi: group.lokasi,
      destination: group.destination,
      totalCtn: group.items.length,
      sizeGroup
    });
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full relative">
      
      {/* Kotak Pencarian Master SO */}
      <div className="sticky top-0 z-10 bg-bgBody/85 backdrop-blur-md pb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-textMuted" />
          </div>
          <input
            type="text"
            className="w-full pl-12 pr-4 py-4 border border-borderLight rounded-xl text-sm font-bold bg-surface text-textMain outline-none transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-indigo-50 shadow-sm uppercase"
            placeholder="Cari berdasarkan Nomor SO, Artikel, Destinasi, atau Lokasi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
          />
        </div>
      </div>

      {/* Grid Daftar Master SO */}
      <div className="flex-1 overflow-y-auto pb-10">
        {loading ? (
          <div className="text-center mt-20 text-textMuted font-bold">Memuat Daftar SO dari Database...</div>
        ) : filteredSoKeys.length === 0 ? (
          <div className="text-center mt-20 text-textMuted font-bold">Sales Order tidak ditemukan.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSoKeys.map((soKey) => {
              const group = soGroupData[soKey];
              const totalPcs = group.items.reduce((acc, curr) => acc + (parseInt(curr.isi_karton) || 0), 0);

              return (
                <div 
                  key={soKey} 
                  onClick={() => handleOpenModal(group)}
                  className="bg-surface border border-borderLight rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary hover:-translate-y-1 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    {/* Header Kartu SO */}
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-black text-lg text-textMain group-hover:text-primary transition-colors">
                        {group.so}
                      </span>
                      <span className="text-[10px] font-extrabold bg-indigo-50 text-primary px-2.5 py-1 rounded-md border border-indigo-100 flex items-center gap-1">
                        <FileText size={12} /> {group.items.length} Karton
                      </span>
                    </div>

                    {/* Total Kuantitas Pcs */}
                    <div className="flex justify-between items-center bg-bgBody border border-borderLight p-3 rounded-lg mb-4">
                      <div className="text-sm font-extrabold text-textMain">Total Qty</div>
                      <div className="text-base font-black text-emerald-600">{totalPcs.toLocaleString()} Pcs</div>
                    </div>

                    {/* Informasi Singkat */}
                    <div className="space-y-2 mb-4 text-xs">
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded bg-slate-200 text-slate-500 flex justify-center items-center shrink-0 mt-0.5 text-[10px] font-bold">A</div>
                        <div className="flex-1 flex justify-between border-b border-dashed border-borderLight pb-1">
                          <span className="font-semibold text-textMuted">Artikel</span>
                          <span className="font-extrabold text-textMain">{group.artikel}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Globe className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div className="flex-1 flex justify-between border-b border-dashed border-borderLight pb-1">
                          <span className="font-semibold text-textMuted">Destinasi</span>
                          <span className="font-extrabold text-primary">{group.destination}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div className="flex-1 flex justify-between">
                          <span className="font-semibold text-textMuted">Lokasi Gudang</span>
                          <span className="font-extrabold text-emerald-600">{group.lokasi}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Kartu */}
                  <div className="flex justify-between items-center pt-3 border-t border-dashed border-borderLight text-[10px] font-bold text-textMuted">
                    <span>📅 Input: {group.tanggal}</span>
                    <span className="text-primary group-hover:underline">Klik untuk rincian →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL POP-UP INFORMASI DETAIL SO */}
      {isModalOpen && selectedSoData && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-borderLight animate-in fade-in zoom-in duration-200">
            
            {/* Header Modal */}
            <div className="flex justify-between items-center pb-4 border-b border-borderLight mb-4">
              <h3 className="text-lg font-extrabold text-primary">Detail SO: {selectedSoData.so}</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-bgBody border border-borderLight flex justify-center items-center text-textMain hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Informasi Umum */}
            <div className="bg-bgBody p-4 rounded-xl border border-borderLight mb-5 flex justify-between items-center">
              <div>
                <div className="text-[10px] font-bold text-textMuted uppercase">ARTIKEL</div>
                <div className="text-sm font-extrabold text-textMain">{selectedSoData.artikel}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-textMuted uppercase">LOKASI / DESTINASI</div>
                <div className="text-sm font-extrabold text-primary">📍 {selectedSoData.lokasi} | 🌍 {selectedSoData.destination}</div>
              </div>
            </div>

            {/* Rincian Ukuran & Nomor Karton */}
            <div className="text-xs font-extrabold text-textMain mb-3">Rincian Ukuran & Karton ({selectedSoData.totalCtn} Total Karton):</div>
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
              {Object.keys(selectedSoData.sizeGroup).sort().map((sz, idx) => {
                const sData = selectedSoData.sizeGroup[sz];
                return (
                  <div key={idx} className="border border-borderLight p-3 rounded-xl bg-surface">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-extrabold text-sm text-primary">Size: {sz}</span>
                      <span className="text-[11px] font-bold bg-bgBody px-2.5 py-1 rounded-md border border-borderLight">
                        {sData.cartons.length} Karton | {sData.totalQty} Pcs
                      </span>
                    </div>
                    <div className="text-xs text-textMuted font-semibold">
                      <span className="font-bold text-textMain">Nomor Karton: </span> {sData.cartons.join(', ')}
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
