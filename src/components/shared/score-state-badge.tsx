import { PICK_STATE_META } from '@/lib/constants';
import type { PickStateTone } from '@/types/domain';

interface ScoreStateBadgeProps {
  tone: PickStateTone;
  compact?: boolean;
}

export function ScoreStateBadge({ tone, compact = false }: ScoreStateBadgeProps) {
  const meta = PICK_STATE_META[tone];

  return (
    <span
      className={`scoreStateBadge ${meta.className} ${compact ? 'scoreStateBadgeCompact' : ''}`.trim()}
      aria-label={meta.label}
      title={meta.label}
    >
      {compact ? meta.shortLabel : meta.label}
    </span>
  );
}
