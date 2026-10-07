import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Share2, Pencil, SelectFace3d, X } from '@/components/icons';
import { motion, AnimatePresence } from 'framer-motion';
import StoryCard from '@/components/profile/StoryCard';
import StoryKebab from '@/components/profile/StoryKebab';
import DeleteStoryModal from '@/components/profile/DeleteStoryModal';
import ReorderStories from '@/components/profile/ReorderStories';
import EditProfileModal from '@/components/profile/EditProfileModal';
import BurgerMenu from '@/components/profile/BurgerMenu';
import { useToast } from '@/components/ui/use-toast';
import ProfileEmptyState from '@/components/profile/ProfileEmptyState';
import ShareUrlModal from '@/components/profile/ShareUrlModal';
import CopyToast from '@/components/profile/CopyToast';
import WriteGenerateToggle from '@/components/creator/WriteGenerateToggle';
import DownloadCardsButton from '@/components/creator/DownloadCardsButton';
import { aiCarouselBuilderEnabled } from '@/lib/featureFlags';
import PrivateProfileState from '@/components/profile/PrivateProfileState';
import NotFoundProfileState from '@/components/profile/NotFoundProfileState';
import LazyMount from '@/components/profile/LazyMount';
import { ProfileHeroCard, ProfileInfo } from '@/components/profile/ProfileHeader';
import PixelSpinner from '@/components/ui/PixelSpinner';
import useDocumentTitle from '@/lib/useDocumentTitle';

// Desktop story-card width matches the desktop profile-picture column width
// exactly (both reference this one constant) so the feed's cards read as the
// same visual scale as the hero photo, rather than dwarfing it.
const DESKTOP_CARD_MAX_WIDTH = 340;
// Desktop: the left column starts this far below the top of the page
// (wrapper pt-[45px] under the fixed top bar + container py-8 = 32px).
// Sticking at the same offset means it never moves when the page scrolls —
// a smaller value let it travel up ~24px before locking.
const DESKTOP_TOP_PAD = 45;
const DESKTOP_CONTAINER_PAD = 32;
const DESKTOP_STICKY_TOP = DESKTOP_TOP_PAD + DESKTOP_CONTAINER_PAD;

// Near-black used for the top bar's label and icons so they read as one set.
const HEADER_INK = '#262624';

// (Template demo content removed — every profile now shows only its own real data.)

// ── Main component ─────────────────────────────────────────────────────────

export default function PublicProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState('loading');
  const [showEdit, setShowEdit] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [profile, setProfile] = useState(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  // Story whose cards are being exported as images (admin-only).
  const [downloadPost, setDownloadPost] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [authUserId, setAuthUserId] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showNewStoryToggle, setShowNewStoryToggle] = useState(false);
  const { toast } = useToast();

  // Falls back to the username while the profile is still loading, so the
  // tab never briefly shows the bare "storywall" default title.
  useDocumentTitle(
    profileUser ? `${profileUser.display_name || profileUser.full_name || username} | storywall` : `${username} | storywall`
  );

  // Safety net: clear any body scroll lock left by a previous component
  // (e.g. Onboarding) so the profile page scrolls naturally.
  useEffect(() => {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
  }, []);

  useEffect(() => {
    async function load() {
      if (!username || username.trim() === '') {
        navigate('/');
        return;
      }
      setLoading(true);
      // Retry up to 3 times if not_found — handles the timing race where a
      // just-onboarded user's username hasn't propagated to the database yet.
      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 500;
      let lastStatus = 'not_found';
      let lastUser = null;
      let lastPosts = [];
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const res = await base44.functions.invoke('getPublicProfile', { username });
          const data = res?.data || {};
          lastStatus = data.status || 'not_found';
          lastUser = data.user || null;
          lastPosts = data.posts || [];
          if (lastStatus !== 'not_found') break;
        } catch (e) {
          console.error('[PublicProfile] load failed:', e);
          lastUser = null;
          lastPosts = [];
        }
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        }
      }
      setProfileStatus(lastStatus);
      setProfileUser(lastUser);
      setPosts(lastPosts);
      setLoading(false);
    }
    load();
  }, [username]);

  // One-shot auth fetch — stores only the user id (primitive) so the owner
  // check never re-renders via a context subscription.
  useEffect(() => {
    base44.auth.me()
      .then(user => {
        setAuthUserId(user?.id ?? null);
        // Admin gate: uses the built-in role field on the User entity.
        const admin = user?.role === 'admin';
        setIsAdmin(admin);
        // Premium only shows/hides the Generate UI here — the backend
        // functions enforce it (base44/shared/premium.ts). Grants live in the
        // admin-managed PremiumGrant entity; admins are always premium.
        if (admin) {
          setIsPremium(true);
        } else if (user?.id) {
          base44.entities.PremiumGrant.filter({ user_id: user.id })
            .then(grants => setIsPremium(Array.isArray(grants) && grants.length > 0))
            .catch(() => setIsPremium(false));
        }
      })
      .catch(() => setAuthUserId(null));
  }, []);

  const isOwner = Boolean(
    authUserId &&
    profileUser?.id &&
    authUserId === profileUser.id
  );

  useEffect(() => {
    setProfile(profileUser);
  }, [profileUser]);

  const allTags = [...new Set(posts.flatMap(p => p.tags || []))];
  // Pinned skills are only shown if at least one currently-published story
  // backs them. Stored pins for skills whose only story was archived/deleted
  // are kept in the DB but filtered out of the display — they reappear
  // automatically if the story is re-published.
  const visibleSkills = (profile?.skills || []).filter(s => allTags.includes(s));

  const [selectedTags, setSelectedTags] = useState([]);
  const toggleTag = (tag) => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  // Display order: explicit display_order ascending, then stories without an
  // explicit order fall back to created_date descending.
  const sortedPosts = useMemo(() => {
    const withOrder = posts.filter(p => p.display_order != null).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const withoutOrder = posts.filter(p => p.display_order == null).sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
    return [...withOrder, ...withoutOrder];
  }, [posts]);
  const visiblePosts = selectedTags.length === 0
    ? sortedPosts
    : sortedPosts.filter(p => (p.tags || []).some(t => selectedTags.includes(t)));

  // When a tag filter is applied, scroll the first matching story into view.
  useEffect(() => {
    if (selectedTags.length === 0) return;
    const firstMatch = sortedPosts.find(p => (p.tags || []).some(t => selectedTags.includes(t)));
    if (!firstMatch) return;
    requestAnimationFrame(() => {
      const els = document.querySelectorAll(`[data-story-id="${firstMatch.id}"]`);
      for (const el of els) {
        if (el.offsetParent !== null) {
          // Force the story to mount now — it may be far below the fold and
          // this jump-scroll shouldn't have to wait on the lazy-mount observer.
          el.dispatchEvent(new CustomEvent('storywall:reveal'));
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }
      }
    });
  }, [selectedTags]);

  const handleShare = async () => {
    const url = `${window.location.origin}/${username}`;
    try {
      await navigator.clipboard.writeText(url);
      setShowCopyToast(true);
      setTimeout(() => setShowCopyToast(false), 2000);
    } catch {
      setShowShareModal(true);
    }
  };

  const handleShareStory = (post) => {
    const url = `${window.location.origin}/${username}/${post.id}`;
    navigator.clipboard.writeText(url)
      .then(() => toast({ description: 'Link copied' }))
      .catch(() => {});
  };

  const handleEditStory = (post) => navigate('/create', { state: { editStory: post } });

  // Lightweight reload — re-fetches posts without the retry/loading dance.
  const reloadPosts = useCallback(async () => {
    if (!username) return;
    try {
      const res = await base44.functions.invoke('getPublicProfile', { username });
      const data = res?.data || {};
      if (data.status === 'public') {
        setPosts(data.posts || []);
      }
    } catch (e) {
      console.error('[PublicProfile] reload failed:', e);
    }
  }, [username]);

  const handleArchiveStory = async (post) => {
    // Optimistically remove from the feed, then persist the status change.
    setPosts(prev => prev.filter(p => p.id !== post.id));
    try {
      await base44.entities.Post.update(post.id, { status: 'archived' });
    } catch (e) {
      console.error('[PublicProfile] archive failed:', e);
      // Revert on failure
      setPosts(prev => [...prev, post]);
    }
  };

  const confirmDelete = async () => {
    const post = pendingDelete;
    setPendingDelete(null);
    if (!post) return;
    setPosts(prev => prev.filter(p => p.id !== post.id));
    try {
      if (!String(post.id).startsWith('tpl')) await base44.entities.Post.delete(post.id);
    } catch (e) { console.error(e); }
  };

  const saveReorder = async (newOrder) => {
    setReorderMode(false);
    const ordered = newOrder.map((p, i) => ({ ...p, display_order: i }));
    setPosts(ordered);
    try {
      await base44.entities.Post.bulkUpdate(ordered.map((p, i) => ({ id: p.id, display_order: i })));
    } catch (e) { console.error(e); }
  };

  const handleStoryTap = (postId) => {
    // Query all rendered instances (mobile + desktop are both mounted) and
    // scroll the one that is actually visible.
    const els = document.querySelectorAll(`[data-story-id="${postId}"]`);
    for (const el of els) {
      if (el.offsetParent !== null) {
        el.dispatchEvent(new CustomEvent('storywall:reveal'));
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
    }
  };

  const storyKebab = (post) => isOwner ? (
    <StoryKebab
      onEdit={() => handleEditStory(post)}
      onDelete={() => setPendingDelete(post)}
      onArchive={() => handleArchiveStory(post)}
      onDownload={isAdmin ? () => setDownloadPost(post) : undefined}
    />
  ) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F4F2EC]">
        <PixelSpinner size={24} />
      </div>
    );
  }

  if (profileStatus === 'not_found') {
    return <NotFoundProfileState username={username} />;
  }

  if (profileStatus === 'private') {
    return <PrivateProfileState username={profileUser?.username || username} />;
  }

  if (!profileUser) {
    return <NotFoundProfileState username={username} />;
  }

  const name = profile?.display_name || profile?.full_name || 'User';

  return (
    <div
      className="min-h-screen relative"
      style={{
        background: '#F4F2EC',
        backgroundImage: 'linear-gradient(#E6E0D2 1px, transparent 1px), linear-gradient(90deg, #E6E0D2 1px, transparent 1px)',
        backgroundSize: '38px 38px',
        backgroundPosition: 'center top',
      }}
    >
      {/* Grid fade overlay — same grid-fading-from-the-top treatment as the
          landing hero, so the profile background reads as part of the same
          theme. Fixed + pointer-events:none + no z-index so it always sits
          behind the actual page content below (which is lifted to z-10). */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(120% 100% at 50% 0%, transparent 0%, #F4F2EC 72%)',
        }}
      />

      <div className="relative z-10">

      {/* ── STICKY TOP BAR ── */}
      {/* Inner row uses the same max-width + horizontal padding as the page
          content below (px-4 mobile, max-w-[1200px] px-8 desktop), so the
          storywall.io/username label lines up with the profile picture's left
          edge instead of hugging the window edge. Label and icons share one
          near-black ink colour (HEADER_INK). */}
      <div className="fixed top-0 left-0 right-0 z-30 py-1 bg-[#FAF9F5]/90 backdrop-blur border-b border-[#E6E0D2]">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 flex items-center justify-between">
          <span className="text-sm font-mono tracking-tight" style={{ color: HEADER_INK }}>
            storywall.io/{username}
          </span>
          <div className="flex items-center gap-1 -mr-3">
            <IconBtn onClick={handleShare} title="Share"><Share2 size={18} /></IconBtn>
            {isOwner && <IconBtn onClick={() => setShowEdit(true)} title="Edit profile"><Pencil size={18} /></IconBtn>}
            {isOwner && <IconBtn onClick={() => setShowMenu(true)} title="Settings"><SelectFace3d size={18} /></IconBtn>}
          </div>
        </div>
      </div>

      {/* ── MOBILE LAYOUT (hidden on md+) ── */}
      <div className="md:hidden pt-[52px]">
        <div className="px-4 pt-4">
          <ProfileHeroCard profile={profile} name={name} aspectRatio="1/1" />
        </div>
        <div className="px-5 pt-5 pb-2">
          <ProfileInfo
            profile={profile}
            visibleSkills={visibleSkills}
            selectedTags={selectedTags}
            onToggleTag={toggleTag}
          />
        </div>
        <div className="h-px bg-[#E6E0D2] mx-5 mt-5 mb-6" />
        <div className={`px-4 pb-20 ${visiblePosts.length === 0 ? 'flex flex-col items-center justify-center min-h-[45vh]' : ''}`}>
          {visiblePosts.length === 0 ? (
            <ProfileEmptyState isOwner={isOwner} hasTagFilter={selectedTags.length > 0} />
          ) : (
            <div className="flex flex-col gap-8">
              {visiblePosts.map((post) => (
                <LazyMount key={post.id} data-story-id={post.id}>
                  {() => (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                      <StoryCard post={post} selectedTags={selectedTags} onToggleTag={toggleTag} kebab={storyKebab(post)} onTap={() => handleStoryTap(post.id)} />
                    </motion.div>
                  )}
                </LazyMount>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── DESKTOP LAYOUT (hidden below md) ── */}
      <div className="hidden md:block" style={{ paddingTop: DESKTOP_TOP_PAD }}>
        <div className="max-w-[1200px] mx-auto px-8 flex gap-10 items-start" style={{ paddingTop: DESKTOP_CONTAINER_PAD, paddingBottom: DESKTOP_CONTAINER_PAD }}>

          {/* LEFT COLUMN — sticky. On a short window it scrolls inside
              itself so the bottom of the profile info stays reachable. */}
          <div
            // Children keep their size (no flex shrink) so a short window
            // scrolls the column instead of squashing the square hero card.
            className="flex-shrink-0 flex flex-col gap-5 [&>*]:flex-shrink-0"
            style={{
              width: DESKTOP_CARD_MAX_WIDTH,
              position: 'sticky',
              top: DESKTOP_STICKY_TOP,
              maxHeight: `calc(100vh - ${DESKTOP_STICKY_TOP}px)`,
              overflowY: 'auto',
              scrollbarWidth: 'none',
            }}
          >
            {/* Hero card — square */}
            <ProfileHeroCard profile={profile} name={name} aspectRatio="1/1" />

            {/* Profile info below the hero */}
            <ProfileInfo
              profile={profile}
              visibleSkills={visibleSkills}
              selectedTags={selectedTags}
              onToggleTag={toggleTag}
            />
          </div>

          {/* RIGHT COLUMN — scrollable stories feed */}
          <div className={`flex-1 min-w-0 pb-16 pl-6 ${visiblePosts.length === 0 ? 'flex flex-col items-center justify-center min-h-[60vh]' : ''}`}>
            {visiblePosts.length === 0 ? (
              <ProfileEmptyState isOwner={isOwner} hasTagFilter={selectedTags.length > 0} />
            ) : (
              <div className="flex flex-col gap-6">
                {visiblePosts.map((post) => (
                  <LazyMount
                    key={post.id}
                    data-story-id={post.id}
                    style={{ maxWidth: DESKTOP_CARD_MAX_WIDTH }}
                    placeholder={<div className="w-full rounded-2xl bg-[#ECE9E1] animate-pulse" style={{ maxWidth: DESKTOP_CARD_MAX_WIDTH, aspectRatio: '1/1' }} />}
                  >
                    {() => (
                      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ maxWidth: DESKTOP_CARD_MAX_WIDTH }}>
                        <StoryCard post={post} selectedTags={selectedTags} onToggleTag={toggleTag} kebab={storyKebab(post)} onTap={() => handleStoryTap(post.id)} />
                      </motion.div>
                    )}
                  </LazyMount>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FLOATING + BUTTON (owner only) */}
      {isOwner && (
        <button
          onClick={() => aiCarouselBuilderEnabled ? setShowNewStoryToggle(true) : navigate('/create')}
          className="fixed bottom-6 right-5 z-40 w-12 h-12 bg-[#262624] text-[#F4F2EC] rounded-full flex items-center justify-center shadow-lg hover:bg-[#30302E] active:scale-95 transition-all"
        >
          <Plus size={22} />
        </button>
      )}

      {/* WRITE / GENERATE TOGGLE (owner only, when AI builder is enabled) */}
      {isOwner && aiCarouselBuilderEnabled && (
        <WriteGenerateToggle
          open={showNewStoryToggle}
          onClose={() => setShowNewStoryToggle(false)}
          isPremium={isPremium}
          isAdmin={isAdmin}
          onSelectWrite={() => navigate('/create', { state: { mode: 'write' } })}
          onSelectGenerate={() => navigate('/create', { state: { mode: 'generate' } })}
          onSelectPromptTest={() => navigate('/prompt-test')}
        />
      )}

      {/* EDIT PROFILE MODAL */}
      <AnimatePresence>
        {showEdit && (
          <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EditProfileModal
              profile={profile}
              allTags={allTags}
              onClose={() => setShowEdit(false)}
              onSaved={async (updated) => {
                setProfile(p => ({ ...p, ...updated }));
                try {
                  const res = await base44.functions.invoke('getPublicProfile', { username });
                  const freshUser = res?.data?.user || null;
                  if (freshUser) setProfileUser({ ...freshUser, ...updated });
                } catch (e) { /* keep optimistic update */ }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* BURGER MENU */}
      <AnimatePresence>
        {showMenu && (
          <BurgerMenu user={profileUser} onClose={() => setShowMenu(false)} onArchivesChanged={reloadPosts} />
        )}
      </AnimatePresence>

      {/* REORDER STORIES */}
      {reorderMode && (
        <ReorderStories
          posts={sortedPosts}
          onSave={saveReorder}
          onCancel={() => setReorderMode(false)}
        />
      )}

      {/* CARD IMAGE EXPORT (admin-only) — starts on open, closes itself
          once the files are saved; stays open to show any error. */}
      {downloadPost && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900 truncate">{downloadPost.title || 'Story'} — card images</p>
              <button onClick={() => setDownloadPost(null)} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Close">
                <X size={16} />
              </button>
            </div>
            <DownloadCardsButton
              key={downloadPost.id}
              cards={downloadPost.cards}
              tokens={downloadPost.color_tokens}
              title={downloadPost.title}
              autoStart
              onDone={() => setDownloadPost(null)}
            />
          </div>
        </div>
      )}

      {/* DELETE STORY CONFIRMATION */}
      {pendingDelete && (
        <DeleteStoryModal
          title={pendingDelete.title}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* SHARE URL MODAL (clipboard fallback) */}
      {showShareModal && (
        <ShareUrlModal
          url={`${window.location.origin}/${username}`}
          onClose={() => setShowShareModal(false)}
        />
      )}

      <CopyToast show={showCopyToast} />
      </div>
    </div>
  );
}

function IconBtn({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-[#ECE9E1] active:bg-[#E6E0D2] transition-colors"
      style={{ color: HEADER_INK }}
    >
      {children}
    </button>
  );
}