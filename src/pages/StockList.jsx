import { useState, useEffect } from 'react';
import { ref, onValue, update, remove } from 'firebase/database';
import { db } from '../config/firebase';
import { Search, Package, MapPin, Globe, Trash2, Edit3, X, Check } from 'lucide-react';

export default function StockList() {
  const [rawData, setRawData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editLoc, setEditLoc] = useState('');

  useEffect(() => {
    const kartonRef = ref(db, 'stok_inbound_wh');
    const unsubscribe = onValue(kartonRef, (snapshot) => {
      const data = [];
      snapshot.forEach((child) => {
        data.push({ id: child.key, ...child.val() });
      });
      setRawData(data.reverse());
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this carton record?")) {
      try {
        await remove(ref(db, `stok_inbound_wh/${id}`));
      } catch (err) {
        alert("Failed to delete: " + err.message);
      }
    }
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setEditQty(item.isi_karton || '');
    setEditLoc(item.lokasi || '');
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      await update(ref(db, `stok_inbound_wh/${editingItem.id}`), {
        isi_karton: parseInt(editQty) || 0,
        lokasi: editLoc.toUpperCase()
      });
      setEditingItem(null);
      alert("Successfully updated!");
    } catch (err) {
      alert("Failed to update: " + err.message);
    }
  };

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
    <div className="max-w-7xl mx-auto flex flex-col h-full relative">
      
      {/* Search Header */}
      <div className="sticky top-0 z-10 bg-bgBody/80 backdrop-blur-md pb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-textMuted" />
          </div>
          <input
            type="text"
            className="w-full pl-12 pr-4 py-4 border border-borderLight rounded-xl text-sm font-bold bg-surface text-textMain outline-none focus:border-primary focus:ring-4 focus:ring-indigo-50 shadow-sm uppercase"
            placeholder="Search by SO Number, Article, Destination, or Location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Grid List */}
      <div className="flex-1 overflow-y-auto pb-10">
        {loading ? (
          <div className="text-center mt-20 text-textMuted font-bold">Loading Stock Data...</div>
        ) : filteredData.length === 0 ? (
          <div className="text-center mt-20 text-textMuted font-bold">No stock records found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredData.map((d) => (
              <div key={d.id} className="bg-surface border border-borderLight rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-extrabold text-lg text-textMain group-hover:text-primary transition-colors">
                      {d.so_number}
                    </span>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider ${
                      d.jenis === 'MIX' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {d.jenis}
                    </span>
                  </div>

                  <div className="flex justify-between items-center bg-bgBody border border-borderLight p-3 rounded-lg mb-4">
                    <div className="text-xl font-black text-primary">{d.size}</div>
                    <div className="text-xs font-extrabold text-textMuted">QTY: {d.isi_karton || '-'} PCS</div>
                  </div>

                  <div className="space-y-2 mb-4 text-xs">
                    <div className="flex items-center justify-between border-b border-dashed border-borderLight pb-1">
                      <span className="font-semibold text-textMuted">Carton No:</span>
                      <span className="font-extrabold text-textMain">{d.nomor_karton}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-dashed border-borderLight pb-1">
                      <span className="font-semibold text-textMuted">Article:</span>
                      <span className="font-extrabold text-textMain">{d.artikel}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-dashed border-borderLight pb-1">
                      <span className="font-semibold text-textMuted">Destination:</span>
                      <span className="font-extrabold text-primary">{d.destination}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-textMuted">Location:</span>
                      <span className="font-extrabold text-emerald-600">{d.lokasi}</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer & Action Buttons */}
                <div className="pt-3 border-t border-dashed border-borderLight flex justify-between items-center">
                  <span className="text-[10px] font-bold text-textMuted">📅 {d.tanggal}</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleOpenEdit(d)}
                      className="p-2 bg-indigo-50 text-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
                      title="Edit Record"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(d.id)}
                      className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
                      title="Delete Record"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl p-6 shadow-2xl border border-borderLight">
            <div className="flex justify-between items-center pb-4 border-b border-borderLight mb-4">
              <h3 className="text-lg font-extrabold text-primary">Edit Carton Record</h3>
              <button onClick={() => setEditingItem(null)} className="w-8 h-8 rounded-full bg-bgBody flex items-center justify-center">
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="form-label">Quantity (Pcs)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={editQty} 
                  onChange={(e) => setEditQty(e.target.value)} 
                />
              </div>
              <div>
                <label className="form-label">Warehouse Location</label>
                <input 
                  type="text" 
                  className="form-input uppercase" 
                  value={editLoc} 
                  onChange={(e) => setEditLoc(e.target.value.toUpperCase())} 
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setEditingItem(null)} className="px-5 py-2.5 bg-bgBody rounded-xl font-bold text-xs">Cancel</button>
              <button onClick={handleSaveEdit} className="btn-primary py-2.5 px-6 text-xs">Save Changes</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
