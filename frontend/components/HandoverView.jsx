'use client';

import { useState, useEffect } from 'react';

// ─── Section config ───────────────────────────────────────────────────────────

const SECTION_CONFIG = {
  urgent_actions: {
    label: '🚨 Urgent — Action Now',
    bg: 'bg-red-50',
    border: 'border-red-300',
    badgeBg: 'bg-red-500',
    empty: null,
  },
  pending_actions: {
    label: '⚡ Pending — Today',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    badgeBg: 'bg-amber-500',
    empty: null,
  },
  fyi_items: {
    label: '📋 FYI',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badgeBg: 'bg-blue-400',
    empty: '— Nothing to note —',
  },
};

// ─── Source citation badge ────────────────────────────────────────────────────

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
        <span className="absolute z-10 bottom-full left-0 mb-1 w-72 p-2 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-normal">
          &ldquo;{source.excerpt}&rdquo;
        </span>
      )}
    </span>
  );
}

// ─── Action card ──────────────────────────────────────────────────────────────

function ActionCard({ item, bgClass, borderClass, isDoodle }) {
  const [expanded, setExpanded] = useState(false);
  const cardClass = isDoodle
    ? 'rounded-xl border-2 border-dashed shadow-md'
    : 'rounded-lg border shadow-sm';

  return (
    <div className={`${cardClass} ${bgClass} ${borderClass} p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className={`font-semibold text-sm ${isDoodle ? 'text-gray-800' : 'text-gray-900'}`}>
            {item.room && (
              <span className={`mr-2 px-1.5 py-0.5 rounded text-xs font-mono ${isDoodle ? 'bg-yellow-200 text-yellow-900' : 'bg-gray-200 text-gray-700'}`}>
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
          <span className={`flex-shrink-0 text-xs font-bold ${isDoodle ? 'text-pink-400' : 'text-gray-400'}`}>
            #{item.priority}
          </span>
        )}
      </div>
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

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ title, items, config, isDoodle }) {
  if (!items?.length && config.empty === null) return null;
  return (
    <div className="mb-8">
      <h2 className={`flex items-center gap-2 font-bold mb-3 ${isDoodle ? 'text-lg' : 'text-base text-gray-800 tracking-tight uppercase text-xs'}`}>
        {title}
        <span className={`text-xs px-2 py-0.5 rounded-full text-white font-bold ${config.badgeBg}`}>
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
              isDoodle={isDoodle}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">{config.empty}</p>
      )}
    </div>
  );
}

// ─── Flags section ────────────────────────────────────────────────────────────

function FlagsSection({ flags, isDoodle }) {
  if (!flags) return null;
  const hasContent =
    flags.security_alerts?.length ||
    flags.incomplete_entries?.length ||
    flags.contradictions?.length ||
    flags.grounding_issues?.length;
  if (!hasContent) return null;

  return (
    <div className="mb-8">
      <h2 className={`font-bold mb-3 ${isDoodle ? 'text-lg' : 'text-xs uppercase tracking-tight text-gray-800'}`}>
        ⚠️ Flags
      </h2>
      <div className="space-y-3">
        {flags.security_alerts?.map((item, i) => (
          <div key={i} className="p-4 rounded-lg border border-purple-300 bg-purple-50">
            <p className="font-semibold text-sm text-purple-900">🛡️ Security Alert</p>
            <p className="text-sm mt-1 text-purple-800">{item.summary}</p>
            {item.details && <p className="text-xs mt-1 text-purple-600 font-mono truncate">{item.details}</p>}
            {item.sources?.length > 0 && (
              <div className="mt-2 text-xs text-purple-400">
                Source: {item.sources.map((s, j) => <SourceBadge key={j} source={s} />)}
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
              <span className="font-semibold">Grounding issue:</span> &ldquo;{item.item}&rdquo; references unknown event ID{' '}
              <code>{item.bad_source_id}</code>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main HandoverView ────────────────────────────────────────────────────────

export default function HandoverView({ data }) {
  const [theme, setTheme] = useState('doodle');

  useEffect(() => {
    document.body.classList.remove('theme-doodle', 'theme-corporate');
    document.body.classList.add(theme === 'doodle' ? 'theme-doodle' : 'theme-corporate');
  }, [theme]);

  const { hotel, shift_date, morning_date, generated_at, ai_assisted, handover, reconciliation_summary } = data;
  const isDoodle = theme === 'doodle';

  return (
    <div className={isDoodle ? 'font-[system-ui]' : 'font-[Inter,system-ui]'}>

      {/* Theme toggle */}
      <div className="mb-5 flex items-center gap-3 no-print">
        <span className="text-sm text-gray-500">Theme:</span>
        <button
          onClick={() => setTheme('doodle')}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-all
            ${isDoodle ? 'bg-yellow-400 border-yellow-500 text-yellow-900 shadow-md' : 'bg-white border-gray-300 text-gray-500 hover:border-yellow-400'}`}
        >
          🎨 Doodle
        </button>
        <button
          onClick={() => setTheme('corporate')}
          className={`px-4 py-1.5 rounded-md text-sm font-semibold border transition-all
            ${!isDoodle ? 'bg-blue-700 border-blue-800 text-white shadow' : 'bg-white border-gray-300 text-gray-500 hover:border-blue-400'}`}
        >
          🏢 Corporate
        </button>
        <button
          onClick={() => window.print()}
          className="ml-auto px-4 py-1.5 rounded text-sm border border-gray-300 text-gray-600 hover:bg-gray-100 no-print"
        >
          🖨 Print
        </button>
      </div>

      {/* Meta bar */}
      <div className={`mb-6 p-4 text-sm ${isDoodle
        ? 'bg-white rounded-2xl border-2 border-dashed border-amber-300 shadow-md'
        : 'bg-white rounded-lg border border-gray-200 shadow-sm'}`}>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-gray-700">
          <span>🏨 <strong>{hotel?.name}</strong></span>
          <span>🌙 Shift: <strong>{shift_date}</strong></span>
          <span>☀️ Morning: <strong>{morning_date}</strong></span>
          <span className={ai_assisted ? 'text-green-600 font-medium' : 'text-gray-400'}>
            {ai_assisted ? '🤖 AI-assisted' : '📐 Rule-based'}
          </span>
        </div>
        {reconciliation_summary && (
          <div className="mt-2 flex flex-wrap gap-4 text-xs">
            <span className="text-red-500 font-medium">🔴 {reconciliation_summary.still_open} still open</span>
            <span className="text-green-600 font-medium">✅ {reconciliation_summary.newly_resolved} newly resolved</span>
            <span className="text-blue-500 font-medium">🆕 {reconciliation_summary.new_tonight} new tonight</span>
            <span className="text-gray-500">📋 {reconciliation_summary.fyi} FYI</span>
          </div>
        )}
        <p className="mt-1 text-xs text-gray-400">Generated {new Date(generated_at).toLocaleString()}</p>
      </div>

      {/* Corporate divider */}
      {!isDoodle && <hr className="mb-6 border-blue-900 border-t-2" />}

      {/* Sections */}
      <Section title={SECTION_CONFIG.urgent_actions.label} items={handover?.urgent_actions} config={SECTION_CONFIG.urgent_actions} isDoodle={isDoodle} />
      <Section title={SECTION_CONFIG.pending_actions.label} items={handover?.pending_actions} config={SECTION_CONFIG.pending_actions} isDoodle={isDoodle} />
      <Section title={SECTION_CONFIG.fyi_items.label} items={handover?.fyi_items} config={SECTION_CONFIG.fyi_items} isDoodle={isDoodle} />
      <FlagsSection flags={handover?.flags} isDoodle={isDoodle} />

      {/* Raw JSON */}
      <details className="mt-8 no-print">
        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">View raw JSON</summary>
        <pre className="mt-2 p-4 bg-gray-900 text-green-400 text-xs rounded-lg overflow-auto max-h-96">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
