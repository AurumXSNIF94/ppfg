import { useState, useEffect } from 'react';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { db } from '../config/firebase';
import { Search, ClipboardList, Plus, CheckCircle, Clock, Trash2, RefreshCw } from 'lucide-react';

const URL_GAS_STOK = "https://script.google.com/macros/s/AKfycbxxkJTpL49H952n8zE7PePzWrufKdzDJJ15h9LqF21-141TguTw_BHrK8OQCJwtN1vKFA/exec";

export default function Planning() {
  const [planningData, setPlanningData] = useState([]);
  const [inboundData, setInboundData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [syncSo, setSyncSo] = useState('');
  const [syncStatus, setSyncStatus] = useState('');
  const [soNumber, setSoNumber] = useState('');
  const [artikel, setArtikel] = useState('');
  const [targetQty, setTargetQty] = useState('');

  useEffect(() => {
    const planningRef = ref(db, 'so_planning');
    const inboundRef = ref(db, 'stok_inbound_wh');

    const unsubPlanning = onValue(planningRef, (snapshot) => {
      const plans = [];
      snapshot.forEach((child) => {
        plans.push({ id: child.key, ...child.val() });
      });
      setPlanningData(plans.reverse());
    });

    const unsubInbound = onValue(inboundRef, (snapshot) => {
      const inboundMap = {};
      snapshot.forEach((child) => {
        const d = child.val();
        const so = (d.so_number || "").toUpperCase().trim();
        if (!inboundMap[so]) inboundMap[so] = 0;
        inboundMap[so] += parseInt(d.isi_karton) || 0;
      });
      setInboundData(inboundMap);
      setLoading(false);
    });

    return () => {
      unsubPlanning();
      unsubInbound();
    };
  }, []);

  // Sync Google Sheets FGWH
  const handleSyncSheets = async () => {
    if (!syncSo) return setSyncStatus("❌ Please enter SO number first!");
    setSyncStatus("⏳ Syncing with FGWH Sheets...");

    try {
      const res = await fetch(`${URL_GAS_STOK}?so=${encodeURIComponent(syncSo)}`);
      const data = await res.json();

      if (!data.error) {
        let arr = Array.isArray(data) ? data : (data.data || []);
        if (arr.length > 0) {
          let matched = arr.find(item => {
            let itemSo = (item.so || item.SO || "").toString().toUpperCase().trim();
            return itemSo === syncSo.toUpperCase().trim();
          }) || arr[0];

          setSoNumber((matched.so || matched.SO || syncSo).toUpperCase());
          setArtikel((matched.artikel || matched.Article || "").toUpperCase());
          // Jika di Sheets ada qty/target, bisa ditarik, jika tidak, biarkan kosong untuk diisi manual
          setTargetQty(matched.qty || matched.Quantity || '');
          setSyncStatus("✅ Data synced successfully from FGWH!");
        } else {
          setSoNumber(syncSo.toUpperCase());
          setSyncStatus("⚠️ SO not found in Sheets, fill manually.");
        }
      } else {
        setSyncStatus("❌ Failed to fetch from Sheets.");
      }
    } catch (err) {
      setSyncStatus("❌ Connection error to Google Sheets.");
    }
  };

  const handleAddPlanning = async (e) => {
    e.preventDefault();
    if (!soNumber || !artikel || !targetQty) {
      return alert("Please complete SO Number, Article, and Target Qty.");
    }

    try {
      await push(ref(db, 'so_planning'), {
        so_number: soNumber.toUpperCase().trim(),
        artikel: artikel.toUpperCase().trim(),
        target_qty: parseInt(targetQty) || 0,
        created_at: new Date().toISOString().split('T')[0]
      });

      setSoNumber(''); setArtikel(''); setTargetQty(''); setSyncSo(''); setSyncStatus('');
      setIsModalOpen(false);
      alert("Planning target successfully added!");
    } catch (err) {
      alert("Failed to add planning: " + err.message);
    }
  };

  const handleDeletePlanning = async (id) => {
    if (window.confirm("Delete this planning target?")) {
      await remove(ref(db, `so_planning/${id}`));
    }
  };

  const filteredPlans = planningData.filter(p => {
    const term = searchTerm.toUpperCase().trim();
    if (!term) return true;
    return p.so_number.includes(term) || p.artikel.includes(term);
  });

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-textMain">Buyer Order Planning & Shortage</h2>
          <p className="text-xs font-semibold text-textMuted mt-0.5">Monitor buyer order targets, actual inbound fulfillment, and remaining shortages per SO.</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-textMuted" />
            </div>
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2.5 border border-borderLight rounded-xl text-xs font-bold bg-surface text-textMain outline-none focus:border-primary uppercase shadow-sm"
              placeholder="Search SO or Article..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary py-2.5 px-4 text-xs inline-flex items-center gap-1.5 shrink-0"
          >
            <Plus size={16} /> Add Target Planning
          </button>
        </div>
      </div>

      <div className="flex-1 bg-surface border border-borderLight rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bgBody border-b border-borderLight text-[11px] font-extrabold text-textMuted uppercase tracking-wider">
                <th className="py-4 px-6">SO Number</th>
                <th className="py-4 px-6">Article</th>
                <th className="py-4 px-6 text-center">Buyer Target</th>
                <th className="py-4 px-6 text-center">Actual Inbound</th>
                <th className="py-4 px-6 text-center">Shortage (Kekurangan)</th>
                <th className="py-4 px-6">Fulfillment Progress</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLight text-xs font-semibold text-textMain">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-textMuted font-bold">Loading Planning Data...</td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-textMuted font-bold">No planning targets found.</td>
                </tr>
              ) : (
                filteredPlans.map((plan) => {
                  const soKey = (plan.so_number || "").toUpperCase().trim();
                  const actualQty = inboundData[soKey] || 0;
                  const targetQty = plan.target_qty || 1;
                  const shortage = Math.max(targetQty - actualQty, 0);
                  const percentage = Math.min(Math.round((actualQty / targetQty) * 100), 100);
                  const isCompleted = actualQty >= targetQty;

                  return (
                    <tr key={plan.id} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="py-4 px-6 font-extrabold text-primary flex items-center gap-2">
                        <ClipboardList size={16} className="text-primary/70 shrink-0" />
                        {plan.so_number}
                      </td>
                      <td className="py-4 px-6 font-extrabold">{plan.artikel}</td>
                      <td className="py-4 px-6 text-center font-bold text-slate-700">{targetQty.toLocaleString()} Pcs</td>
                      <td className="py-4 px-6 text-center font-extrabold text-emerald-600">{actualQty.toLocaleString()} Pcs</td>
                      <td className="py-4 px-6 text-center font-black text-rose-600">{shortage.toLocaleString()} Pcs</td>
                      <td className="py-4 px-6">
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-primary'}`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <div className="text-[10px] font-bold text-textMuted mt-1 text-right">{percentage}% Completed</div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold">
                            <CheckCircle size={12} /> Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-md text-[10px] font-extrabold">
                            <Clock size={12} /> In Progress
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button 
                          onClick={() => handleDeletePlanning(plan.id)}
                          className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
                          title="Delete Target"
                        >
                          <Trash2 size={14} />
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

      {/* MODAL TAMBAH PLANNING DENGAN SYNC SHEETS FGWH */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl p-6 shadow-2xl border border-borderLight">
            <div className="flex justify-between items-center pb-4 border-b border-borderLight mb-4">
              <h3 className="text-lg font-extrabold text-primary">Add Buyer Order Planning</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-bgBody flex items-center justify-center">✕</button>
            </div>
            
            {/* Sync Box FGWH Sheets */}
            <div className="bg-bgBody p-3.5 rounded-xl border border-borderLight mb-4">
              <div className="text-[11px] font-extrabold text-textMuted mb-2">⚡ Sync from FGWH Sheets</div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  className="form-input text-xs uppercase flex-1" 
                  placeholder="Enter SO Number..." 
                  value={syncSo} 
                  onChange={(e) => setSyncSo(e.target.value.toUpperCase())} 
                />
                <button type="button" onClick={handleSyncSheets} className="btn-primary px-3 text-xs">
                  <RefreshCw size={14} />
                </button>
              </div>
              {syncStatus && <div className="text-[10px] font-bold mt-2 text-primary">{syncStatus}</div>}
            </div>

            <form onSubmit={handleAddPlanning} className="space-y-4 mb-4">
              <div>
                <label className="form-label">Sales Order (SO) Number</label>
                <input 
                  type="text" 
                  className="form-input uppercase" 
                  value={soNumber} 
                  onChange={(e) => setSoNumber(e.target.value.toUpperCase())} 
                  required
                />
              </div>
              <div>
                <label className="form-label">Article / Style Name</label>
                <input 
                  type="text" 
                  className="form-input uppercase" 
                  value={artikel} 
                  onChange={(e) => setArtikel(e.target.value.toUpperCase())} 
                  required
                />
              </div>
              <div>
                <label className="form-label">Target Quantity (Pcs)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={targetQty} 
                  onChange={(e) => setTargetQty(e.target.value)} 
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-borderLight">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-bgBody rounded-xl font-bold text-xs">Cancel</button>
                <button type="submit" className="btn-primary py-2.5 px-6 text-xs">Save Planning Target</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
