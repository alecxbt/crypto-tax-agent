import type { ScenarioResult, AccountingMethod } from '../types';

interface Props {
  scenario: ScenarioResult;
  isActive: boolean;
  onClick: () => void;
  isBest: boolean;
  label: string;
}

const METHOD_INFO: Record<AccountingMethod, { title: string; desc: string; color: string }> = {
  FIFO: {
    title: 'FIFO',
    desc: 'First In, First Out — oldest lots sold first',
    color: '#4361ee',
  },
  LIFO: {
    title: 'LIFO',
    desc: 'Last In, First Out — newest lots sold first',
    color: '#7209b7',
  },
  HIFO: {
    title: 'HIFO',
    desc: 'Highest In, First Out — sells highest-cost lots first (minimizes gains)',
    color: '#3a0ca3',
  },
  SPECIFIC_ID: {
    title: 'Specific ID',
    desc: 'Identify specific lots — same as HIFO in auto mode',
    color: '#560bad',
  },
};

function fmtUSD(n: number) {
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  return sign + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ScenarioCard({ scenario, isActive, onClick, isBest, label }: Props) {
  const { method, summary: s } = scenario;
  const info = METHOD_INFO[method];
  const isGain = s.netTotal > 0;
  const isLoss = s.netTotal < 0;

  return (
    <div
      onClick={onClick}
      style={{
        border: isActive ? `2px solid ${info.color}` : '2px solid #e8e8e8',
        borderRadius: 16,
        padding: '20px',
        cursor: 'pointer',
        background: isActive ? `${info.color}08` : '#fff',
        position: 'relative',
        transition: 'all 0.2s',
        boxShadow: isActive ? `0 4px 20px ${info.color}30` : '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      {isBest && (
        <div style={{
          position: 'absolute', top: -10, right: 16,
          background: '#28a745', color: '#fff',
          fontSize: 11, fontWeight: 700, padding: '3px 10px',
          borderRadius: 20, letterSpacing: 0.5,
        }}>
          {label}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: info.color }}>{info.title}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{info.desc}</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: isLoss ? '#e63946' : isGain ? '#2d6a4f' : '#555' }}>
          {fmtUSD(s.netTotal)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: '#fff8f0', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Short-Term</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: s.netShortTerm >= 0 ? '#e85d04' : '#2d6a4f' }}>
            {fmtUSD(s.netShortTerm)}
          </div>
          <div style={{ fontSize: 11, color: '#aaa' }}>
            +{fmtUSD(s.shortTermGain)} / -{fmtUSD(s.shortTermLoss)}
          </div>
        </div>
        <div style={{ background: '#f0f8ff', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Long-Term</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: s.netLongTerm >= 0 ? '#2196f3' : '#2d6a4f' }}>
            {fmtUSD(s.netLongTerm)}
          </div>
          <div style={{ fontSize: 11, color: '#aaa' }}>
            +{fmtUSD(s.longTermGain)} / -{fmtUSD(s.longTermLoss)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 12, color: '#777' }}>
        <span>Proceeds: ${s.totalProceeds.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
        <span>Basis: ${s.totalCostBasis.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
        <span>{s.disposals.length} disposals</span>
      </div>
    </div>
  );
}
