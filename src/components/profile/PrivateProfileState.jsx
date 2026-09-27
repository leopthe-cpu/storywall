import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Search, Lock } from 'lucide-react';

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F7F5] px-6 py-20">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-5 mx-auto">
          <Lock size={28} className="text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">This profile is private</h1>
        <p className="text-gray-500 text-sm mt-2 mb-8">
          @{username} has made their wall private. Explore other public walls instead.
        </p>

        {/* Search bar */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search profiles by name or username…"
            className="w-full border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 bg-white"
          />
        </div>

        {/* Search results */}
        {searching && (
          <p className="text-gray-400 text-sm mt-4">Searching…</p>
        )}
        {!searching && results.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 text-left">
            {results.map(r => (
              <button
                key={r.username}
                onClick={() => navigate(`/${r.username}`)}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-white transition-colors text-left"
              >
                {r.profile_image ? (
                  <img src={r.profile_image} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white text-sm font-bold">
                    {(r.display_name || r.username)[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.display_name || r.username}</p>
                  <p className="text-xs text-gray-400 truncate">@{r.username}{r.headline ? ` · ${r.headline}` : ''}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {!searching && query.trim() && results.length === 0 && (
          <p className="text-gray-400 text-sm mt-4">No profiles found</p>
        )}
      </div>
    </div>
  );
}