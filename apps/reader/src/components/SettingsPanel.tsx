import { useRef } from 'react';
import type { Persistence } from './DurabilityBanner';
import { useDismissable, useReturnFocus } from '../lib/focus';
import { TOOLS } from '../lib/webmcp';
import { useI18n } from '../i18n';
import { rich } from '../i18n/rich';
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
  const { t, fmt } = useI18n();
  const words = t.settings;
  const root = useRef<HTMLElement>(null);
  // Only mounted while open: Escape closes it, and focus returns to the chip
  // that opened it when it unmounts (2.4.3).
  useDismissable(true, onClose, root, { outside: false });
  useReturnFocus(true, '[data-testid="settings-open"]');

  return (
    <section ref={root} className="settings" id="settings-panel" data-testid="settings-panel" aria-label={words.title}>
      <header className="settings__bar">
        <h1 className="settings__title">{words.title}</h1>
        <button
          type="button"
          className="settings__close"
          data-testid="settings-close"
          onClick={onClose}
          aria-label={words.close}
        >
          ✕
        </button>
      </header>

      {/* Reading is the whole point, so how it reads comes first. Every choice
          here is a real <label> on a real <select>: a visible name, a native
          control, and nothing to relearn. */}
      <section className="settings__group">
        <h2 className="settings__heading">{words.display}</h2>
        <div className="settings__field">
          <label htmlFor="pref-theme">{words.colours}</label>
          <select
            id="pref-theme"
            data-testid="pref-theme"
            value={prefs.theme}
            onChange={(e) => onPrefs({ theme: e.target.value as Theme })}
          >
            {THEMES.map((t) => (
              <option key={t} value={t}>
                {words.themes[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="settings__field">
          <label htmlFor="pref-text-size">{words.textSize}</label>
          <select
            id="pref-text-size"
            data-testid="pref-text-size"
            value={prefs.textSize}
            onChange={(e) => onPrefs({ textSize: Number(e.target.value) as TextSize })}
          >
            {TEXT_SIZES.map((n) => (
              <option key={n} value={n}>
                {fmt.percent(n)}
              </option>
            ))}
          </select>
        </div>
        <div className="settings__field">
          <label htmlFor="pref-spacing">{words.spacing}</label>
          <select
            id="pref-spacing"
            data-testid="pref-spacing"
            value={prefs.spacing}
            onChange={(e) => onPrefs({ spacing: e.target.value as Spacing })}
          >
            {SPACINGS.map((sp) => (
              <option key={sp} value={sp}>
                {words.spacings[sp]}
              </option>
            ))}
          </select>
        </div>
        <div className="settings__field">
          <label htmlFor="pref-measure">{words.measure}</label>
          <select
            id="pref-measure"
            data-testid="pref-measure"
            value={prefs.measure}
            onChange={(e) => onPrefs({ measure: e.target.value as Measure })}
          >
            {MEASURES.map((m) => (
              <option key={m} value={m}>
                {words.measures[m]}
              </option>
            ))}
          </select>
        </div>
        <p className="settings__note">
          {words.displayNote}
        </p>
      </section>

      <section className="settings__group">
        <h2 className="settings__heading">{words.accessibility}</h2>
        <div className="settings__field">
          <label htmlFor="pref-motion">{words.motion}</label>
          <select
            id="pref-motion"
            data-testid="pref-motion"
            value={prefs.motion}
            onChange={(e) => onPrefs({ motion: e.target.value as Motion })}
          >
            {MOTIONS.map((m) => (
              <option key={m} value={m}>
                {words.motions[m]}
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
          <span>{words.markers}</span>
        </label>
      </section>

      <section className="settings__group">
        <h2 className="settings__heading">{words.storage}</h2>
        <p className="settings__body" data-testid="settings-persistence">
          {words.persistence[persistence]}
        </p>
        {storage && storage.quota > 0 && (
          <p className="settings__body">
            {words.usedOnDevice(fmt.bytes(storage.usage), fmt.bytes(storage.quota))}
          </p>
        )}
        <p className="settings__body">
          {mirroring ? words.mirrored : words.notMirrored}
        </p>
        <div className="settings__actions">
          <button type="button" className="settings__action" data-testid="settings-export" onClick={onExport}>
            {words.exportAll}
          </button>
          <button type="button" className="settings__action" onClick={onChooseFolder}>
            {mirroring ? words.anotherFolder : words.mirror}
          </button>
        </div>
      </section>

      <section className="settings__group">
        <h2 className="settings__heading">{words.assistant}</h2>
        <p className="settings__body">{rich(words.assistantIntro)}</p>

        <label className="settings__toggle">
          <input
            type="checkbox"
            data-testid="agent-toggle"
            checked={agentEnabled}
            onChange={(e) => onAgentToggle(e.target.checked)}
          />
          <span>{words.assistantToggle}</span>
        </label>

        {/* Said even when off, because "why is this greyed out" is the next
            question and the honest answer is that almost no browser has it. */}
        <p className="settings__note" data-testid="agent-support">
          {agentSupported ? words.assistantSupported : words.assistantUnsupported}
        </p>

        <p className="settings__body">{rich(words.assistantReadOnly)}</p>

        <details className="settings__tools">
          <summary>{words.assistantTools(TOOLS.length)}</summary>
          <ul role="list">
            {TOOLS.map((tool) => (
              <li key={tool.name}>
                <code>{tool.name}</code>{' '}
                <span className={tool.annotations.readOnlyHint ? 'settings__tag' : 'settings__tag settings__tag--write'}>
                  {tool.annotations.readOnlyHint ? words.toolReads : words.toolNeedsApproval}
                </span>
                <span className="settings__tool-desc">{tool.description}</span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      {onHelp && (
        <section className="settings__group">
          <h2 className="settings__heading">{words.help}</h2>
          <p className="settings__body">{words.helpIntro}</p>
          <div className="settings__actions">
            <button type="button" className="settings__action" data-testid="settings-help" onClick={onHelp}>
              {words.openHelp}
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
