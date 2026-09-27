import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../config/firebase';
import { Search, Package, MapPin, Globe } from 'lucide-react';

export default function StockList() {
  const [rawData, setRawData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const kartonRef = ref(db, 'stok_inbound_wh');
    const unsubscribe = onValue(kartonRef, (snapshot) => {
      const data = [];
      snapshot.forEach((child) => {
        data.push({ id: child.key, ...child.val() });
      });
      // Reverse array to show newest first
      setRawData(data.reverse());
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter Data Real-time
  const filteredData = rawData.filter(d => {
    const term = searchTerm.toUpperCase().trim();
    if (!term) return true;
    return (
      (d.so_number || "").toUpperCase().includes(term) ||
      (d.artikel || "").toUpperCase().includes(term) ||
      (d.destination || "").toUpperCase().includes(term) ||
      (d.lokasi || "").toUpperCase().includes(term) ||
      (d.nomor_karton || "").toUpperCase().includes(term)
    );
  });

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full">
      
      {/* Sticky Search Bar */}
      <div className="sticky top-0 z-10 bg-bgBody/80 backdrop-blur-md pb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-textMuted" />
          </div>
          <input
            type="text"
            className="w-full pl-12 pr-4 py-4 border border-borderLight rounded-xl text-sm font-bold bg-surface text-textMain outline-none transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-indigo-50 shadow-sm"
            placeholder="Cari berdasarkan No SO, Artikel, Destinasi, atau Lokasi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-y-auto pb-10">
        {loading ? (
          <div className="text-center mt-20 text-textMuted font-bold">Memuat Data Stock...</div>
        ) : filteredData.length === 0 ? (
          <div className="text-center mt-20 text-textMuted font-bold">Data tidak ditemukan.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredData.map((d) => (
              <div key={d.id} className="bg-surface border border-borderLight rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 group">
                
                {/* Header Card */}
                <div className="flex justify-between items-center mb-3">
                  <span className="font-extrabold text-lg text-textMain group-hover:text-primary transition-colors">
                    {d.so_number}
                  </span>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider ${
                    d.jenis === 'MIX' 
                      ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {d.jenis}
                  </span>
                </div>

                {/* Highlight Size & Qty */}
                <div className="flex justify-between items-center bg-bgBody border border-borderLight p-3 rounded-lg mb-4">
                  <div className="text-xl font-black text-primary">{d.size}</div>
                  <div className="text-xs font-extrabold text-textMuted">QTY: {d.isi_karton || '-'} Pcs</div>
                </div>

                {/* Info List */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-2 text-xs">
                    <Package className="w-4 h-4 text-textMuted shrink-0 mt-0.5" />
                    <div className="flex-1 flex justify-between border-b border-dashed border-borderLight pb-1">
                      <span className="font-semibold text-textMuted">Ctn No.</span>
                      <span className="font-extrabold text-textMain">{d.nomor_karton}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <div className="w-4 h-4 rounded bg-slate-200 text-slate-500 flex justify-center items-center shrink-0 mt-0.5 text-[10px] font-bold">A</div>
                    <div className="flex-1 flex justify-between border-b border-dashed border-borderLight pb-1">
                      <span className="font-semibold text-textMuted">Artikel</span>
                      <span className="font-extrabold text-textMain truncate max-w-[120px]">{d.artikel}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <Globe className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 flex justify-between border-b border-dashed border-borderLight pb-1">
                      <span className="font-semibold text-textMuted">Destinasi</span>
                      <span className="font-extrabold text-primary">{d.destination}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="flex-1 flex justify-between">
                      <span className="font-semibold text-textMuted">Lokasi</span>
                      <span className="font-extrabold text-emerald-600">{d.lokasi}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Card */}
                <div className="flex justify-between items-center pt-3 border-t border-dashed border-borderLight text-[10px] font-bold text-textMuted">
                  <span>📅 {d.tanggal}</span>
                  <span>👤 {d.user ? d.user.split('@')[0] : 'System'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
