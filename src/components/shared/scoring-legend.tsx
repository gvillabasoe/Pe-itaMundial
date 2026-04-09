import { PICK_STATE_META } from '@/lib/constants';
import type { PickStateTone } from '@/types/domain';

const orderedTones: PickStateTone[] = ['green', 'yellow', 'gold', 'silver', 'red', 'pending'];

export function ScoringLegend() {
  return (
    <section className="legendBlock" aria-labelledby="legend-title">
      <div className="legendHeader">
        <h2 id="legend-title" className="cardTitle">Sistema de puntuación</h2>
        <p className="cardSubtitle">Fuente única de verdad visual en toda la app.</p>
      </div>
      <div className="legendGrid">
        {orderedTones.map((tone) => (
          <div key={tone} className="legendItem">
            <span className={`legendDot ${PICK_STATE_META[tone].className}`} aria-hidden="true">
              {tone === 'pending' ? '?' : ''}
            </span>
            <span className="legendLabel">{PICK_STATE_META[tone].label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
