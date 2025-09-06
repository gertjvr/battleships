import React, { useState } from 'react';

export default function HelpPopover() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Help
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Keyboard help"
          className="absolute right-0 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-4 shadow-lg text-sm text-slate-800"
        >
          <div className="font-semibold mb-2">Keyboard Hints</div>
          <ul className="list-disc ps-5 space-y-1">
            <li><span className="font-medium">Arrow Keys</span>: Navigate grid cells</li>
            <li><span className="font-medium">Tab</span>: Navigate grid cells (alternative)</li>
            <li><span className="font-medium">Enter</span>: Place ship or fire on focused cell</li>
            <li><span className="font-medium">Space</span>: Rotate ship during placement</li>
            <li><span className="font-medium">Escape</span>: Delete last ship placement</li>
          </ul>
          <div className="font-semibold mt-3 mb-1">Legend</div>
          <ul className="ps-0 space-y-1">
            <li>💥 Hit</li>
            <li>💧 Miss</li>
            <li>🚢 Sunk</li>
          </ul>
          <div className="text-right mt-3">
            <button className="btn" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

