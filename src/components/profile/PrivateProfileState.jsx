import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Search, Lock } from '@/components/icons';

// Private profile state — shown when a user has set is_private: true.
// Shows a centered "This profile is private" message with a search bar
// that searches public profiles by name/username and links to them.
export default function PrivateProfileState({ username }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke('searchProfiles', { query });
        setResults(res.data?.results || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F2EC] px-6 py-20">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#ECE9E1] flex items-center justify-center mb-5 mx-auto">
          <Lock size={28} className="text-[#8A877F]" />
        </div>
        <h1 className="font-display text-[28px] leading-tight font-medium text-[#262624]">This profile is private</h1>
        <p className="text-[#6B6964] text-sm mt-2 mb-8">
          @{username} has made their wall private. Explore other public walls instead.
        </p>

        {/* Search bar */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8A877F]" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search profiles by name or username…"
            className="w-full border border-[#D6D2C7] rounded-xl pl-11 pr-4 py-3 text-sm text-[#262624] placeholder:text-[#8A877F] focus:outline-none focus:ring-2 focus:ring-[#262624]/10 bg-[#FAF9F5]"
          />
        </div>

        {/* Search results */}
        {searching && (
          <p className="text-[#8A877F] text-sm mt-4">Searching…</p>
        )}
        {!searching && results.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 text-left">
            {results.map(r => (
              <button
                key={r.username}
                onClick={() => navigate(`/${r.username}`)}
                className="flex items-center gap-3 p-3 rounded-xl border border-[#E6E0D2] hover:border-[#D6D2C7] hover:bg-[#FAF9F5] transition-colors text-left"
              >
                {r.profile_image ? (
                  <img src={r.profile_image} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3A3935] to-[#262624] flex items-center justify-center text-[#F4F2EC] text-sm font-bold">
                    {(r.display_name || r.username)[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#262624] truncate">{r.display_name || r.username}</p>
                  <p className="text-xs text-[#8A877F] truncate">@{r.username}{r.headline ? ` · ${r.headline}` : ''}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {!searching && query.trim() && results.length === 0 && (
          <p className="text-[#8A877F] text-sm mt-4">No profiles found</p>
        )}
      </div>
    </div>
  );
}