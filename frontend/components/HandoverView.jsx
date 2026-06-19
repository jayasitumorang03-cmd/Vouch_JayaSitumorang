'use client';

import { useState } from 'react';

// ─── section colour config ───────────────────────────────────────────────────

const SECTION_CONFIG = {
  urgent_actions: {
    label: '🚨 Urgent — Action Now',
    bg: 'bg-red-50',
    border: 'border-red-300',
    badge: 'bg-red-100 text-red-800',
    empty: null,
  },
  pending_actions: {
    label: '⚡ Pending — Today',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    badge: 'bg-amber-100 text-amber-800',
    empty: null,
  },
  fyi_items: {
    label: '📋 FYI',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    empty: '— Nothing to note —',
  },
};

// ─── Source citation ─────────────────────────────────────────────────────────

function SourceBadge({ source }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 ml-1"
      >
        {source.id}
      </button>
      {open && (
        <span
          className="absolute z-10 bottom-full left-0 mb-1 w-72 p-2 bg-gray-800 text-white text-xs
                     rounded shadow-lg whitespace-normal"
        >
          &ldquo;{source.excerpt}&rdquo;
        </span>
      )}
    </span>
  );
}

// ─── Single action item card ─────────────────────────────────────────────────

function ActionCard({ item, bgClass, borderClass }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`p-4 rounded-lg border ${bgClass} ${borderClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-semibold text-sm text-gray-900">
            {item.room && (
              <span className="mr-2 px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-mono">
                Rm {item.room}
              </span>
            )}
            {item.summary}
          </p>
          {item.details && item.details !== item.summary && (
            <>
              {!expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="mt-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  ▸ Show details
                </button>
              )}
              {expanded && (
                <p className="mt-2 text-sm text-gray-700 leading-relaxed">{item.details}</p>
              )}
            </>
          )}
        </div>
        {item.priority && (
          <span className="flex-shrink-0 text-xs text-gray-400">#{item.priority}</span>
        )}
      </div>

      {/* Source citations */}
      {item.sources?.length > 0 && (
        <div className="mt-2 text-xs text-gray-400">
          Source:
          {item.sources.map((s, i) => (
            <SourceBadge key={i} source={s} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({ title, items, config }) {
  if (!items?.length && config.empty === null) return null;
  return (
    <div className="mb-8">
      <h2 className="text-base font-bold text-gray-800 mb-3">
        {title}
        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${config.badge}`}>
          {items?.length ?? 0}
        </span>
      </h2>
      {items?.length ? (
        <div className="space-y-3">
          {items.map((item, i) => (
            <ActionCard
              key={i}
              item={item}
              bgClass={config.bg}
              borderClass={config.border}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">{config.empty}</p>
      )}
    </div>
  );
}

// ─── Flags section ───────────────────────────────────────────────────────────

function FlagsSection({ flags }) {
  if (!flags) return null;
  const hasAlerts = flags.security_alerts?.length > 0;
  const hasIncomplete = flags.incomplete_entries?.length > 0;
  const hasContradictions = flags.contradictions?.length > 0;
  const hasGrounding = flags.grounding_issues?.length > 0;
  if (!hasAlerts && !hasIncomplete && !hasContradictions && !hasGrounding) return null;

  return (
    <div className="mb-8">
      <h2 className="text-base font-bold text-gray-800 mb-3">⚠️ Flags</h2>
      <div className="space-y-3">
        {flags.security_alerts?.map((item, i) => (
          <div key={i} className="p-4 rounded-lg border border-purple-300 bg-purple-50">
            <p className="font-semibold text-sm text-purple-900">🛡️ Security Alert</p>
            <p className="text-sm mt-1 text-purple-800">{item.summary}</p>
            {item.details && (
              <p className="text-xs mt-1 text-purple-600 font-mono truncate">{item.details}</p>
            )}
            {item.sources?.length > 0 && (
              <div className="mt-2 text-xs text-purple-400">
                Source:
                {item.sources.map((s, j) => (
                  <SourceBadge key={j} source={s} />
                ))}
              </div>
            )}
          </div>
        ))}
        {flags.incomplete_entries?.map((item, i) => (
          <div key={i} className="p-3 rounded-lg border border-orange-200 bg-orange-50">
            <p className="text-sm text-orange-800">
              <span className="font-semibold">Incomplete entry:</span>{' '}
              {typeof item === 'string' ? item : item.summary}
            </p>
            {item.sources?.length > 0 && (
              <div className="mt-1 text-xs text-orange-400">
                Source:{item.sources.map((s, j) => <SourceBadge key={j} source={s} />)}
              </div>
            )}
          </div>
        ))}
        {flags.contradictions?.map((item, i) => (
          <div key={i} className="p-3 rounded-lg border border-yellow-200 bg-yellow-50">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">Contradiction:</span>{' '}
              {typeof item === 'string' ? item : item.summary}
            </p>
          </div>
        ))}
        {flags.grounding_issues?.map((item, i) => (
          <div key={i} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Grounding issue:</span> Item &ldquo;{item.item}&rdquo;
              references unknown event ID <code>{item.bad_source_id}</code>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main HandoverView ───────────────────────────────────────────────────────

export default function HandoverView({ data }) {
  const { hotel, shift_date, morning_date, generated_at, ai_assisted, handover, reconciliation_summary } = data;

  return (
    <div>
      {/* Meta bar */}
      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg text-sm text-gray-600">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>🏨 <strong>{hotel?.name}</strong></span>
          <span>🌙 Shift night: <strong>{shift_date}</strong></span>
          <span>☀️ Morning: <strong>{morning_date}</strong></span>
          <span className={ai_assisted ? 'text-green-600' : 'text-gray-400'}>
            {ai_assisted ? '🤖 AI-assisted' : '📐 Rule-based'}
          </span>
        </div>
        {reconciliation_summary && (
          <div className="mt-2 flex gap-4 text-xs text-gray-500">
            <span>🔴 {reconciliation_summary.still_open} still open</span>
            <span>✅ {reconciliation_summary.newly_resolved} newly resolved</span>
            <span>🆕 {reconciliation_summary.new_tonight} new tonight</span>
            <span>📋 {reconciliation_summary.fyi} FYI</span>
          </div>
        )}
        <p className="mt-1 text-xs text-gray-400">
          Generated {new Date(generated_at).toLocaleString()}
        </p>
      </div>

      {/* Main sections */}
      <Section
        title={SECTION_CONFIG.urgent_actions.label}
        items={handover?.urgent_actions}
        config={SECTION_CONFIG.urgent_actions}
      />
      <Section
        title={SECTION_CONFIG.pending_actions.label}
        items={handover?.pending_actions}
        config={SECTION_CONFIG.pending_actions}
      />
      <Section
        title={SECTION_CONFIG.fyi_items.label}
        items={handover?.fyi_items}
        config={SECTION_CONFIG.fyi_items}
      />

      {/* Flags */}
      <FlagsSection flags={handover?.flags} />

      {/* Raw JSON toggle */}
      <details className="mt-8">
        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
          View raw JSON response
        </summary>
        <pre className="mt-2 p-4 bg-gray-900 text-green-400 text-xs rounded-lg overflow-auto max-h-96">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
