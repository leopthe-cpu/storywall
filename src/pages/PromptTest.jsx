import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Image as ImageIcon, Download, X, Paperclip } from '@/components/icons';
import PixelSpinner from '@/components/ui/PixelSpinner';
import { base44 } from '@/api/base44Client';

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'];

export default function PromptTest() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]); // [{ prompt, imageUrl, aspectRatio, timestamp }]
  const [authed, setAuthed] = useState(null); // null = loading, false = not admin, true = admin
  const [referenceImage, setReferenceImage] = useState(null); // { url, name }
  const [uploadingRef, setUploadingRef] = useState(false);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Admin gate — redirect non-admins back to their profile.
  // Uses the built-in role field on the User entity.
  useEffect(() => {
    base44.auth.me()
      .then(user => {
        if (user?.role !== 'admin') { setAuthed(false); return; }
        setAuthed(true);
      })
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (authed) inputRef.current?.focus();
  }, [authed]);

  // navigate(-1) is a no-op when /prompt-test was opened directly (no history
  // entry behind it). Fall back to the user's profile so the user always has
  // a way out of this screen.
  const handleBack = async () => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }
    try {
      const u = await base44.auth.me();
      navigate(u?.username ? `/${u.username}` : '/');
    } catch {
      navigate('/');
    }
  };

  if (authed === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <PixelSpinner size={24} />
      </div>
    );
  }

  if (authed === false) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white gap-4">
        <p className="text-gray-500 text-sm">Admin access required</p>
        <button onClick={handleBack} className="text-sm text-black underline">Go back</button>
      </div>
    );
  }

  const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff', 'image/webp', 'image/gif'];

  const handleRefSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Unsupported format. Use JPG, PNG, BMP, TIFF, WEBP, or GIF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10 MB.');
      return;
    }
    setUploadingRef(true);
    setError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setReferenceImage({ url: file_url, name: file.name });
    } catch (err) {
      setError('Failed to upload reference image');
    } finally {
      setUploadingRef(false);
    }
  };

  const handleDownload = async (r) => {
    try {
      const res = await fetch(r.imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prompt-${r.timestamp}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      window.open(r.imageUrl, '_blank');
    }
  };

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || generating) return;
    setGenerating(true);
    setError('');
    try {
      // Append aspect ratio hint for non-default ratios
      const fullPrompt = aspectRatio === '1:1'
        ? trimmed
        : `${trimmed}\n\nAspect ratio: ${aspectRatio}`;
      const res = await base44.functions.invoke('generateImage', { prompt: fullPrompt, ...(referenceImage ? { referenceImage: referenceImage.url } : {}) });
      const imageUrl = res?.data?.url || res?.url;
      if (!imageUrl) throw new Error('No image returned');
      setResults(prev => [{ prompt: trimmed, imageUrl, aspectRatio, timestamp: Date.now() }, ...prev]);
    } catch (e) {
      setError(e?.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
        <button onClick={handleBack} className="text-gray-500 hover:text-gray-900 transition-colors">
          <ChevronLeft size={22} />
        </button>
        <h1 className="font-semibold text-gray-900 text-base">Prompt Test</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {/* Prompt input */}
        <div>
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={e => { setPrompt(e.target.value); setError(''); }}
            placeholder="Enter image prompt..."
            rows={4}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 resize-none"
          />
        </div>

        {/* Aspect ratio selector */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Aspect Ratio</label>
          <div className="flex flex-wrap gap-2">
            {ASPECT_RATIOS.map(ratio => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  aspectRatio === ratio
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        {/* Reference image */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Reference Image</label>
          {referenceImage ? (
            <div className="relative inline-block">
              <img
                src={referenceImage.url}
                alt="Reference"
                className="w-24 h-24 rounded-lg border border-gray-200 object-cover"
              />
              <button
                onClick={() => setReferenceImage(null)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center shadow-md hover:bg-gray-800 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingRef}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
            >
              {uploadingRef ? (
                <>
                  <PixelSpinner size={16} />
                  Uploading…
                </>
              ) : (
                <>
                  <Paperclip size={16} />
                  Attach reference image
                </>
              )}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/bmp,image/tiff,image/webp,image/gif"
            onChange={handleRefSelect}
            className="hidden"
          />
          <p className="text-[10px] text-gray-400 mt-1.5">JPG, PNG, BMP, TIFF, WEBP, GIF · max 10 MB · 384–2048px recommended</p>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || generating}
          className={`w-full py-3.5 rounded-2xl font-semibold text-sm transition-all ${
            (!prompt.trim() || generating)
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-black text-white hover:bg-gray-900 active:scale-[0.98]'
          }`}
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <PixelSpinner size={16} />
              Generating…
            </span>
          ) : 'Generate'}
        </button>

        {error && <p className="text-red-500 text-xs">{error}</p>}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-5 pt-2">
            {/* Latest result — full size */}
            {results[0] && (
              <div>
                <img
                  src={results[0].imageUrl}
                  alt={results[0].prompt}
                  className="w-full rounded-xl border border-gray-200"
                />
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{results[0].prompt}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-gray-400 font-mono">{results[0].aspectRatio}</span>
                  <button
                    onClick={() => handleDownload(results[0])}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-black transition-colors"
                  >
                    <Download size={14} />
                    Download
                  </button>
                </div>
              </div>
            )}

            {/* Previous results — thumbnails */}
            {results.length > 1 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Previous</label>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {results.slice(1).map((r, i) => (
                    <div key={i} className="flex-shrink-0 w-24">
                      <img
                        src={r.imageUrl}
                        alt={r.prompt}
                        className="w-24 h-24 rounded-lg border border-gray-200 object-cover"
                      />
                      <p className="text-[10px] text-gray-500 mt-1 line-clamp-2 leading-tight">{r.prompt}</p>
                      <button
                        onClick={() => handleDownload(r)}
                        className="mt-1 flex items-center gap-1 text-[10px] font-medium text-gray-600 hover:text-black transition-colors"
                      >
                        <Download size={11} />
                        Save
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {results.length === 0 && !generating && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-300">
            <ImageIcon size={40} />
            <p className="text-sm mt-2">No generations yet</p>
          </div>
        )}
      </div>
    </div>
  );
}