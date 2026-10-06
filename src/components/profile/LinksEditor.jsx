import { useState } from 'react';
import { Plus, X } from '@/components/icons';
import PixelSpinner from '@/components/ui/PixelSpinner';

function getFaviconUrl(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch {
    return null;
  }
}

function normalizeUrl(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : 'https://' + url;
}

export default function LinksEditor({ links = [], onChange }) {
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const handleAdd = async () => {
    const raw = input.trim();
    if (!raw) return;
    setAdding(true);
    const url = normalizeUrl(raw);
    const favicon = getFaviconUrl(url);
    // Derive label from hostname
    let label = '';
    try { label = new URL(url).hostname.replace('www.', ''); } catch { label = raw; }
    const newLink = { url, label, favicon };
    onChange([...links, newLink]);
    setInput('');
    setShowInput(false);
    setAdding(false);
  };

  const handleRemove = (i) => {
    onChange(links.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-2">
      {links.map((link, i) => (
        <div key={i} className="flex items-center gap-2.5 bg-[#FAF9F5] border border-[#D6D2C7] rounded-xl px-3 py-2.5">
          {link.favicon ? (
            <img src={link.favicon} alt="" className="w-4 h-4 rounded-sm flex-shrink-0" onError={e => { e.target.style.display = 'none'; }} />
          ) : (
            <div className="w-4 h-4 rounded-sm bg-[#D6D2C7] flex-shrink-0" />
          )}
          <span className="text-sm text-[#3A3935] flex-1 truncate">{link.label || link.url}</span>
          <button onClick={() => handleRemove(i)} className="text-[#8A877F] hover:text-[#3A3935] flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}

      {showInput ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setShowInput(false); setInput(''); } }}
            placeholder="e.g. linkedin.com/in/you"
            className="flex-1 border border-[#D6D2C7] rounded-xl px-3 py-2.5 text-sm text-[#262624] placeholder:text-[#8A877F] focus:outline-none focus:ring-2 focus:ring-[#262624]/20"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !input.trim()}
            className="bg-[#262624] text-[#F4F2EC] px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40 flex-shrink-0"
          >
            {adding ? <PixelSpinner size={14} tone="light" /> : 'Add'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="flex items-center gap-2 text-sm text-[#6B6964] hover:text-[#262624] transition-colors py-1"
        >
          <Plus size={15} />
          <span>Add a link</span>
        </button>
      )}
    </div>
  );
}