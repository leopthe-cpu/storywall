import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Pencil, Check, X, AlertCircle } from '@/components/icons';
import PixelSpinner from '@/components/ui/PixelSpinner';

// Inline-editable username row with real-time availability check.
// Excludes the current user's own record so they can keep their existing username.
export default function EditableUsername({ currentUsername, currentUserId, onSaved }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentUsername || '');
  const [checkState, setCheckState] = useState('idle');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Keep value in sync when not editing
  useEffect(() => {
    if (!editing) setValue(currentUsername || '');
  }, [currentUsername, editing]);

  // Real-time availability check (debounced 400ms), excludes current user
  useEffect(() => {
    if (!editing) return;
    const val = value;
    if (!val || val.length < 2 || !/^[a-z0-9_]+$/.test(val)) {
      setCheckState('idle');
      return;
    }
    if (val === currentUsername) {
      setCheckState('available');
      return;
    }
    setCheckState('checking');
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke('checkUsername', { username: val, excludeUserId: currentUserId });
        if (cancelled) return;
        setCheckState(res.data?.available ? 'available' : 'taken');
      } catch {
        if (!cancelled) setCheckState('error');
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value, editing, currentUsername, currentUserId]);

  const handleSave = async () => {
    if (!value || value === currentUsername) { setEditing(false); return; }
    if (checkState !== 'available') return;
    setSaving(true);
    setError('');
    try {
      await base44.auth.updateMe({ username: value });
      const updated = await base44.auth.me();
      if (updated?.username) {
        onSaved?.();
        navigate(`/${updated.username}`, { replace: true });
      } else {
        setError('Failed to save. Please try again.');
        setSaving(false);
      }
    } catch (e) {
      setError(e?.message || 'Failed to save. Please try again.');
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setValue(currentUsername || '');
    setCheckState('idle');
    setError('');
  };

  if (editing) {
    return (
      <div className="py-2 border-b border-gray-50 last:border-0">
        <p className="text-xs text-gray-400">Username</p>
        <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-black/20 mt-1">
          <span className="px-2 text-gray-400 text-xs bg-gray-50 border-r border-gray-200 py-2.5 flex-shrink-0">storywall.io/</span>
          <input
            value={value}
            onChange={e => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            maxLength={30}
            autoFocus
            className="flex-1 px-2 py-2.5 text-sm text-gray-900 focus:outline-none"
          />
          <div className="pr-2 flex-shrink-0 flex items-center">
            {checkState === 'checking' && <PixelSpinner size={14} />}
            {checkState === 'available' && <Check size={14} className="text-green-500" />}
            {checkState === 'taken' && <X size={14} className="text-red-500" />}
            {checkState === 'error' && <AlertCircle size={14} className="text-red-500" />}
          </div>
        </div>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleSave}
            disabled={saving || checkState !== 'available'}
            className="flex-1 bg-black text-white py-2 rounded-lg text-xs font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-xs font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2 border-b border-gray-50 last:border-0">
      <p className="text-xs text-gray-400">Username</p>
      <div className="flex items-center justify-between mt-0.5">
        <p className="text-sm font-medium text-gray-900">@{currentUsername || '—'}</p>
        <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-gray-700 transition-colors">
          <Pencil size={14} />
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-0.5">Appears in your profile URL</p>
    </div>
  );
}