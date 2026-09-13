import { useRef } from 'react';
import type { Persistence } from './DurabilityBanner';
import { useDismissable, useReturnFocus } from '../lib/focus';
import { formatBytes } from '../lib/units';
import { TOOLS } from '../lib/webmcp';
import {
  MEASURES,
  MOTIONS,
  SPACINGS,
  TEXT_SIZES,
  THEMES,
  type DisplayPrefs,
  type Measure,
  type Motion,
  type Spacing,
  type TextSize,
  type Theme,
} from '../lib/prefs';

interface SettingsPanelProps {
  persistence: Persistence;
  mirroring: boolean;
  storage: { usage: number; quota: number } | null;
  agentSupported: boolean;
  agentEnabled: boolean;
  onAgentToggle: (enabled: boolean) => void;
  onChooseFolder: () => void;
  onExport: () => void;
  onClose: () => void;
  onHelp?: () => void;
  prefs: DisplayPrefs;
  onPrefs: (patch: Partial<DisplayPrefs>) => void;
}

const THEME_LABEL: Record<Theme, string> = {
  system: 'Follow the device',
  light: 'Light',
  dark: 'Dark',
  'hc-light': 'High contrast, light',
  'hc-dark': 'High contrast, dark',
  sepia: 'Sepia',
};
const SPACING_LABEL: Record<Spacing, string> = {
  normal: 'Normal',
  relaxed: 'Relaxed',
  loose: 'Loose',
};
const MEASURE_LABEL: Record<Measure, string> = {
  narrow: 'Narrow',
  normal: 'Normal',
  wide: 'Wide',
};
const MOTION_LABEL: Record<Motion, string> = {
  system: 'Follow the device',
  reduce: 'Reduce motion',
};

const PERSISTENCE_COPY: Record<Persistence, string> = {
  persisted: 'This browser has agreed to keep your notes. Clearing site data still removes them.',
  denied: 'This browser has not agreed to keep your notes. It may delete them to free up space.',
  unsupported: 'This browser will not say whether it keeps your notes. Assume it may delete them.',
  unknown: 'Checking…',
};

/**
 * What this device does with your work, and who else may see it.
 *
 * Both halves belong together: durability is what happens to your notes when
 * you are not looking, and the agent switch is who else may read them. Those
 * are the two questions a local-first app owes a plain answer to.
 */
export function SettingsPanel({
  persistence,
  mirroring,
  storage,
  agentSupported,
  agentEnabled,
  onAgentToggle,
  onChooseFolder,
  onExport,
  onClose,
  onHelp,
  prefs,
  onPrefs,
}: SettingsPanelProps) {
  const root = useRef<HTMLElement>(null);
  // Only mounted while open: Escape closes it, and focus returns to the chip
  // that opened it when it unmounts (2.4.3).
  useDismissable(true, onClose, root, { outside: false });
  useReturnFocus(true, '[data-testid="settings-open"]');

  return (
    <section ref={root} className="settings" id="settings-panel" data-testid="settings-panel" aria-label="Settings">
      <header className="settings__bar">
        <h1 className="settings__title">Settings</h1>
        <button
          type="button"
          className="settings__close"
          data-testid="settings-close"
          onClick={onClose}
          aria-label="Close settings"
        >
          ✕
        </button>
      </header>

      {/* Reading is the whole point, so how it reads comes first. Every choice
          here is a real <label> on a real <select>: a visible name, a native
          control, and nothing to relearn. */}
      <section className="settings__group">
        <h2 className="settings__heading">Reading &amp; display</h2>
        <div className="settings__field">
          <label htmlFor="pref-theme">Colours</label>
          <select
            id="pref-theme"
            data-testid="pref-theme"
            value={prefs.theme}
            onChange={(e) => onPrefs({ theme: e.target.value as Theme })}
          >
            {THEMES.map((t) => (
              <option key={t} value={t}>
                {THEME_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="settings__field">
          <label htmlFor="pref-text-size">Text size</label>
          <select
            id="pref-text-size"
            data-testid="pref-text-size"
            value={prefs.textSize}
            onChange={(e) => onPrefs({ textSize: Number(e.target.value) as TextSize })}
          >
            {TEXT_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}%
              </option>
            ))}
          </select>
        </div>
        <div className="settings__field">
          <label htmlFor="pref-spacing">Line spacing</label>
          <select
            id="pref-spacing"
            data-testid="pref-spacing"
            value={prefs.spacing}
            onChange={(e) => onPrefs({ spacing: e.target.value as Spacing })}
          >
            {SPACINGS.map((sp) => (
              <option key={sp} value={sp}>
                {SPACING_LABEL[sp]}
              </option>
            ))}
          </select>
        </div>
        <div className="settings__field">
          <label htmlFor="pref-measure">Column width</label>
          <select
            id="pref-measure"
            data-testid="pref-measure"
            value={prefs.measure}
            onChange={(e) => onPrefs({ measure: e.target.value as Measure })}
          >
            {MEASURES.map((m) => (
              <option key={m} value={m}>
                {MEASURE_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <p className="settings__note">
          Relaxed and Loose spacing meet the WCAG guidance for line and paragraph spacing.
          These settings apply to this device only.
        </p>
      </section>

      <section className="settings__group">
        <h2 className="settings__heading">Accessibility</h2>
        <div className="settings__field">
          <label htmlFor="pref-motion">Motion</label>
          <select
            id="pref-motion"
            data-testid="pref-motion"
            value={prefs.motion}
            onChange={(e) => onPrefs({ motion: e.target.value as Motion })}
          >
            {MOTIONS.map((m) => (
              <option key={m} value={m}>
                {MOTION_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <label className="settings__toggle">
          <input
            type="checkbox"
            data-testid="pref-markers"
            checked={prefs.markers}
            onChange={(e) => onPrefs({ markers: e.target.checked })}
          />
          <span>Show a symbol on every highlight, not only a colour</span>
        </label>
      </section>

      <section className="settings__group">
        <h2 className="settings__heading">Where your work lives</h2>
        <p className="settings__body" data-testid="settings-persistence">
          {PERSISTENCE_COPY[persistence]}
        </p>
        {storage && storage.quota > 0 && (
          <p className="settings__body">
            {formatBytes(storage.usage)} of {formatBytes(storage.quota)} used on this device.
          </p>
        )}
        <p className="settings__body">
          {mirroring
            ? 'Your notes are also saved to a folder you chose.'
            : 'Your notes live only in this browser. Export them, or save a copy to a folder, to keep them safe.'}
        </p>
        <div className="settings__actions">
          <button type="button" className="settings__action" data-testid="settings-export" onClick={onExport}>
            Export everything
          </button>
          <button type="button" className="settings__action" onClick={onChooseFolder}>
            {mirroring ? 'Choose another folder' : 'Mirror to a folder'}
          </button>
        </div>
      </section>

      <section className="settings__group">
        <h2 className="settings__heading">Assistant access</h2>
        <p className="settings__body">
          An AI assistant running in this browser can read your library and draft notes or marks
          for you. This is <strong>off</strong> until you turn it on. Nothing is sent to Scriptura:
          the assistant runs in your browser and reads the same data the app does.
        </p>

        <label className="settings__toggle">
          <input
            type="checkbox"
            data-testid="agent-toggle"
            checked={agentEnabled}
            onChange={(e) => onAgentToggle(e.target.checked)}
          />
          <span>Offer Scriptura&rsquo;s tools to an assistant</span>
        </label>

        {/* Said even when off, because "why is this greyed out" is the next
            question and the honest answer is that almost no browser has it. */}
        <p className="settings__note" data-testid="agent-support">
          {agentSupported
            ? 'This browser supports assistant tools.'
            : 'This browser does not support assistant tools yet — WebMCP is an early draft, available in Chrome behind a flag. The switch is remembered for when it does.'}
        </p>

        <p className="settings__body">
          <strong>It can read, not write.</strong> An assistant can read your notes, marks and
          passages, but it cannot change anything. Anything it wants to add is shown to you in
          full first, and is saved only when you accept it.
        </p>

        <details className="settings__tools">
          <summary>What an assistant would be able to do ({TOOLS.length} tools)</summary>
          <ul role="list">
            {TOOLS.map((tool) => (
              <li key={tool.name}>
                <code>{tool.name}</code>{' '}
                <span className={tool.annotations.readOnlyHint ? 'settings__tag' : 'settings__tag settings__tag--write'}>
                  {tool.annotations.readOnlyHint ? 'reads' : 'needs your approval'}
                </span>
                <span className="settings__tool-desc">{tool.description}</span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      {onHelp && (
        <section className="settings__group">
          <h2 className="settings__heading">Help</h2>
          <p className="settings__body">
            How to find a passage, search, write notes, mark verses and use boards; what the
            abbreviations mean; and what this app promises about accessibility.
          </p>
          <div className="settings__actions">
            <button type="button" className="settings__action" data-testid="settings-help" onClick={onHelp}>
              Open help
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
