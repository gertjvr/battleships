import React, { useEffect, useRef, useState } from 'react';

export default function HelpPopover() {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={popoverRef}>
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
          className="absolute right-0 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-4 shadow-lg text-sm text-slate-800 z-[100]"
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
            <li>🌊 Miss</li>
            <li>💥🚢 Sunk</li>
          </ul>
          <button
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
            onClick={() => setOpen(false)}
            aria-label="Close help"
          >
            x
          </button>
        </div>
      )}
    </div>
  );
}
