import { useState } from 'react';
import { ref, push, set, serverTimestamp } from 'firebase/database';
import { db, auth } from '../config/firebase';

const URL_GAS_STOK = "https://script.google.com/macros/s/AKfycbxxkJTpL49H952n8zE7PePzWrufKdzDJJ15h9LqF21-141TguTw_BHrK8OQCJwtN1vKFA/exec";
const URL_GAS_LOKASI = "https://script.google.com/macros/s/AKfycbwNhXSfLc6OeeOr9nKF2K99iL07XK8qWn7cGjV_kNRC9uyN53OXftX9wbB5pZmVhC8q/exec";

export default function EntryForm() {
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [tarikSo, setTarikSo] = useState('');

  // Form States
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [soNumber, setSoNumber] = useState('');
  const [jenis, setJenis] = useState('SOLID');
  const [artikel, setArtikel] = useState('');
  const [destination, setDestination] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [keterangan, setKeterangan] = useState('');
  
  // Dynamic Cartons State
  const [cartons, setCartons] = useState([{ id: Date.now(), size: '', noKarton: '', qty: '' }]);

  // --- GOOGLE SHEETS PULL LOGIC ---
  const handleSyncSheets = async () => {
    if (!tarikSo) return setSyncStatus("❌ Please enter the SO number first!");
    setSyncStatus("⏳ Syncing data...");
    
    try {
      const resStok = await fetch(`${URL_GAS_STOK}?so=${encodeURIComponent(tarikSo)}`);
      const dataStok = await resStok.json();

      if (!dataStok.error) {
        let arrStok = Array.isArray(dataStok) ? dataStok : (dataStok.data || []);
        if (arrStok.length > 0) {
          let matched = arrStok.find(item => {
            let itemSo = (item.so || item.SO || "").toString().toUpperCase().trim();
            return itemSo === tarikSo || itemSo.includes(tarikSo);
          }) || arrStok[0];

          setSoNumber((matched.so || matched.SO || tarikSo).toUpperCase());
          setArtikel((matched.artikel || matched.Article || "").toUpperCase());
          setDestination((matched.destination || matched.Destination || matched.destinasi || "").toUpperCase());
        } else {
          setSoNumber(tarikSo);
        }
      }

      try {
        const resLoc = await fetch(URL_GAS_LOKASI);
        const dataLoc = await resLoc.json();
        let arrLoc = Array.isArray(dataLoc) ? dataLoc : (dataLoc.data || []);
        
        let matchLoc = arrLoc.find(item => {
          let itemSo = (item.so || item.SO || item.sales_order || "").toString().toUpperCase().trim();
          return itemSo === tarikSo || itemSo.includes(tarikSo);
        });

        if (matchLoc) {
          setLokasi((matchLoc.lokasi || matchLoc.Location || matchLoc.track_lane || "").toUpperCase());
        }
      } catch (e) { console.log("Failed to fetch location"); }

      setSyncStatus(`✅ SO data successfully pulled.`);
    } catch (err) {
      setSyncStatus('❌ Failed to connect to Google Sheets.');
    }
  };

  // --- DYNAMIC ROWS LOGIC ---
  const handleAddRow = () => {
    setCartons([...cartons, { id: Date.now(), size: jenis === 'MIX' ? '-' : '', noKarton: '', qty: '' }]);
  };

  const handleRemoveRow = (id) => {
    setCartons(cartons.filter(c => c.id !== id));
  };

  const updateCarton = (id, field, value) => {
    setCartons(cartons.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  // --- FIREBASE SAVE LOGIC ---
  const handleSave = async () => {
    if (!soNumber || !artikel || !lokasi || !destination) {
      return alert("SO, Article, Destination, and Location are required.");
    }

    const dataToPush = cartons.filter(c => c.size && c.noKarton && c.qty).map(c => {
      let ctnNo = c.noKarton.startsWith('#') ? c.noKarton : `#${c.noKarton}`;
      return { ...c, noKarton: ctnNo, qty: parseInt(c.qty) || 0 };
    });

    if (dataToPush.length === 0) return alert("Please fill in at least 1 carton detail completely.");

    setLoading(true);
    try {
      const currentUser = auth.currentUser ? auth.currentUser.email : "Admin";
      const kartonRef = ref(db, 'stok_inbound_wh');
      
      const promises = dataToPush.map(kData => {
        return set(push(kartonRef), { 
            tanggal, 
            so_number: soNumber, 
            jenis, 
            artikel, 
            destination, 
            size: kData.size, 
            nomor_karton: kData.noKarton, 
            isi_karton: kData.qty, 
            lokasi, 
            keterangan, 
            status: "INBOUND", 
            timestamp_in: serverTimestamp(), 
            user: currentUser
        });
      });
      await Promise.all(promises);

      // Background Sync Sheets
      let syncPayload = dataToPush.map(k => ({ so: soNumber, karton: k.noKarton, actionType: "UNCHECK" }));
      fetch(`${URL_GAS_STOK}?action=sync&payload=${encodeURIComponent(JSON.stringify(syncPayload))}`, { mode: "no-cors" }).catch(e=>e);

      alert("✅ Data successfully saved.");
      // Reset Form
      setSoNumber(''); setArtikel(''); setDestination(''); setLokasi(''); setKeterangan(''); setTarikSo(''); setSyncStatus('');
      setCartons([{ id: Date.now(), size: jenis === 'MIX' ? '-' : '', noKarton: '', qty: '' }]);
    } catch (err) {
      alert("Firebase Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* CARD AUTO PULL */}
      <div className="bg-surface p-6 rounded-2xl shadow-sm border-l-4 border-primary mb-6">
        <h3 className="text-primary font-extrabold mb-1">⚡ Auto Pull Data (Google Sheets)</h3>
        <p className="text-xs text-textMuted font-bold mb-4">Automatically fill Destination & Location based on SO number.</p>
        <div className="flex gap-4">
          <input 
            type="text" 
            className="form-input flex-1 uppercase" 
            placeholder="Type SO Number..."
            value={tarikSo}
            onChange={(e) => setTarikSo(e.target.value.toUpperCase())}
          />
          <button onClick={handleSyncSheets} className="btn-primary w-32">SYNC</button>
        </div>
        {syncStatus && <div className="text-xs font-bold mt-3 text-primary">{syncStatus}</div>}
      </div>

      {/* MAIN FORM */}
      <div className="bg-surface p-8 rounded-2xl shadow-sm border border-borderLight">
        <h2 className="text-lg font-extrabold text-textMain mb-6">📥 Manual Inbound Form</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>
          <div>
            <label className="form-label">SO Number</label>
            <input type="text" className="form-input uppercase" placeholder="e.g. 12345ABC" value={soNumber} onChange={(e) => setSoNumber(e.target.value.toUpperCase())} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="form-label">Carton Type</label>
            <select className="form-input" value={jenis} onChange={(e) => {
              setJenis(e.target.value);
              setCartons(cartons.map(c => ({ ...c, size: e.target.value === 'MIX' ? '-' : '' })));
            }}>
              <option value="SOLID">SOLID CARTON</option>
              <option value="MIX">MIX CARTON</option>
            </select>
          </div>
          <div>
            <label className="form-label">Article / Style</label>
            <input type="text" className="form-input uppercase" placeholder="Article Name" value={artikel} onChange={(e) => setArtikel(e.target.value.toUpperCase())} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="form-label">Destination</label>
            <input type="text" className="form-input uppercase" placeholder="Destination Country" value={destination} onChange={(e) => setDestination(e.target.value.toUpperCase())} />
          </div>
          <div>
            <label className="form-label">Location / Track Lane</label>
            <input type="text" className="form-input uppercase" placeholder="Rack / Area Location" value={lokasi} onChange={(e) => setLokasi(e.target.value.toUpperCase())} />
          </div>
        </div>

        <div className="mb-8">
          <label className="form-label">Additional Notes</label>
          <input type="text" className="form-input" placeholder="Optional" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
        </div>

        {/* DYNAMIC CARTON ROWS */}
        <div className="bg-bgBody border border-dashed border-slate-300 p-6 rounded-xl mb-6">
          <h3 className="text-xs font-extrabold text-textMuted uppercase mb-4">Carton Details</h3>
          
          {cartons.map((carton) => (
            <div key={carton.id} className="flex gap-4 mb-3">
              <input 
                type="text" 
                className={`form-input flex-1 uppercase ${jenis === 'MIX' ? 'bg-slate-200' : ''}`} 
                placeholder="Size" 
                value={carton.size}
                readOnly={jenis === 'MIX'}
                onChange={(e) => updateCarton(carton.id, 'size', e.target.value.toUpperCase())}
              />
              <input 
                type="text" 
                className="form-input flex-1 uppercase" 
                placeholder="Ctn No." 
                value={carton.noKarton}
                onChange={(e) => updateCarton(carton.id, 'noKarton', e.target.value.toUpperCase())}
              />
              <input 
                type="number" 
                className="form-input flex-1" 
                placeholder="Qty Pcs" 
                value={carton.qty}
                onChange={(e) => updateCarton(carton.id, 'qty', e.target.value)}
              />
              {cartons.length > 1 && (
                <button onClick={() => handleRemoveRow(carton.id)} className="bg-red-100 text-red-600 px-4 rounded-lg font-bold hover:bg-red-200 transition-colors">✕</button>
              )}
            </div>
          ))}
          
          <button onClick={handleAddRow} className="w-full mt-2 py-3 bg-white border border-dashed border-primary text-primary font-bold rounded-lg hover:bg-indigo-50 transition-colors">
            + Add New Row
          </button>
        </div>

        <button onClick={handleSave} disabled={loading} className={`w-full ${loading ? 'opacity-70 cursor-not-allowed' : ''} btn-primary text-base py-4`}>
          {loading ? 'Saving...' : 'Save Data & Sync'}
        </button>
      </div>
    </div>
  );
}
