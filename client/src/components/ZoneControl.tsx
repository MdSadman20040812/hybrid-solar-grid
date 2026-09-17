import type { ZoneKey } from '../../../shared/protocol.js';
import { LockIcon, PowerIcon } from './Icons';

interface ZoneControlProps {
  zone: ZoneKey;
  label: string;
  description: string;
  active: boolean;
  pending: boolean;
  disabled: boolean;
  disabledReason: string;
  onToggle: (zone: ZoneKey, desiredState: boolean) => void;
}

export function ZoneControl({ zone, label, description, active, pending, disabled, disabledReason, onToggle }: ZoneControlProps) {
  const stateText = pending ? 'Pending' : active ? 'On' : 'Off';
  return (
    <article className={`zone-card ${active ? 'zone-card--active' : ''} ${pending ? 'zone-card--pending' : ''}`}>
      <div className="zone-number">{zone.replace('zone', '').padStart(2, '0')}</div>
      <div className="zone-copy">
        <h3>{label}</h3>
        <p>{description}</p>
      </div>
      <div className="zone-action">
        <span className={`zone-state ${active ? 'zone-state--active' : ''}`}>{stateText}</span>
        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={active}
          aria-label={`${active ? 'Turn off' : 'Turn on'} ${label}`}
          aria-describedby={disabled ? `${zone}-reason` : undefined}
          disabled={disabled || pending}
          onClick={() => onToggle(zone, !active)}
        >
          <span className="switch-track"><span className="switch-thumb"><PowerIcon /></span></span>
        </button>
      </div>
      {disabled && (
        <div className="zone-disabled" id={`${zone}-reason`}><LockIcon />{disabledReason}</div>
      )}
    </article>
  );
}
