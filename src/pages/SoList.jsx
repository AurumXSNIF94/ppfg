import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../config/firebase';
import { Search, MapPin, Globe, X, FileText, ChevronRight } from 'lucide-react';

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
      
      {/* Header & Kotak Pencarian */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-textMain">Master Sales Order (SO) List</h2>
          <p className="text-xs font-semibold text-textMuted mt-0.5">Rekapitulasi seluruh data inbound yang tersimpan di database.</p>
        </div>
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-textMuted" />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 border border-borderLight rounded-xl text-xs font-bold bg-surface text-textMain outline-none focus:border-primary focus:ring-4 focus:ring-indigo-50 shadow-sm uppercase"
            placeholder="Cari SO, Artikel, Destinasi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
          />
        </div>
      </div>

      {/* Tabel Data Enterprise Modern */}
      <div className="flex-1 bg-surface border border-borderLight rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bgBody border-b border-borderLight text-[11px] font-extrabold text-textMuted uppercase tracking-wider">
                <th className="py-4 px-6">No. SO</th>
                <th className="py-4 px-6">Tanggal</th>
                <th className="py-4 px-6">Artikel / Style</th>
                <th className="py-4 px-6">Destinasi</th>
                <th className="py-4 px-6">Lokasi Gudang</th>
                <th className="py-4 px-6 text-center">Total Karton</th>
                <th className="py-4 px-6 text-center">Total Pcs</th>
                <th className="py-4 px-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLight text-xs font-semibold text-textMain">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-textMuted font-bold">Memuat Data dari Database...</td>
                </tr>
              ) : filteredSoKeys.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-textMuted font-bold">Tidak ada data Sales Order ditemukan.</td>
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
            <div className="bg-bgBody p-4 rounded-xl border border-borderLight mb-5 grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-bold text-textMuted uppercase">ARTIKEL</div>
                <div className="text-sm font-extrabold text-textMain mt-0.5">{selectedSoData.artikel}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-textMuted uppercase">LOKASI GUDANG</div>
                <div className="text-sm font-extrabold text-emerald-600 mt-0.5">📍 {selectedSoData.lokasi}</div>
              </div>
              <div className="col-span-2 pt-2 border-t border-borderLight">
                <div className="text-[10px] font-bold text-textMuted uppercase">DESTINASI TUJUAN</div>
                <div className="text-sm font-extrabold text-primary mt-0.5">🌍 {selectedSoData.destination}</div>
              </div>
            </div>

            {/* Rincian Ukuran & Nomor Karton */}
            <div className="text-xs font-extrabold text-textMain mb-3">Rincian Ukuran & Nomor Karton ({selectedSoData.totalCtn} Total Karton):</div>
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
