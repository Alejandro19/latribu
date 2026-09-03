'use client';

import SegmentedControl from '@/components/ui/SegmentedControl';

const SCALE_OPTIONS = ['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }));

export function ScaleQuestion({
  question,
  minLabel,
  maxLabel,
  value,
  onChange,
}: {
  question: string;
  minLabel: string;
  maxLabel: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <span className="font-body" style={{ fontSize: 16, color: 'var(--eph-body)' }}>{question}</span>
      <SegmentedControl options={SCALE_OPTIONS} value={value} onChange={onChange} />
      <div className="flex justify-between font-mono" style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--eph-faint)' }}>
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

export default ScaleQuestion;
