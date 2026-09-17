import { useEffect, useMemo, useRef, useState } from 'react';
import type { ZoneKey } from '../../../shared/protocol.js';
import { SearchIcon } from './Icons';

type TabId = 'overview' | 'simulator' | 'ai' | 'developer';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  zones: Record<ZoneKey, boolean>;
  pendingZones: Set<ZoneKey>;
  onToggleZone: (zone: ZoneKey, desired: boolean) => void;
  protectionActive: boolean;
  restartTutorial: () => void;
}

interface Command {
  id: string;
  title: string;
  subtitle: string;
  group: string;
  shortcut?: string | undefined;
  run: () => void;
  disabled?: boolean;
}

export function CommandPalette({
  open,
  onClose,
  activeTab,
  onSelectTab,
  zones,
  pendingZones,
  onToggleZone,
  protectionActive,
  restartTutorial
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const tabs: { id: TabId; title: string; subtitle: string }[] = [
      { id: 'overview', title: 'Open Overview', subtitle: 'Live telemetry, savings, energy flow' },
      { id: 'simulator', title: 'Open 3D City Simulator', subtitle: 'Toggle zones and watch the miniature city' },
      { id: 'ai', title: 'Open AI Copilot', subtitle: 'Trends and advisory intelligence' },
      { id: 'developer', title: 'Open ESP32 Bridge', subtitle: 'Connect physical hardware' }
    ];
    const base: Command[] = tabs.map((tab) => ({
      id: `tab-${tab.id}`,
      title: tab.title,
      subtitle: tab.subtitle,
      group: 'Navigate',
      shortcut: tab.id === activeTab ? 'Active' : undefined,
      run: () => {
        onSelectTab(tab.id);
        onClose();
      }
    }));

    const zoneMeta: { key: ZoneKey; title: string; subtitle: string }[] = [
      { key: 'zone1', title: 'Toggle Zone 1 — Priority load', subtitle: 'Critical lighting / essential circuit' },
      { key: 'zone2', title: 'Toggle Zone 2 — Community zone', subtitle: 'Shared area or service circuit' },
      { key: 'zone3', title: 'Toggle Zone 3 — Utility load', subtitle: 'Pump, fan, or productive appliance' },
      { key: 'zone4', title: 'Toggle Zone 4 — Street line', subtitle: 'Outdoor or perimeter lighting' },
      { key: 'zone5', title: 'Toggle Zone 5 — Reserve output', subtitle: 'Flexible expansion circuit' }
    ];

    zoneMeta.forEach((zone) => {
      base.push({
        id: `toggle-${zone.key}`,
        title: zone.title,
        subtitle: zones[zone.key] ? 'Currently ON · click to switch OFF' : 'Currently OFF · click to switch ON',
        group: 'Zone controls',
        disabled: protectionActive || pendingZones.has(zone.key),
        run: () => {
          onToggleZone(zone.key, !zones[zone.key]);
          onClose();
        }
      });
    });

    base.push({
      id: 'tutorial',
      title: 'Restart interactive tour',
      subtitle: 'Re-open the guided onboarding overlay',
      group: 'Help',
      run: () => {
        restartTutorial();
        onClose();
      }
    });

    return base;
  }, [activeTab, zones, pendingZones, protectionActive, onSelectTab, onToggleZone, onClose, restartTutorial]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((command) =>
      command.title.toLowerCase().includes(q) ||
      command.subtitle.toLowerCase().includes(q) ||
      command.group.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const handleKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((value) => Math.min(filtered.length - 1, value + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((value) => Math.max(0, value - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = filtered[activeIndex];
      if (target && !target.disabled) target.run();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="palette-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="palette-panel" onClick={(event) => event.stopPropagation()}>
        <div className="palette-input">
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search zones, tabs, actions..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKey}
            aria-label="Command palette search"
          />
          <span className="palette-esc">ESC</span>
        </div>
        <ul className="palette-list" role="listbox">
          {filtered.length === 0 && <li className="palette-empty">No matching commands.</li>}
          {filtered.map((command, index) => (
            <li
              key={command.id}
              role="option"
              aria-selected={index === activeIndex}
              className={`palette-item ${index === activeIndex ? 'is-active' : ''} ${command.disabled ? 'is-disabled' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => !command.disabled && command.run()}
            >
              <div>
                <strong>{command.title}</strong>
                <span>{command.subtitle}</span>
              </div>
              <div className="palette-meta">
                <em>{command.group}</em>
                {command.shortcut && <kbd>{command.shortcut}</kbd>}
              </div>
            </li>
          ))}
        </ul>
        <footer className="palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Run</span>
          <span><kbd>Esc</kbd> Close</span>
        </footer>
      </div>
    </div>
  );
}