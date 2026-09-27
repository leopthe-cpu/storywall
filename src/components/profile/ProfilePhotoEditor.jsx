import { useRef, useState } from 'react';
import { Pencil, Camera } from 'lucide-react';
import InlinePhotoCrop from './InlinePhotoCrop';

// Shared profile-picture editor used by both Onboarding and Edit Profile.
// Shows a preview square; tapping it opens the inline zoom/pan/crop editor
// (Save / Discard / Change). `size` controls the preview + editor dimensions.
export default function ProfilePhotoEditor({ value, onChange, size = 200 }) {
  const [editingPhoto, setEditingPhoto] = useState(null);
  const photoInputRef = useRef(null);

  const handleSaved = (url) => {
    onChange(url);
    setEditingPhoto(null);
  };

  const handleDiscard = (newBlobUrl) => {
    // A blob URL signals "Change" (load a new image); null signals "Discard".
    setEditingPhoto(newBlobUrl || null);
  };

  if (editingPhoto) {
    return (
      <InlinePhotoCrop
        imageUrl={editingPhoto}
        onSaved={handleSaved}
        onDiscard={handleDiscard}
        size={size}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative group cursor-pointer"
        style={{ width: size, height: size }}
        onClick={() => (value ? setEditingPhoto(value) : photoInputRef.current?.click())}
      >
        <div className="w-full h-full rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-gray-300 shadow-sm">
          {value ? (
            <img src={value} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <Camera size={Math.round(size * 0.14)} className="text-gray-400" />
          )}
        </div>
        <div className="absolute inset-0 rounded-2xl bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Pencil size={Math.round(size * 0.1)} className="text-white" />
        </div>
      </div>
      <span className="text-xs text-gray-400">{value ? 'Tap to change photo' : 'Tap to upload photo'}</span>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (!file) return;
          setEditingPhoto(URL.createObjectURL(file));
          e.target.value = '';
        }}
      />
    </div>
  );
}