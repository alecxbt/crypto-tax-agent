import { useState, useMemo } from 'react';
import type { MatchedDisposal } from '../types';
import { ChevronUp, ChevronDown, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  disposals: MatchedDisposal[];
}

type SortKey = keyof MatchedDisposal;

function fmtUSD(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date) {
  try { return format(d, 'MM/dd/yyyy'); } catch { return String(d); }
}

export function DisposalTable({ disposals }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('sellDate');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterAsset, setFilterAsset] = useState('');
  const [filterTerm, setFilterTerm] = useState<'all' | 'short' | 'long'>('all');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const assets = useMemo(() => [...new Set(disposals.map(d => d.asset))].sort(), [disposals]);

  const filtered = useMemo(() => {
    let d = disposals;
    if (filterAsset) d = d.filter(x => x.asset === filterAsset);
    if (filterTerm === 'short') d = d.filter(x => !x.isLongTerm);
    if (filterTerm === 'long') d = d.filter(x => x.isLongTerm);
    return d;
  }, [disposals, filterAsset, filterTerm]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va instanceof Date && vb instanceof Date) {
        return sortAsc ? va.getTime() - vb.getTime() : vb.getTime() - va.getTime();
      }
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortAsc ? va - vb : vb - va;
      }
      return sortAsc
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [filtered, sortKey, sortAsc]);

  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(sorted.length / pageSize);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp size={12} color="#ccc" />;
    return sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  }

  const headerStyle: React.CSSProperties = {
    padding: '10px 12px', fontWeight: 600, fontSize: 12,
    color: '#555', background: '#f5f5f5', cursor: 'pointer',
    userSelect: 'none', whiteSpace: 'nowrap',
    display: 'flex', alignItems: 'center', gap: 4,
  };

  const cellStyle: React.CSSProperties = {
    padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f0f0f0',
  };

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={14} color="#888" />
          <span style={{ fontSize: 13, color: '#888' }}>Filter:</span>
        </div>
        <select
          value={filterAsset}
          onChange={e => { setFilterAsset(e.target.value); setPage(0); }}
          style={{ fontSize: 13, padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd' }}
        >
          <option value="">All Assets</option>
          {assets.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'short', 'long'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setFilterTerm(t); setPage(0); }}
              style={{
                fontSize: 12, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                border: filterTerm === t ? '1px solid #4361ee' : '1px solid #ddd',
                background: filterTerm === t ? '#4361ee' : '#fff',
                color: filterTerm === t ? '#fff' : '#555',
                fontWeight: filterTerm === t ? 600 : 400,
              }}
            >
              {t === 'all' ? 'All' : t === 'short' ? 'Short-Term' : 'Long-Term'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>
          {sorted.length} disposals
        </span>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #e8e8e8' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              {([
                ['sellDate', 'Sell Date'],
                ['asset', 'Asset'],
                ['qtyDisposed', 'Qty'],
                ['totalProceeds', 'Proceeds'],
                ['acquiredDate', 'Acquired'],
                ['totalCostBasis', 'Cost Basis'],
                ['gainLoss', 'Gain / Loss'],
                ['holdingDays', 'Days Held'],
                ['sellExchange', 'Sell Venue'],
                ['buyExchange', 'Buy Venue'],
              ] as [SortKey, string][]).map(([key, label]) => (
                <th key={key} onClick={() => toggleSort(key)} style={{ ...headerStyle, textAlign: 'left' }}>
                  {label} <SortIcon k={key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((d, i) => (
              <tr key={d.disposalId} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={cellStyle}>{fmtDate(d.sellDate)}</td>
                <td style={{ ...cellStyle, fontWeight: 600 }}>{d.asset}</td>
                <td style={{ ...cellStyle, fontFamily: 'monospace' }}>{d.qtyDisposed.toFixed(8).replace(/\.?0+$/, '')}</td>
                <td style={cellStyle}>{fmtUSD(d.totalProceeds)}</td>
                <td style={cellStyle}>{fmtDate(d.acquiredDate)}</td>
                <td style={cellStyle}>{fmtUSD(d.totalCostBasis)}</td>
                <td style={{
                  ...cellStyle,
                  fontWeight: 700,
                  color: d.gainLoss >= 0 ? '#2d6a4f' : '#e63946',
                }}>
                  {d.gainLoss >= 0 ? '+' : ''}{fmtUSD(d.gainLoss)}
                </td>
                <td style={cellStyle}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                    background: d.isLongTerm ? '#e8f4f8' : '#fff3e0',
                    color: d.isLongTerm ? '#0077b6' : '#e85d04',
                  }}>
                    {d.holdingDays}d {d.isLongTerm ? 'LT' : 'ST'}
                  </span>
                </td>
                <td style={{ ...cellStyle, fontSize: 12, color: '#777', textTransform: 'uppercase' }}>{d.sellExchange}</td>
                <td style={{ ...cellStyle, fontSize: 12, color: '#777', textTransform: 'uppercase' }}>{d.buyExchange}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            style={{
              padding: '6px 16px', borderRadius: 8, border: '1px solid #ddd',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
              background: page === 0 ? '#f5f5f5' : '#fff',
            }}
          >
            Prev
          </button>
          <span style={{ padding: '6px 12px', fontSize: 13, color: '#555' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            disabled={page === totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            style={{
              padding: '6px 16px', borderRadius: 8, border: '1px solid #ddd',
              cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer',
              background: page === totalPages - 1 ? '#f5f5f5' : '#fff',
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
