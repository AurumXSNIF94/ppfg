import { useEffect, useMemo, useState } from 'react';
import { CloudOff, Cloud, RefreshCw, CheckCircle2 } from 'lucide-react';
import { listQueue } from '../services/offlineStore';
import { subscribeOfflineQueue, syncOfflineQueue } from '../services/offlineSync';

export default function OfflineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [queue, setQueue] = useState([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const unsubscribe = subscribeOfflineQueue(setQueue);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (online) {
      setSyncing(true);
      syncOfflineQueue().finally(() => setSyncing(false));
    }
  }, [online]);

  const pending = queue.length;
  const failed = useMemo(() => queue.filter(item => item.lastError).length, [queue]);

  return (
    <div className="hidden sm:flex items-center gap-2">
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-wide ${online ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
        {online ? <Cloud size={12}/> : <CloudOff size={12}/>}
        {online ? 'Online' : 'Offline'}
      </div>
      {pending > 0 && (
        <button
          type="button"
          onClick={async () => {
            setSyncing(true);
            await syncOfflineQueue();
            setSyncing(false);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-[9px] font-black"
          title={failed ? 'Some offline transactions need another retry.' : 'Pending offline transactions'}
        >
          {syncing ? <RefreshCw size={12} className="animate-spin"/> : <CheckCircle2 size={12}/>}
          {pending} Pending
        </button>
      )}
    </div>
  );
}
