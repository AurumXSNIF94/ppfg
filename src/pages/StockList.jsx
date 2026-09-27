import { useState, useEffect } from 'react';
import { ref, onValue, update, remove } from 'firebase/database';
import { db } from '../config/firebase';
import { Search, MapPin, Globe, Trash2, Edit3, X, FileText } from 'lucide-react';

export default function StockList() {
  const [rawData, setRawData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Edit Modal State (Full Fields)
  const [editingItem, setEditingItem] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editSo, setEditSo] = useState('');
  const [editJenis, setEditJenis] = useState('SOLID');
  const [editArtikel, setEditArtikel] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editCtnNo, setEditCtnNo] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editDestination, setEditDestination] = useState('');
  const [editLoc, setEditLoc] = useState('');

  // Helper function to format dates consistently
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [_, year, month, day] = isoMatch;
      const dateObj = new Date(year, month - 1, day);
      return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const parsed = new Date(dateString);
    if (!isNaN(parsed)) {
      return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return dateString;
  };

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
    setEditDate(item.tanggal || '');
    setEditSo(item.so_number || '');
    setEditJenis(item.jenis || 'SOLID');
    setEditArtikel(item.artikel || '');
    setEditSize(item.size || '');
    setEditCtnNo(item.nomor_karton || '');
    setEditQty(item.isi_karton || '');
    setEditDestination(item.destination || '');
    setEditLoc(item.lokasi || '');
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      await update(ref(db, `stok_inbound_wh/${editingItem.id}`), {
        tanggal: editDate,
        so_number: editSo.toUpperCase(),
        jenis: editJenis,
        artikel: editArtikel.toUpperCase(),
        size: editSize.toUpperCase(),
        nomor_karton: editCtnNo.toUpperCase(),
        isi_karton: parseInt(editQty) || 0,
        destination: editDestination.toUpperCase(),
        lokasi: editLoc.toUpperCase()
      });
      setEditingItem(null);
      alert("Successfully updated all fields!");
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
      (d.nomor_karton || "").toUpperCase().includes(term) ||
      (d.size || "").toUpperCase().includes(term)
    );
  });

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full relative">
      
      {/* Header & Search Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-textMain">Stock Inbound Records</h2>
          <p className="text-xs font-semibold text-textMuted mt-0.5">Comprehensive list of all individual cartons registered in the warehouse.</p>
        </div>
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-textMuted" />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 border border-borderLight rounded-xl text-xs font-bold bg-surface text-textMain outline-none focus:border-primary focus:ring-4 focus:ring-indigo-50 shadow-sm uppercase"
            placeholder="Search SO, Article, Size, Location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Enterprise Table Layout */}
      <div className="flex-1 bg-surface border border-borderLight rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bgBody border-b border-borderLight text-[11px] font-extrabold text-textMuted uppercase tracking-wider">
                <th className="py-4 px-6">Date</th>
                <th className="py-4 px-6">SO Number</th>
                <th className="py-4 px-6">Type</th>
                <th className="py-4 px-6">Article</th>
                <th className="py-4 px-6">Size</th>
                <th className="py-4 px-6">Carton No.</th>
                <th className="py-4 px-6 text-center">Qty (Pcs)</th>
                <th className="py-4 px-6">Destination</th>
                <th className="py-4 px-6">Location</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLight text-xs font-semibold text-textMain">
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center py-12 text-textMuted font-bold">Loading Stock Records...</td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-12 text-textMuted font-bold">No stock records found.</td>
                </tr>
              ) : (
                filteredData.map((d) => (
                  <tr key={d.id} className="hover:bg-indigo-50/40 transition-colors">
                    <td className="py-4 px-6 text-textMuted font-bold">{formatDate(d.tanggal)}</td>
                    <td className="py-4 px-6 font-extrabold text-primary flex items-center gap-2">
                      <FileText size={15} className="text-primary/70 shrink-0" />
                      {d.so_number}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                        d.jenis === 'MIX' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {d.jenis}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-extrabold">{d.artikel}</td>
                    <td className="py-4 px-6 font-black text-indigo-600">{d.size}</td>
                    <td className="py-4 px-6 font-bold text-slate-700">{d.nomor_karton}</td>
                    <td className="py-4 px-6 text-center font-extrabold text-slate-900">{d.isi_karton || '-'}</td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                        <Globe size={11} className="text-primary" /> {d.destination}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-emerald-700 font-bold">
                        <MapPin size={11} className="text-emerald-500" /> {d.lokasi}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => handleOpenEdit(d)}
                          className="p-1.5 bg-indigo-50 text-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
                          title="Edit Record"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(d.id)}
                          className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FULL EDIT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-surface w-full max-w-xl rounded-2xl p-6 shadow-2xl border border-borderLight max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-borderLight mb-4">
              <h3 className="text-lg font-extrabold text-primary">Edit Carton Record (All Fields)</h3>
              <button onClick={() => setEditingItem(null)} className="w-8 h-8 rounded-full bg-bgBody flex items-center justify-center">
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">SO Number</label>
                  <input type="text" className="form-input uppercase" value={editSo} onChange={(e) => setEditSo(e.target.value.toUpperCase())} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Carton Type</label>
                  <select className="form-input" value={editJenis} onChange={(e) => setEditJenis(e.target.value)}>
                    <option value="SOLID">SOLID</option>
                    <option value="MIX">MIX</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Article / Style</label>
                  <input type="text" className="form-input uppercase" value={editArtikel} onChange={(e) => setEditArtikel(e.target.value.toUpperCase())} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Size</label>
                  <input type="text" className="form-input uppercase" value={editSize} onChange={(e) => setEditSize(e.target.value.toUpperCase())} />
                </div>
                <div>
                  <label className="form-label">Carton No.</label>
                  <input type="text" className="form-input uppercase" value={editCtnNo} onChange={(e) => setEditCtnNo(e.target.value.toUpperCase())} />
                </div>
                <div>
                  <label className="form-label">Qty (Pcs)</label>
                  <input type="number" className="form-input" value={editQty} onChange={(e) => setEditQty(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Destination</label>
                  <input type="text" className="form-input uppercase" value={editDestination} onChange={(e) => setEditDestination(e.target.value.toUpperCase())} />
                </div>
                <div>
                  <label className="form-label">Warehouse Location</label>
                  <input type="text" className="form-input uppercase" value={editLoc} onChange={(e) => setEditLoc(e.target.value.toUpperCase())} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-borderLight">
              <button onClick={() => setEditingItem(null)} className="px-5 py-2.5 bg-bgBody rounded-xl font-bold text-xs">Cancel</button>
              <button onClick={handleSaveEdit} className="btn-primary py-2.5 px-6 text-xs">Save All Changes</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
