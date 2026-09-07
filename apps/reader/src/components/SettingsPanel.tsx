import type { Persistence } from './DurabilityBanner';
import { formatBytes } from '../lib/units';
import { TOOLS } from '../lib/webmcp';

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
}

const PERSISTENCE_COPY: Record<Persistence, string> = {
  persisted: 'The browser has agreed to keep this data. Clearing site data still removes it.',
  denied: 'The browser has NOT agreed to keep this data — it can be cleared automatically to reclaim space.',
  unsupported: 'This browser will not say whether it keeps data. Assume it can be cleared.',
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
}: SettingsPanelProps) {
  return (
    <section className="settings" data-testid="settings-panel" aria-label="Settings">
      <header className="settings__bar">
        <h2 className="settings__title">Settings</h2>
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

      <section className="settings__group">
        <h3 className="settings__heading">Where your work lives</h3>
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
            ? 'Notes are also being written to a folder you chose.'
            : 'Notes live only in this browser unless you export them or mirror them to a folder.'}
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
        <h3 className="settings__heading">Assistant access</h3>
        <p className="settings__body">
          Scriptura can offer itself to an AI assistant running in this browser, so it can read
          your library and draft things for you. It is <strong>off</strong> until you turn it on,
          and nothing is ever sent to Scriptura&rsquo;s servers — the assistant runs in your browser
          and reads the same local data the app does.
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
          <strong>Reading is answered; writing is not.</strong> An assistant can read your notes,
          marks and passages, but it cannot change anything. Anything it wants to write — a note,
          a set of highlights — is shown to you in full first, and takes effect only when you
          accept it.
        </p>

        <details className="settings__tools">
          <summary>What an assistant would be able to do ({TOOLS.length} tools)</summary>
          <ul>
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
    </section>
  );
}
