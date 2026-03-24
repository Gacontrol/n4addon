import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

export interface SequenceWidgetConfig {
  seqName?: string;
  normalColor?: string;
  activeColor?: string;
  widgetSize?: 'small' | 'medium' | 'large';
}

interface SequenceParams {
  seqName?: string;
  seqCount?: number;
  seq1Name?: string; seq1MinIn?: number; seq1MaxIn?: number; seq1MinOut?: number; seq1MaxOut?: number; seq1Enable?: boolean; seq1Reverse?: boolean;
  seq2Name?: string; seq2MinIn?: number; seq2MaxIn?: number; seq2MinOut?: number; seq2MaxOut?: number; seq2Enable?: boolean; seq2Reverse?: boolean;
  seq3Name?: string; seq3MinIn?: number; seq3MaxIn?: number; seq3MinOut?: number; seq3MaxOut?: number; seq3Enable?: boolean; seq3Reverse?: boolean;
  seq4Name?: string; seq4MinIn?: number; seq4MaxIn?: number; seq4MinOut?: number; seq4MaxOut?: number; seq4Enable?: boolean; seq4Reverse?: boolean;
  seq5Name?: string; seq5MinIn?: number; seq5MaxIn?: number; seq5MinOut?: number; seq5MaxOut?: number; seq5Enable?: boolean; seq5Reverse?: boolean;
  seq6Name?: string; seq6MinIn?: number; seq6MaxIn?: number; seq6MinOut?: number; seq6MaxOut?: number; seq6Enable?: boolean; seq6Reverse?: boolean;
}

interface SequenceValues {
  input: number;
  outputs: number[];
  seqStatus?: Array<{ active: boolean; locked: boolean; reverse: boolean; paramError: boolean; inRange: boolean }>;
  error?: boolean;
}

interface VisuSequenceProps {
  config: SequenceWidgetConfig;
  value: SequenceValues | null;
  isEditMode: boolean;
  onValueChange?: (updates: Record<string, unknown>) => void;
  params?: SequenceParams;
}

const SEQ_COLORS = [
  '#0ea5e9',
  '#f97316',
  '#22c55e',
  '#a855f7',
  '#ec4899',
  '#eab308'
];

const SEQ_COLORS_DIMMED = [
  '#0ea5e920',
  '#f9731620',
  '#22c55e20',
  '#a855f720',
  '#ec489920',
  '#eab30820'
];

function getSeqData(params: SequenceParams | undefined, i: number) {
  const n = i + 1;
  return {
    name: (params as Record<string, unknown>)?.[`seq${n}Name`] as string ?? `Sequenz ${n}`,
    minIn: Number((params as Record<string, unknown>)?.[`seq${n}MinIn`] ?? 0),
    maxIn: Number((params as Record<string, unknown>)?.[`seq${n}MaxIn`] ?? 100),
    minOut: Number((params as Record<string, unknown>)?.[`seq${n}MinOut`] ?? 0),
    maxOut: Number((params as Record<string, unknown>)?.[`seq${n}MaxOut`] ?? 100),
    enable: (params as Record<string, unknown>)?.[`seq${n}Enable`] !== false,
    reverse: (params as Record<string, unknown>)?.[`seq${n}Reverse`] === true,
  };
}

const SequenceChart: React.FC<{
  params: SequenceParams | undefined;
  seqCount: number;
  inputVal: number;
  outputs: number[];
  seqStatus?: Array<{ active: boolean; locked: boolean; reverse: boolean; paramError: boolean; inRange: boolean }>;
  width?: number;
  height?: number;
  mini?: boolean;
}> = ({ params, seqCount, inputVal, outputs, seqStatus, width = 280, height = 180, mini = false }) => {
  const padL = mini ? 20 : 32;
  const padR = mini ? 6 : 12;
  const padT = mini ? 6 : 14;
  const padB = mini ? 16 : 24;
  const cw = width - padL - padR;
  const ch = height - padT - padB;

  const toX = (v: number) => padL + (v / 100) * cw;
  const toY = (v: number) => padT + ch - (v / 100) * ch;

  const cursorX = toX(inputVal ?? 0);

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {!mini && (
        <>
          <line x1={padL} y1={padT} x2={padL} y2={padT + ch} stroke="#334155" strokeWidth={1} />
          <line x1={padL} y1={padT + ch} x2={padL + cw} y2={padT + ch} stroke="#334155" strokeWidth={1} />
          {[0, 25, 50, 75, 100].map(v => (
            <g key={v}>
              <line x1={padL} y1={toY(v)} x2={padL + cw} y2={toY(v)} stroke="#1e293b" strokeWidth={1} />
              <text x={padL - 3} y={toY(v) + 3} fontSize={8} fill="#475569" textAnchor="end">{v}</text>
              <line x1={toX(v)} y1={padT} x2={toX(v)} y2={padT + ch} stroke="#1e293b" strokeWidth={1} />
              <text x={toX(v)} y={padT + ch + 10} fontSize={8} fill="#475569" textAnchor="middle">{v}</text>
            </g>
          ))}
        </>
      )}
      {mini && (
        <>
          <line x1={padL} y1={padT} x2={padL} y2={padT + ch} stroke="#334155" strokeWidth={0.5} />
          <line x1={padL} y1={padT + ch} x2={padL + cw} y2={padT + ch} stroke="#334155" strokeWidth={0.5} />
          {[0, 50, 100].map(v => (
            <g key={v}>
              <line x1={padL} y1={toY(v)} x2={padL + cw} y2={toY(v)} stroke="#1e293b" strokeWidth={0.5} />
              <line x1={toX(v)} y1={padT} x2={toX(v)} y2={padT + ch} stroke="#1e293b" strokeWidth={0.5} />
            </g>
          ))}
          <text x={padL - 2} y={toY(0) + 3} fontSize={7} fill="#475569" textAnchor="end">0</text>
          <text x={padL - 2} y={toY(100) + 3} fontSize={7} fill="#475569" textAnchor="end">100</text>
          <text x={toX(0)} y={padT + ch + 9} fontSize={7} fill="#475569" textAnchor="middle">0</text>
          <text x={toX(100)} y={padT + ch + 9} fontSize={7} fill="#475569" textAnchor="middle">100</text>
        </>
      )}

      {Array.from({ length: seqCount }).map((_, i) => {
        const seq = getSeqData(params, i);
        const status = seqStatus?.[i];
        const locked = status?.locked ?? false;
        const paramError = status?.paramError ?? (seq.maxIn <= seq.minIn);
        const disabled = !seq.enable || locked || paramError;
        const color = SEQ_COLORS[i % SEQ_COLORS.length];
        const opacity = disabled ? 0.25 : 1;

        const x1 = toX(seq.minIn);
        const x2 = toX(seq.maxIn);
        const y1Start = toY(seq.reverse ? seq.maxOut : seq.minOut);
        const y1End = toY(seq.reverse ? seq.minOut : seq.maxOut);

        return (
          <g key={i} opacity={opacity}>
            <line x1={padL} y1={y1Start} x2={x1} y2={y1Start} stroke={color} strokeWidth={mini ? 1.5 : 2} strokeDasharray={disabled ? '3,2' : undefined} />
            <line x1={x1} y1={y1Start} x2={x2} y2={y1End} stroke={color} strokeWidth={mini ? 1.5 : 2.5} strokeDasharray={disabled ? '3,2' : undefined} />
            <line x1={x2} y1={y1End} x2={padL + cw} y2={y1End} stroke={color} strokeWidth={mini ? 1.5 : 2} strokeDasharray={disabled ? '3,2' : undefined} />
            {!mini && (
              <>
                <circle cx={x1} cy={y1Start} r={3} fill={color} opacity={0.8} />
                <circle cx={x2} cy={y1End} r={3} fill={color} opacity={0.8} />
              </>
            )}
          </g>
        );
      })}

      <line x1={cursorX} y1={padT} x2={cursorX} y2={padT + ch} stroke="#f8fafc" strokeWidth={mini ? 1 : 1.5} strokeDasharray="4,2" opacity={0.7} />

      {Array.from({ length: seqCount }).map((_, i) => {
        const outputY = toY(outputs[i] ?? 0);
        const color = SEQ_COLORS[i % SEQ_COLORS.length];
        const status = seqStatus?.[i];
        const disabled = !status?.active || status?.locked || status?.paramError;
        if (disabled) return null;
        return (
          <circle key={i} cx={cursorX} cy={outputY} r={mini ? 2 : 3.5} fill={color} stroke="#0f172a" strokeWidth={1} />
        );
      })}
    </svg>
  );
};

export const VisuSequence: React.FC<VisuSequenceProps> = ({
  config,
  value,
  isEditMode,
  onValueChange,
  params
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [showParams, setShowParams] = useState(false);
  const [localParams, setLocalParams] = useState<SequenceParams>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });

  const seqCount = Math.max(1, Math.min(6, params?.seqCount ?? 3));
  const inputVal = value?.input ?? 0;
  const outputs = value?.outputs ?? [0, 0, 0, 0, 0, 0];
  const seqStatus = value?.seqStatus;
  const hasError = value?.error ?? false;
  const name = config.seqName ?? params?.seqName ?? '';

  useEffect(() => {
    if (params) setLocalParams({ ...params });
  }, [params]);

  const handleOpen = useCallback(() => {
    if (isEditMode) return;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const popupW = 560;
      const popupH = 520;
      let left = rect.left + rect.width / 2 - popupW / 2;
      let top = rect.top + rect.height / 2 - popupH / 2;
      left = Math.max(8, Math.min(window.innerWidth - popupW - 8, left));
      top = Math.max(8, Math.min(window.innerHeight - popupH - 8, top));
      setPopupPos({ top, left });
    }
    setShowPopup(true);
  }, [isEditMode]);

  const handleParamChange = useCallback((key: string, val: unknown) => {
    setLocalParams(prev => ({ ...prev, [key]: val }));
    onValueChange?.({ [key]: val });
  }, [onValueChange]);

  const activeColor = config.activeColor ?? '#0d9488';
  const normalColor = config.normalColor ?? '#64748b';

  const activeSeqCount = Array.from({ length: seqCount }).filter((_, i) => {
    return seqStatus ? seqStatus[i]?.inRange : false;
  }).length;

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center" style={{ cursor: isEditMode ? 'default' : 'pointer' }} onClick={handleOpen}>
      <div className="w-full h-full flex flex-col" style={{ padding: '4px' }}>
        <div className="flex items-center justify-between mb-1" style={{ minHeight: 16 }}>
          <span className="truncate font-semibold" style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {name || 'Sequenz'}
          </span>
          <div className="flex items-center gap-1">
            {hasError && <AlertTriangle style={{ width: 10, height: 10, color: '#ef4444' }} />}
            <span style={{ fontSize: 9, color: activeColor, fontWeight: 700 }}>{inputVal.toFixed(1)}%</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center" style={{ minHeight: 0 }}>
          <SequenceChart
            params={params}
            seqCount={seqCount}
            inputVal={inputVal}
            outputs={outputs}
            seqStatus={seqStatus}
            width={140}
            height={80}
            mini={true}
          />
        </div>
        <div className="flex justify-between mt-1">
          {Array.from({ length: Math.min(seqCount, 6) }).map((_, i) => {
            const seq = getSeqData(params, i);
            const status = seqStatus?.[i];
            const active = status?.inRange ?? false;
            const locked = status?.locked ?? false;
            const color = SEQ_COLORS[i % SEQ_COLORS.length];
            return (
              <div key={i} className="flex flex-col items-center" style={{ flex: 1 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: active ? color : (locked ? '#ef444460' : '#1e293b'),
                  border: `1px solid ${color}`,
                  marginBottom: 1
                }} />
                <span style={{ fontSize: 7, color: active ? color : '#475569', fontWeight: active ? 700 : 400 }}>
                  {outputs[i]?.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {showPopup && !isEditMode && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          onMouseDown={e => e.target === e.currentTarget && setShowPopup(false)}
        >
          <div
            style={{
              position: 'absolute',
              top: popupPos.top,
              left: popupPos.left,
              width: 560,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(13,148,136,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{name || 'Sequenzbaustein'}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Eingang: {inputVal.toFixed(1)} %</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setShowParams(p => !p)}
                  style={{ width: 28, height: 28, borderRadius: 6, background: showParams ? 'rgba(13,148,136,0.2)' : 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Settings style={{ width: 14, height: 14, color: showParams ? activeColor : '#94a3b8' }} />
                </button>
                <button
                  onClick={() => setShowPopup(false)}
                  style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X style={{ width: 14, height: 14, color: '#94a3b8' }} />
                </button>
              </div>
            </div>

            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <SequenceChart
                  params={localParams}
                  seqCount={seqCount}
                  inputVal={inputVal}
                  outputs={outputs}
                  seqStatus={seqStatus}
                  width={520}
                  height={200}
                  mini={false}
                />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, justifyContent: 'center' }}>
                {Array.from({ length: seqCount }).map((_, i) => {
                  const seq = getSeqData(localParams, i);
                  const status = seqStatus?.[i];
                  const inRange = status?.inRange ?? false;
                  const locked = status?.locked ?? false;
                  const paramErr = status?.paramError ?? (seq.maxIn <= seq.minIn);
                  const color = SEQ_COLORS[i % SEQ_COLORS.length];
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, background: inRange ? `${color}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${inRange ? color : 'rgba(255,255,255,0.08)'}` }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, opacity: locked ? 0.3 : 1 }} />
                      <span style={{ fontSize: 10, color: inRange ? color : '#64748b', fontWeight: inRange ? 700 : 400 }}>
                        {seq.name}
                      </span>
                      {locked && <span style={{ fontSize: 9, color: '#ef4444' }}>GESPERRT</span>}
                      {paramErr && <AlertTriangle style={{ width: 9, height: 9, color: '#ef4444' }} />}
                      {!locked && !paramErr && seq.enable && (
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>{outputs[i]?.toFixed(1)}%</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                {Array.from({ length: seqCount }).map((_, i) => {
                  const status = seqStatus?.[i];
                  const color = SEQ_COLORS[i % SEQ_COLORS.length];
                  const seq = getSeqData(localParams, i);
                  const locked = status?.locked ?? false;
                  const paramErr = status?.paramError ?? (seq.maxIn <= seq.minIn);
                  const inRange = status?.inRange ?? false;
                  return (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '6px 8px', border: `1px solid ${inRange ? color + '44' : 'rgba(255,255,255,0.06)'}` }}>
                      <div style={{ fontSize: 9, color, fontWeight: 700, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{seq.name}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: locked ? '#ef4444' : (paramErr ? '#f59e0b' : (seq.enable ? '#f1f5f9' : '#475569')), marginBottom: 2 }}>
                        {locked ? 'GESP.' : (paramErr ? 'FEHLER' : (seq.enable ? `${outputs[i]?.toFixed(1)}%` : 'DEAKT.'))}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <StatusDot label="Aktiv" active={seq.enable && !locked && !paramErr} />
                        <StatusDot label="Wirkber." active={inRange} color={color} />
                        <StatusDot label="Reverse" active={seq.reverse} color="#a855f7" />
                        <StatusDot label="Sperre" active={locked} color="#ef4444" />
                        <StatusDot label="Fehler" active={paramErr} color="#f59e0b" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {showParams && (
              <div style={{ padding: '10px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Parametrierung</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Anzahl Sequenzen:</span>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <button
                        key={n}
                        onClick={() => handleParamChange('seqCount', n)}
                        style={{
                          width: 24, height: 24, borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                          background: seqCount === n ? activeColor : 'rgba(255,255,255,0.06)',
                          color: seqCount === n ? '#fff' : '#94a3b8'
                        }}
                      >{n}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Array.from({ length: seqCount }).map((_, i) => {
                    const n = i + 1;
                    const seq = getSeqData(localParams, i);
                    const color = SEQ_COLORS[i % SEQ_COLORS.length];
                    const paramErr = seq.maxIn <= seq.minIn;
                    return (
                      <SeqParamRow
                        key={i}
                        index={i}
                        color={color}
                        seq={seq}
                        paramErr={paramErr}
                        onChange={(key, val) => handleParamChange(`seq${n}${key}`, val)}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const StatusDot: React.FC<{ label: string; active: boolean; color?: string }> = ({ label, active, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
    <div style={{ width: 5, height: 5, borderRadius: '50%', background: active ? (color ?? '#22c55e') : '#1e293b', border: active ? 'none' : '1px solid #334155', flexShrink: 0 }} />
    <span style={{ fontSize: 8, color: active ? '#94a3b8' : '#334155' }}>{label}</span>
  </div>
);

interface SeqParamRowProps {
  index: number;
  color: string;
  seq: ReturnType<typeof getSeqData>;
  paramErr: boolean;
  onChange: (key: string, val: unknown) => void;
}

const SeqParamRow: React.FC<SeqParamRowProps> = ({ index, color, seq, paramErr, onChange }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: `1px solid ${paramErr ? '#ef444440' : 'rgba(255,255,255,0.05)'}`, overflow: 'hidden' }}>
      <div
        onClick={() => setExpanded(p => !p)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
          <input
            value={seq.name}
            onChange={e => { e.stopPropagation(); onChange('Name', e.target.value); }}
            onClick={e => e.stopPropagation()}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#f1f5f9', fontSize: 11, fontWeight: 600, width: 100 }}
          />
          {paramErr && <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>PARAMETERFEHLER</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ToggleBtn label="Aktiv" value={seq.enable} onChange={v => onChange('Enable', v)} color={color} />
          <ToggleBtn label="Reverse" value={seq.reverse} onChange={v => onChange('Reverse', v)} color="#a855f7" />
          {expanded ? <ChevronUp style={{ width: 12, height: 12, color: '#475569' }} /> : <ChevronDown style={{ width: 12, height: 12, color: '#475569' }} />}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '6px 10px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px 10px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <ParamField label="Min Eingang" value={seq.minIn} onChange={v => onChange('MinIn', v)} unit="%" error={paramErr} />
          <ParamField label="Max Eingang" value={seq.maxIn} onChange={v => onChange('MaxIn', v)} unit="%" error={paramErr} />
          <ParamField label="Min Ausgang" value={seq.minOut} onChange={v => onChange('MinOut', v)} unit="%" />
          <ParamField label="Max Ausgang" value={seq.maxOut} onChange={v => onChange('MaxOut', v)} unit="%" />
        </div>
      )}
    </div>
  );
};

const ToggleBtn: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void; color: string }> = ({ label, value, onChange, color }) => (
  <button
    onClick={e => { e.stopPropagation(); onChange(!value); }}
    style={{
      padding: '2px 7px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 700,
      background: value ? `${color}30` : 'rgba(255,255,255,0.05)',
      color: value ? color : '#475569'
    }}
  >{label}</button>
);

const ParamField: React.FC<{ label: string; value: number; onChange: (v: number) => void; unit?: string; error?: boolean }> = ({ label, value, onChange, unit, error }) => (
  <div>
    <div style={{ fontSize: 9, color: '#475569', marginBottom: 2 }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${error ? '#ef444460' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 4, padding: '3px 6px', fontSize: 11, color: '#f1f5f9', outline: 'none'
        }}
      />
      {unit && <span style={{ fontSize: 9, color: '#475569', whiteSpace: 'nowrap' }}>{unit}</span>}
    </div>
  </div>
);
