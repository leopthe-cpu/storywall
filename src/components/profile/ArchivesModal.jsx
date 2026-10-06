import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, RotateCcw, Trash2 } from '@/components/icons';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import PixelSpinner from '@/components/ui/PixelSpinner';

export default function ArchivesModal({ onClose, onRestored }) {
  const navigate = useNavigate();
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    loadArchives();
  }, []);

  const loadArchives = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      const results = await base44.entities.Post.filter(
        { author_id: user.id, status: 'archived' },
        '-updated_date',
        50
      );
      setArchives(results);
    } catch (e) {
      console.error('[ArchivesModal] load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (post) => {
    setBusyId(post.id);
    try {
      await base44.entities.Post.update(post.id, { status: 'published' });
      setArchives(prev => prev.filter(p => p.id !== post.id));
      await onRestored?.();
    } catch (e) {
      console.error('[ArchivesModal] restore failed:', e);
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenInEditor = (post) => {
    navigate('/create', { state: { editStory: post } });
  };

  const handleDelete = async (post) => {
    setBusyId(post.id);
    try {
      await base44.entities.Post.delete(post.id);
      setArchives(prev => prev.filter(p => p.id !== post.id));
      setConfirmDeleteId(null);
    } catch (e) {
      console.error('[ArchivesModal] delete failed:', e);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative bg-white w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-xl flex flex-col"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900 text-base">Archived stories</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <PixelSpinner size={20} />
            </div>
          ) : archives.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-400">No archived stories.</p>
              <p className="text-xs text-gray-300 mt-1">Stories you archive will appear here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {archives.map(post => (
                <div key={post.id} className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100">
                  {/* Thumbnail + Title — click to open in editor */}
                  <button
                    onClick={() => handleOpenInEditor(post)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100">
                      {post.cover_image ? (
                        <img src={post.cover_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                          —
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {post.title || 'Untitled'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {confirmDeleteId === post.id ? 'Delete permanently?' : 'Tap to edit'}
                      </p>
                    </div>
                  </button>

                  {/* Actions */}
                  {confirmDeleteId === post.id ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={busyId === post.id}
                        className="text-xs text-gray-500 px-2 py-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(post)}
                        disabled={busyId === post.id}
                        className="text-xs text-red-600 font-medium px-2 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-40"
                      >
                        {busyId === post.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleRestore(post)}
                        disabled={busyId === post.id}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                        title="Restore to profile"
                      >
                        <RotateCcw size={15} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(post.id)}
                        disabled={busyId === post.id}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                        title="Delete permanently"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}