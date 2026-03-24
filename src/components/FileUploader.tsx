import React, { useRef, useState } from 'react';
import { Upload, CheckCircle, AlertCircle, X } from 'lucide-react';
import type { Exchange, RawTransaction } from '../types';
import { parseCoinbaseCSV } from '../parsers/coinbase';
import { parseKrakenLedgerCSV, parseKrakenTradesCSV, detectKrakenFileType } from '../parsers/kraken';

interface Props {
  exchange: Exchange;
  transactions: RawTransaction[];
  onLoad: (txs: RawTransaction[]) => void;
  onClear: () => void;
}

export function FileUploader({ exchange, transactions, onLoad, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const label = exchange === 'coinbase' ? 'Coinbase' : 'Kraken';
  const color = exchange === 'coinbase' ? '#0052FF' : '#5741D9';
  const hint = exchange === 'coinbase'
    ? 'Transaction History CSV (from Reports > Statements)'
    : 'Ledger History or Trades CSV (from History > Export)';

  async function processFile(file: File) {
    setError(null);
    try {
      const text = await file.text();
      let txs: RawTransaction[];
      if (exchange === 'coinbase') {
        txs = parseCoinbaseCSV(text);
      } else {
        const fileType = detectKrakenFileType(text);
        txs = fileType === 'trades' ? parseKrakenTradesCSV(text) : parseKrakenLedgerCSV(text);
      }
      if (txs.length === 0) {
        // Show the first few lines so the user/dev can diagnose the format
        const preview = text.split('\n').slice(0, 4).join(' | ').slice(0, 300);
        setError(`No transactions found. Check the browser console (F12) for detected headers. File preview: ${preview}`);
        return;
      }
      onLoad(txs);
    } catch (e: any) {
      setError(`Parse error: ${e.message ?? 'Unknown error'}`);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  const hasData = transactions.length > 0;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: color, flexShrink: 0,
          }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
        </div>
        {hasData && (
          <button
            onClick={onClear}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#888', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
            }}
          >
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {!hasData ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          style={{
            border: `2px dashed ${dragging ? color : '#d0d0d0'}`,
            borderRadius: 12,
            padding: '24px 16px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? `${color}10` : '#fafafa',
            transition: 'all 0.2s',
          }}
        >
          <Upload size={24} color={color} style={{ margin: '0 auto 8px' }} />
          <p style={{ margin: 0, fontSize: 14, color: '#555', fontWeight: 500 }}>
            Drop CSV or click to browse
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>{hint}</p>
          <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={onFileChange} />
        </div>
      ) : (
        <div style={{
          border: '1px solid #d4edda', borderRadius: 12,
          padding: '12px 16px', background: '#f0faf3',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <CheckCircle size={20} color="#28a745" />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#1a7a3a' }}>
              {transactions.length} transactions loaded
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {[...new Set(transactions.map(t => t.asset))].slice(0, 6).join(', ')}
              {[...new Set(transactions.map(t => t.asset))].length > 6 ? ' ...' : ''}
            </div>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            style={{
              marginLeft: 'auto', fontSize: 12, color: color,
              background: 'none', border: `1px solid ${color}`,
              borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
            }}
          >
            Replace
          </button>
          <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={onFileChange} />
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 8, padding: '8px 12px', background: '#fff5f5',
          border: '1px solid #ffd0d0', borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#c0392b',
        }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
}
