import { useRef, useState, useEffect } from 'react';
import { Mic, Square, Play, Pause, RotateCw, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PixelSpinner from '@/components/ui/PixelSpinner';

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function isFinitePositive(d) {
  return d && isFinite(d) && d > 0;
}

// Pick a supported recording MIME type. Chrome/desktop → audio/webm, Safari/iOS → audio/mp4.
function pickRecordingMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  return '';
}

// Read duration (seconds) from an assembled Blob by loading it into a media element.
function readBlobDuration(url, isVideo) {
  return new Promise((resolve) => {
    const el = document.createElement(isVideo ? 'video' : 'audio');
    el.preload = 'metadata';
    const done = (v) => { el.onload = null; el.onerror = null; resolve(v); };
    el.onloadedmetadata = () => {
      let d = el.duration;
      // Some browsers report Infinity until played; nudge with a tiny seek.
      if (d === Infinity || isNaN(d)) {
        el.currentTime = 1e101;
        el.ontimeupdate = () => { el.ontimeupdate = null; done(isFinite(el.duration) ? el.duration : 0); };
        setTimeout(() => done(0), 1500);
      } else {
        done(isFinite(d) ? d : 0);
      }
    };
    el.onerror = () => done(0);
    el.src = url;
  });
}

// Inline audio recorder rendered inside the media island.
// onUse(file_url, duration) saves the recording to the gallery.
export default function AudioRecorder({ onUse, onCancel }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const blobRef = useRef(null);
  const mimeRef = useRef('audio/webm');
  const previewAudioRef = useRef(null);
  const elapsedRef = useRef(0);

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickRecordingMime();
      mimeRef.current = mimeType || 'audio/webm';
      const mr = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      // Collect chunks as they arrive (100ms timeslice) so the Blob assembled
      // in onstop contains every chunk flushed by the recorder.
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        // Release the mic as soon as recording stops.
        streamRef.current?.getTracks().forEach((t) => t.stop());

        if (chunksRef.current.length === 0) {
          setError('No audio captured. Please try again.');
          setRecording(false);
          return;
        }
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        if (blob.size < 1000) {
          setError('Recording too short. Please try again.');
          setRecording(false);
          return;
        }
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        // Duration is read from the assembled media file. Fall back to the live
        // timer if the metadata read fails (some browsers report 0/Infinity).
        const d = await readBlobDuration(url, false);
        const finalDuration = isFinitePositive(d) ? d : (elapsedRef.current > 0.5 ? elapsedRef.current : 0);
        if (finalDuration < 0.5) {
          setError('Recording too short. Please try again.');
          setPreviewUrl(null);
          setDuration(0);
          return;
        }
        setDuration(finalDuration);
        setPreviewUrl(url);
        setError('');
      };

      // 100ms timeslice → chunks arrive during recording, not only at stop.
      mr.start(100);
      mediaRecorderRef.current = mr;
      setRecording(true);
      setElapsed(0);
      elapsedRef.current = 0;
      setDuration(0);
      setPreviewUrl(null);
      setError('');
      timerRef.current = setInterval(() => {
        setElapsed((e) => { elapsedRef.current = e + 1; return e + 1; });
      }, 1000);
    } catch (e) {
      console.error(e);
      setError('Microphone access is required to record audio. Please allow access in your browser settings.');
    }
  };

  // Always wait for onstop (which fires after dataavailable flushes) — never
  // assemble the Blob directly in stop().
  const stop = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  };

  const togglePreview = () => {
    const a = previewAudioRef.current;
    if (!a) return;
    if (playing) a.pause(); else a.play().catch(() => {});
  };

  const useIt = async () => {
    const blob = blobRef.current;
    if (!blob || !isFinitePositive(duration)) {
      setError('Recording too short. Please re-record.');
      return;
    }
    setUploading(true);
    try {
      const ext = mimeRef.current.includes('mp4') ? 'm4a' : 'webm';
      const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: blob.type });
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      onUse(file_uri, duration);
    } catch (e) {
      console.error(e);
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const rerecord = () => {
    blobRef.current = null;
    setPreviewUrl(null);
    setDuration(0);
    setElapsed(0);
    setPlaying(false);
    setError('');
  };

  // Clean up on unmount.
  useEffect(() => () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  return (
    <div className="px-4 py-4 flex flex-col items-center gap-4 text-white">
      <div className="flex items-center gap-2 w-full">
        <button onClick={onCancel} className="text-white/50 hover:text-white text-xs">Cancel</button>
        <span className="text-white/70 text-sm font-medium ml-auto">Record audio</span>
      </div>

      {/* Recording state */}
      {recording && (
        <div className="flex flex-col items-center gap-3 py-6">
          <button
            onClick={stop}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-95 transition-transform"
          >
            <Square size={26} className="text-white" fill="white" />
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="font-mono text-lg tabular-nums">{fmt(elapsed)}</span>
          </div>
          <p className="text-white/40 text-xs">Tap to stop</p>
        </div>
      )}

      {/* Preview state */}
      {!recording && previewUrl && (
        <div className="flex flex-col items-center gap-4 py-4 w-full">
          <div className="flex items-center gap-3 w-full bg-white/10 rounded-xl px-3 py-3">
            <button
              onClick={togglePreview}
              className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center flex-shrink-0"
            >
              {playing ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: 2 }} />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-end gap-[2px] h-7">
                {Array.from({ length: 28 }).map((_, i) => (
                  <div key={i} style={{
                    flex: 1,
                    height: `${30 + Math.abs(Math.sin(i * 1.7)) * 70}%`,
                    background: 'rgba(255,255,255,0.4)',
                    borderRadius: 2,
                    minWidth: 1,
                  }} />
                ))}
              </div>
              <span className="text-white/50 text-[10px] font-mono mt-1 block">{fmt(duration)}</span>
            </div>
          </div>
          <audio
            ref={previewAudioRef}
            src={previewUrl}
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            className="hidden"
          />
          <div className="flex gap-2 w-full">
            <button
              onClick={rerecord}
              className="flex-1 py-3 bg-white/10 text-white/80 text-sm rounded-xl hover:bg-white/15 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCw size={16} /> Re-record
            </button>
            <button
              onClick={useIt}
              disabled={uploading}
              className="flex-1 py-3 bg-white text-black text-sm rounded-xl font-medium hover:bg-white/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {uploading ? (
                <PixelSpinner size={16} />
              ) : (
                <><Check size={16} /> Use this</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Idle — record button */}
      {!recording && !previewUrl && (
        <div className="flex flex-col items-center gap-3 py-6">
          <button
            onClick={start}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-95 transition-transform"
          >
            <Mic size={28} className="text-white" />
          </button>
          <p className="text-white/40 text-xs">Tap to start recording</p>
          {error && <p className="text-red-400 text-xs text-center max-w-[220px]">{error}</p>}
        </div>
      )}
    </div>
  );
}