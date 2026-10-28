import { useEffect, useRef, useState } from 'react';
import { Pencil } from '@/components/icons';
import { PixelCamera as Camera } from '@/components/icons-pixel-empty';
import InlinePhotoCrop from './InlinePhotoCrop';
import { toast } from '@/components/ui/use-toast';
import { heicToJpeg, HEIC_FAILED_MESSAGE } from '@/lib/heicConvert';

// Shared profile-picture editor used by both Onboarding and Edit Profile.
// Shows a preview square; tapping it opens the inline zoom/pan/crop editor
// (Save / Discard / Replace). `size` controls the preview + editor dimensions.
// `commitRef`: see InlinePhotoCrop (the parent saves the crop with its own button).
export default function ProfilePhotoEditor({ value, onChange, size = 200, onEditingChange, commitRef }) {
  const [editingPhoto, setEditingPhoto] = useState(null);
  const photoInputRef = useRef(null);

  // Tell the parent whether a photo is mid-edit, so it can hold its primary
  // button until the user saves (check) or discards the photo.
  useEffect(() => { onEditingChange?.(!!editingPhoto); }, [editingPhoto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onEditingChange?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps

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
        commitRef={commitRef}
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
        <div className="w-full h-full rounded-2xl overflow-hidden bg-[#ECE9E1] flex items-center justify-center border-2 border-[#D6D2C7] shadow-sm">
          {value ? (
            <img src={value} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <Camera size={Math.round(size * 0.14)} className="text-[#8A877F]" />
          )}
        </div>
        <div className="absolute inset-0 rounded-2xl bg-[#262624]/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Pencil size={Math.round(size * 0.1)} className="text-[#F4F2EC]" />
        </div>
      </div>
      <span className="text-xs text-[#8A877F]">{value ? 'Tap to replace photo' : 'Tap to upload photo'}</span>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const picked = e.target.files?.[0];
          e.target.value = '';
          if (!picked) return;
          // iPhone (HEIC) photos become JPEGs first (heicConvert.js).
          let file;
          try { file = await heicToJpeg(picked); } catch (err) { console.error(err); toast({ variant: 'destructive', ...HEIC_FAILED_MESSAGE }); return; }
          setEditingPhoto(URL.createObjectURL(file));
        }}
      />
    </div>
  );
}