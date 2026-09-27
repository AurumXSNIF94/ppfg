import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import {
  Search,
  RefreshCw,
  Package,
  Boxes,
  MapPin,
  FileText,
  Filter,
  X,
} from 'lucide-react';

import { db } from '../config/firebase';

export default function StockList() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [jenisFilter, setJenisFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    const stockRef = ref(db, 'stok_inbound_wh');

    const unsubscribe = onValue(
      stockRef,
      (snapshot) => {
        const data = snapshot.val();

        if (!data) {
          setStocks([]);
          setLoading(false);
          return;
        }

        const rows = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
        }));

        // Data terbaru di atas
        rows.sort((a, b) => {
          const timeA = getTimestamp(a.timestamp_in);
          const timeB = getTimestamp(b.timestamp_in);

          return timeB - timeA;
        });

        setStocks(rows);
        setLoading(false);
      },
      (error) => {
        console.error('Firebase Stock Error:', error);
        setStocks([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredStocks = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return stocks.filter((item) => {
      const matchesSearch =
        !keyword ||
        [
          item.so_number,
          item.artikel,
          item.destination,
          item.size,
          item.nomor_karton,
          item.lokasi,
          item.jenis,
          item.status,
          item.user,
        ].some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(keyword)
        );

      const matchesJenis =
        jenisFilter === 'ALL' ||
        String(item.jenis ?? '').toUpperCase() === jenisFilter;

      const matchesStatus =
        statusFilter === 'ALL' ||
        String(item.status ?? '').toUpperCase() === statusFilter;

      return matchesSearch && matchesJenis && matchesStatus;
    });
  }, [stocks, search, jenisFilter, statusFilter]);

  const stats = useMemo(() => {
    const totalQty = filteredStocks.reduce(
      (sum, item) => sum + toNumber(item.isi_karton),
      0
    );

    const uniqueSo = new Set(
      filteredStocks
        .map((item) => String(item.so_number ?? '').trim())
        .filter(Boolean)
    ).size;

    const uniqueLocation = new Set(
      filteredStocks
        .map((item) => String(item.lokasi ?? '').trim())
        .filter(Boolean)
    ).size;

    return {
      totalRows: filteredStocks.length,
      totalQty,
      uniqueSo,
      uniqueLocation,
    };
  }, [filteredStocks]);

  const clearFilters = () => {
    setSearch('');
    setJenisFilter('ALL');
    setStatusFilter('ALL');
  };

  const hasFilter =
    search.trim() ||
    jenisFilter !== 'ALL' ||
    statusFilter !== 'ALL';

  return (
    <div className="max-w-7xl mx-auto w-full h-full flex flex-col gap-5">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-extrabold text-textMain">
            Stock List
          </h2>

          <p className="text-sm font-semibold text-textMuted mt-1">
            Daftar inbound yang tersimpan di warehouse
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-700">
              Realtime
            </span>
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-borderLight bg-surface hover:border-primary hover:text-primary transition-colors"
            title="Refresh"
          >
            <RefreshCw size={17} />
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <StatCard
          icon={Package}
          label="Total Record"
          value={stats.totalRows}
          iconClass="bg-indigo-50 text-primary"
        />

        <StatCard
          icon={Boxes}
          label="Total Qty"
          value={stats.totalQty}
          iconClass="bg-amber-50 text-amber-600"
        />

        <StatCard
          icon={FileText}
          label="Unique SO"
          value={stats.uniqueSo}
          iconClass="bg-emerald-50 text-emerald-600"
        />

        <StatCard
          icon={MapPin}
          label="Lokasi Aktif"
          value={stats.uniqueLocation}
          iconClass="bg-rose-50 text-rose-600"
        />
      </div>

      {/* FILTER */}
      <div className="bg-surface border border-borderLight rounded-2xl p-4 shadow-sm shrink-0">
        <div className="flex flex-col xl:flex-row gap-3">
          {/* SEARCH */}
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted"
            />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari SO, artikel, destination, karton, lokasi..."
              className="w-full pl-11 pr-10 py-3 rounded-xl border border-borderLight bg-slate-50 text-sm font-semibold text-textMain outline-none focus:border-primary focus:bg-surface transition-all"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-primary"
              >
                <X size={17} />
              </button>
            )}
          </div>

          {/* JENIS */}
          <div className="flex items-center gap-2">
            <Filter size={17} className="text-textMuted hidden sm:block" />

            <select
              value={jenisFilter}
              onChange={(e) => setJenisFilter(e.target.value)}
              className="px-4 py-3 rounded-xl border border-borderLight bg-slate-50 text-sm font-bold text-textMain outline-none focus:border-primary"
            >
              <option value="ALL">Semua Jenis</option>
              <option value="SOLID">SOLID</option>
              <option value="MIX">MIX</option>
            </select>
          </div>

          {/* STATUS */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 rounded-xl border border-borderLight bg-slate-50 text-sm font-bold text-textMain outline-none focus:border-primary"
          >
            <option value="ALL">Semua Status</option>
            <option value="INBOUND">INBOUND</option>
          </select>

          {hasFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-3 rounded-xl border border-borderLight bg-surface text-sm font-bold text-textMuted hover:text-primary hover:border-primary transition-all"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-surface border border-borderLight rounded-2xl shadow-sm overflow-hidden flex-1 min-h-0">
        <div className="h-full overflow-auto">
          <table className="w-full border-collapse min-w-[1100px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-borderLight">
                <th className="table-head">No</th>
                <th className="table-head text-left">SO</th>
                <th className="table-head text-left">Jenis</th>
                <th className="table-head text-left">Artikel</th>
                <th className="table-head text-left">Destination</th>
                <th className="table-head text-left">Size</th>
                <th className="table-head text-left">No. Karton</th>
                <th className="table-head text-right">Qty</th>
                <th className="table-head text-left">Lokasi</th>
                <th className="table-head text-left">Status</th>
                <th className="table-head text-left">Tanggal</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <LoadingRows />
              ) : filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan="11" className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <Boxes size={25} className="text-slate-400" />
                      </div>

                      <div className="text-sm font-extrabold text-textMain">
                        Tidak ada data
                      </div>

                      <div className="text-xs font-semibold text-textMuted mt-1">
                        {hasFilter
                          ? 'Tidak ada data yang cocok dengan filter.'
                          : 'Belum ada data inbound.'}
                      </div>

                      {hasFilter && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="mt-4 text-xs font-bold text-primary hover:underline"
                        >
                          Reset filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStocks.map((item, index) => (
                  <StockRow
                    key={item.id}
                    item={item}
                    index={index}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   COMPONENTS
========================================================= */

function StatCard({ icon: Icon, label, value, iconClass }) {
  return (
    <div className="bg-surface border border-borderLight rounded-2xl p-4 shadow-sm flex items-center gap-3">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}
      >
        <Icon size={20} />
      </div>

      <div className="min-w-0">
        <div className="text-[10px] font-bold text-textMuted uppercase tracking-wider">
          {label}
        </div>

        <div className="text-xl font-extrabold text-textMain mt-0.5">
          {Number(value || 0).toLocaleString('id-ID')}
        </div>
      </div>
    </div>
  );
}

function StockRow({ item, index }) {
  const jenis = String(item.jenis ?? '').toUpperCase();
  const status = String(item.status ?? '').toUpperCase();

  return (
    <tr className="border-b border-borderLight last:border-b-0 hover:bg-slate-50/70 transition-colors">
      <td className="table-cell text-center text-textMuted">
        {index + 1}
      </td>

      <td className="table-cell">
        <div className="font-extrabold text-textMain">
          {item.so_number || '-'}
        </div>
      </td>

      <td className="table-cell">
        <span
          className={`
            inline-flex px-2.5 py-1 rounded-lg text-[10px] font-extrabold
            ${
              jenis === 'MIX'
                ? 'bg-violet-50 text-violet-600'
                : 'bg-indigo-50 text-primary'
            }
          `}
        >
          {jenis || '-'}
        </span>
      </td>

      <td className="table-cell">
        <span className="font-bold text-textMain">
          {item.artikel || '-'}
        </span>
      </td>

      <td className="table-cell">
        <span className="font-semibold text-textMain">
          {item.destination || '-'}
        </span>
      </td>

      <td className="table-cell">
        {item.size || '-'}
      </td>

      <td className="table-cell">
        <span className="font-extrabold text-primary">
          {item.nomor_karton || '-'}
        </span>
      </td>

      <td className="table-cell text-right">
        <span className="font-extrabold text-textMain">
          {toNumber(item.isi_karton).toLocaleString('id-ID')}
        </span>
      </td>

      <td className="table-cell">
        <span className="inline-flex items-center gap-1.5 font-bold text-textMain">
          <MapPin size={13} className="text-rose-500" />
          {item.lokasi || '-'}
        </span>
      </td>

      <td className="table-cell">
        <span
          className={`
            inline-flex px-2.5 py-1 rounded-lg text-[10px] font-extrabold
            ${
              status === 'INBOUND'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-slate-100 text-slate-600'
            }
          `}
        >
          {status || '-'}
        </span>
      </td>

      <td className="table-cell">
        <div className="font-semibold text-textMain whitespace-nowrap">
          {formatDate(item.tanggal || item.timestamp_in)}
        </div>

        {item.user && (
          <div className="text-[10px] font-semibold text-textMuted mt-0.5">
            {item.user}
          </div>
        )}
      </td>
    </tr>
  );
}

function LoadingRows() {
  return Array.from({ length: 8 }).map((_, index) => (
    <tr key={index} className="border-b border-borderLight">
      {Array.from({ length: 11 }).map((__, cellIndex) => (
        <td key={cellIndex} className="px-4 py-4">
          <div className="h-4 bg-slate-100 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  ));
}

/* =========================================================
   HELPERS
========================================================= */

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function getTimestamp(value) {
  if (!value) return 0;

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'object' && value.seconds) {
    return value.seconds * 1000;
  }

  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
  if (!value) return '-';

  let date;

  if (typeof value === 'number') {
    date = new Date(value);
  } else if (typeof value === 'object' && value.seconds) {
    date = new Date(value.seconds * 1000);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
