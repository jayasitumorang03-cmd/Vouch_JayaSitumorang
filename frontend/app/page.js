'use client';

import { useState, useEffect } from 'react';
import HandoverView from '../components/HandoverView';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function HomePage() {
  const [shifts, setShifts] = useState([]);
  const [hotel, setHotel] = useState(null);
  const [selectedShift, setSelectedShift] = useState('');
  const [handover, setHandover] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [backendOk, setBackendOk] = useState(null);

  // Check backend health and load shifts on mount
  useEffect(() => {
    fetch(`${API}/api/health`)
      .then((r) => r.json())
      .then((d) => setBackendOk(d.status === 'ok'))
      .catch(() => setBackendOk(false));

    fetch(`${API}/api/handover/shifts`)
      .then((r) => r.json())
      .then((d) => {
        setShifts(d.available_shifts || []);
        setHotel(d.hotel);
        // Default to most recent shift
        if (d.available_shifts?.length) {
          setSelectedShift(d.available_shifts[d.available_shifts.length - 1]);
        }
      })
      .catch(() => setError('Cannot reach backend — make sure it is running on port 3001'));
  }, []);

  async function fetchHandover(shiftDate) {
    setLoading(true);
    setError(null);
    setHandover(null);
    try {
      const r = await fetch(`${API}/api/handover/demo/${shiftDate}`);
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      setHandover(await r.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleShiftChange(e) {
    setSelectedShift(e.target.value);
    setHandover(null);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">🏨 Night Handover</h1>
        {hotel && (
          <p className="text-gray-500 mt-1">
            {hotel.name} &nbsp;·&nbsp; {hotel.rooms} rooms
          </p>
        )}
        {backendOk === false && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            ⚠️ Backend unreachable at <code>{API}</code>. Start it with{' '}
            <code>cd backend && npm start</code>.
          </div>
        )}
      </div>

      {/* Shift selector */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Shift night (morning handover for)
          </label>
          <select
            value={selectedShift}
            onChange={handleShiftChange}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— select a shift —</option>
            {shifts.map((s) => (
              <option key={s} value={s}>
                Night of {s}
              </option>
            ))}
          </select>
        </div>
        <div className="pt-5">
          <button
            onClick={() => selectedShift && fetchHandover(selectedShift)}
            disabled={!selectedShift || loading}
            className="px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-medium
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating…' : 'Generate handover'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Handover view */}
      {handover && <HandoverView data={handover} />}

      {/* Empty state */}
      {!loading && !handover && !error && (
        <div className="text-center py-16 text-gray-400">
          Select a shift and click &ldquo;Generate handover&rdquo;
        </div>
      )}
    </div>
  );
}
