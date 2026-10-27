import { useRef, useEffect, useState } from 'react';
import { ImagePlus, Video } from '@/components/icons';
import ThemePicker from '@/components/creator/ThemePicker';
import CardSizePicker from '@/components/creator/CardSizePicker';

// Full-screen notes editor for Generate mode.
// Plain white canvas with a blinking text cursor (native textarea cursor).
// User can type free-text and press-and-hold anywhere to attach images/video.
export default function NotesView({ value, onChange, attachments, onAddAttachment, onRemoveAttachment, theme, onThemeChange, cardFormat, onCardFormatChange }) {
  const textareaRef = useRef(null);
  const longPressTimer = useRef(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const fileInputRef = useRef(null);

  // Auto-focus on mount
  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const handleStartPress = (e) => {
    // Only trigger long-press on the white space (not on the textarea itself)
    if (e.target === textareaRef.current) return;
    longPressTimer.current = setTimeout(() => {
      setShowAttachMenu(true);
    }, 500);
  };

  const handleEndPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddAttachment?.(file);
    }
    setShowAttachMenu(false);
    e.target.value = '';
  };

  return (
    <div
      className="flex-1 flex flex-col bg-white relative overflow-hidden"
      onTouchStart={handleStartPress}
      onTouchEnd={handleEndPress}
      onTouchMove={handleEndPress}
      onMouseDown={handleStartPress}
      onMouseUp={handleEndPress}
      onMouseLeave={handleEndPress}
    >
      {/* Card size of the story to generate (CardSizePicker), offered while
          the story is still empty. A row above the notes: the bottom of the
          screen already holds the AI notice, the attach hint and the theme.
          Presses on it don't start the press-and-hold attach menu. */}
      {onCardFormatChange && (
        <div
          className="flex-shrink-0 px-6 pt-4"
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <CardSizePicker value={cardFormat} onChange={onCardFormatChange} tone="light" />
        </div>
      )}

      {/* Notes textarea — fills available space */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write your story here..."
        className="flex-1 w-full p-6 pb-20 text-base text-gray-900 placeholder-gray-300 resize-none outline-none border-none bg-transparent leading-relaxed"
        style={{ fontSize: '16px' }}
      />

      {/* Attachment thumbnails */}
      {attachments && attachments.length > 0 && (
        <div className="flex gap-2 px-6 pb-3 overflow-x-auto flex-shrink-0">
          {attachments.map((att, i) => (
            <div key={i} className="relative flex-shrink-0">
              {att.type === 'video' ? (
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                  <Video size={20} className="text-gray-400" />
                </div>
              ) : (
                <img src={att.url} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
              )}
              <button
                onClick={() => onRemoveAttachment?.(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black text-white text-xs flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Colour theme (ThemePicker). Presses on it don't start the
          press-and-hold attach menu. */}
      {onThemeChange && (
        <div
          className="absolute bottom-4 right-4 z-10"
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ThemePicker value={theme} onChange={onThemeChange} />
        </div>
      )}


      {/* AI notice (docs/legal-and-privacy-plan.md Step 3): what happens to
          the notes, and that the result needs checking. Shown while the
          screen is empty, like the hint below, so it never sits over the
          user's text. */}
      {(!attachments || attachments.length === 0) && !value && (
        <p className="absolute bottom-[68px] inset-x-8 text-center text-[11px] leading-snug text-gray-400">
          Generate uses AI: your notes and photos are sent to our AI providers to build your story.
          Check the result before you publish.{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">Privacy</a>
        </p>
      )}

      {/* Press-and-hold hint */}
      {(!attachments || attachments.length === 0) && !value && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-gray-300 text-xs pointer-events-none whitespace-nowrap">
          Press & hold anywhere to attach a photo
        </div>
      )}

      {/* Attachment menu (press-and-hold) */}
      {showAttachMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 flex gap-2">
            <button
              onClick={() => { fileInputRef.current?.click(); }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <ImagePlus size={18} className="text-gray-700" />
              <span className="text-sm font-medium text-gray-900">Attach image</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </>
      )}
    </div>
  );
}