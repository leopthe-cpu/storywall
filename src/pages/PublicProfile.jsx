import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { getMe, getWall, updatePost, deletePost, reorderPosts, getPostForEditing, myStoryViewTotals } from '@/api/storywallApi';
import { Plus, Share2, Pencil, SelectFace3d, X } from '@/components/icons';
import { motion, AnimatePresence } from 'framer-motion';
import StoryCard from '@/components/profile/StoryCard';
import StoryKebab from '@/components/profile/StoryKebab';
import DeleteStoryModal from '@/components/profile/DeleteStoryModal';
import EditProfileModal from '@/components/profile/EditProfileModal';
import BurgerMenu from '@/components/profile/BurgerMenu';
import { wallThemeVars, wallTopbarIsLight } from '@/lib/wallTheme';
import { useToast } from '@/components/ui/use-toast';
import ProfileEmptyState from '@/components/profile/ProfileEmptyState';
import ShareUrlModal from '@/components/profile/ShareUrlModal';
import ShareStorySheet from '@/components/profile/ShareStorySheet';
import { shareAfterPublishSkipped } from '@/lib/shareStory';
import { captureVisitSource, withVia } from '@/lib/visitSource';
import CopyToast from '@/components/profile/CopyToast';
import WriteGenerateToggle from '@/components/creator/WriteGenerateToggle';
import { aiCarouselBuilderEnabled } from '@/lib/featureFlags';
import PrivateProfileState from '@/components/profile/PrivateProfileState';
import NotFoundProfileState from '@/components/profile/NotFoundProfileState';
import LazyMount from '@/components/profile/LazyMount';
import { CardFormatProvider } from '@/components/creator/CardFormatContext';
import { cardAspectRatio, cardSizeOf } from '@/lib/cardGeometry';
import { ProfileHeroCard, ProfileInfo } from '@/components/profile/ProfileHeader';
import PageLoader from '@/components/ui/PageLoader';
import useDocumentTitle from '@/lib/useDocumentTitle';

// Owner-only tools, loaded when first opened (performance plan §C): the
// reorder screen brings a drag-and-drop library (about 200 KB) and the card
// export its own code, which visitors to a wall never need.
const ReorderStories = lazy(() => import('@/components/profile/ReorderStories'));
const DownloadCardsButton = lazy(() => import('@/components/creator/DownloadCardsButton'));

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
// Desktop: picture column + feed form one block centred on the page, so the
// left and right margins match. Gap between them = gap-10 (40) + the feed's
// pl-6 (24); the block is exactly column + gap + one story card wide.
const DESKTOP_COLUMN_GAP = 40 + 24;
const DESKTOP_BLOCK_WIDTH = DESKTOP_CARD_MAX_WIDTH * 2 + DESKTOP_COLUMN_GAP;
// Container = block + px-8 on each side; the top bar uses the same width so
// the username and the buttons line up with the picture and the feed.
const DESKTOP_CONTAINER_WIDTH = DESKTOP_BLOCK_WIDTH + 2 * 32;

// Near-black used for the top bar's label and icons so they read as one set.
const HEADER_INK = 'var(--wall-topbar)';

// (Template demo content removed — every profile now shows only its own real data.)

// ── Main component ─────────────────────────────────────────────────────────

export default function PublicProfile() {
  // storyId: a shared story's link (/:username/:storyId) opens the wall on it.
  const { username, storyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileUser, setProfileUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState('loading');
  const [showEdit, setShowEdit] = useState(false);
  // Top bar: invisible over the page at rest, frosted glass once the page
  // scrolls (see the bar below).
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const [showMenu, setShowMenu] = useState(false);
  const [profile, setProfile] = useState(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  // Story whose cards are being exported as images (Premium, decision 53).
  const [downloadPost, setDownloadPost] = useState(null);
  // Story shown in "Share your story" (decision 53); afterPublish when it
  // opened by itself right after publishing.
  const [sharePost, setSharePost] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [authUserId, setAuthUserId] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLifetime, setIsLifetime] = useState(false);
  // Profile colours being tried in Settings, shown live before saving.
  const [themePreview, setThemePreview] = useState(null);
  // Lifetime: the owner's unique views per story, { [post id]: count }.
  const [viewTotals, setViewTotals] = useState(null);
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
          const data = (await getWall(username)) || {};
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
    getMe()
      .then(user => {
        setAuthUserId(user?.id ?? null);
        // Admin and premium come from my_access() (via getMe). They only
        // show/hide UI here; the server functions are the real gate.
        setIsAdmin(!!user?.is_admin);
        setIsPremium(!!user?.is_premium);
        setIsLifetime(!!user?.is_lifetime);
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

  // A Lifetime owner sees each story's unique views on their own wall.
  useEffect(() => {
    if (!isOwner || !isLifetime) { setViewTotals(null); return; }
    myStoryViewTotals().then(setViewTotals).catch(() => setViewTotals(null));
  }, [isOwner, isLifetime, username]);
  // Visitors' views are counted; the owner's never are (the server checks
  // too), and template placeholders aren't stories.
  const storyViewProps = (post) => ({
    trackViews: !isOwner && !String(post.id).startsWith('tpl'),
    uniqueViews: viewTotals ? (viewTotals[post.id] ?? 0) : undefined,
  });

  const allTags = [...new Set(posts.flatMap(p => p.tags || []))];
  // Pinned skills are only shown if at least one currently-published story
  // backs them. Stored pins for skills whose only story was archived/deleted
  // are kept in the DB but filtered out of the display — they reappear
  // automatically if the story is re-published.
  const visibleSkills = (profile?.skills || []).filter(s => allTags.includes(s));

  const [selectedTags, setSelectedTags] = useState([]);
  const toggleTag = (tag) => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  // Display order: pinned stories first (latest pin first, decision 51),
  // then explicit display_order ascending, then stories without an explicit
  // order by created_at descending (newest first).
  const sortedPosts = useMemo(() => {
    const pinned = posts.filter(p => p.pinned_at).sort((a, b) => new Date(b.pinned_at) - new Date(a.pinned_at));
    const rest = posts.filter(p => !p.pinned_at);
    const withOrder = rest.filter(p => p.display_order != null).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const withoutOrder = rest.filter(p => p.display_order == null).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return [...pinned, ...withOrder, ...withoutOrder];
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
    const url = withVia(`${window.location.origin}/${username}`);
    try {
      await navigator.clipboard.writeText(url);
      setShowCopyToast(true);
      setTimeout(() => setShowCopyToast(false), 2000);
    } catch {
      setShowShareModal(true);
    }
  };

  // Traffic sources (decision 53): note where this visit came from, then
  // drop ?via= from the address bar so it isn't copied on with the link.
  useEffect(() => {
    const rest = captureVisitSource(location.search);
    if (rest != null) navigate({ pathname: location.pathname, search: rest }, { replace: true, state: location.state });
  }, []);

  // Right after a publish, the builder sends the story's id along: open
  // "Share your story" for it (unless the owner chose not to see it again),
  // then drop it from the history entry so a reload or Back doesn't reopen it.
  const justPublished = location.state?.shareStory;
  useEffect(() => {
    if (!justPublished || !isOwner) return;
    const post = posts.find((p) => p.id === justPublished);
    if (!post) return;
    if (!shareAfterPublishSkipped()) setSharePost({ post, afterPublish: true });
    navigate(location.pathname, { replace: true, state: null });
  }, [justPublished, isOwner, posts]);

  // A story link: bring that story into view once the wall has loaded.
  // Stories above it mount and grow as the page scrolls past them (LazyMount,
  // pictures loading), which pushes it back down, so it is kept centred
  // while the page settles: on every size change for a few seconds, until
  // the visitor scrolls themselves.
  const centredStory = useRef(null);
  useEffect(() => {
    if (!storyId || loading || !posts.some((p) => p.id === storyId)) return;
    // Once per link: later changes to the list (a pin, a reload) don't move the page.
    if (centredStory.current === storyId) return;
    centredStory.current = storyId;
    const visible = () => [...document.querySelectorAll(`[data-story-id="${storyId}"]`)].find((el) => el.offsetParent !== null);
    const center = () => {
      const el = visible();
      if (!el) return;
      el.dispatchEvent(new CustomEvent('storywall:reveal'));
      el.scrollIntoView({ behavior: 'auto', block: 'center' });
    };
    const frame = requestAnimationFrame(center);
    const observer = new ResizeObserver(center);
    observer.observe(document.body);
    const stop = () => {
      observer.disconnect();
      clearTimeout(timer);
      ['wheel', 'touchstart', 'keydown'].forEach((t) => window.removeEventListener(t, stop));
    };
    const timer = setTimeout(stop, 4000);
    ['wheel', 'touchstart', 'keydown'].forEach((t) => window.addEventListener(t, stop, { passive: true }));
    return () => { cancelAnimationFrame(frame); stop(); };
  }, [storyId, loading, posts]);

  const handleEditStory = async (post) => navigate('/create', { state: { editStory: await getPostForEditing(post) } });

  // Lightweight reload — re-fetches posts without the retry/loading dance.
  const reloadPosts = useCallback(async () => {
    if (!username) return;
    try {
      const data = (await getWall(username)) || {};
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
      await updatePost(post.id, { status: 'archived' });
    } catch (e) {
      console.error('[PublicProfile] archive failed:', e);
      // Revert on failure
      setPosts(prev => [...prev, post]);
    }
  };

  // Pin or unpin a story. The 3-pin limit is checked here for a clear
  // message, and enforced by the database (posts_check_pinned).
  const togglePin = async (post) => {
    const pinning = !post.pinned_at;
    if (pinning && posts.filter(p => p.pinned_at).length >= 3) {
      toast({ title: 'You can pin up to 3 stories', description: 'Unpin one first.' });
      return;
    }
    const pinned_at = pinning ? new Date().toISOString() : null;
    setPosts(prev => prev.map(p => (p.id === post.id ? { ...p, pinned_at } : p)));
    try {
      await updatePost(post.id, { pinned_at });
    } catch (e) {
      console.error('[PublicProfile] pin failed:', e);
      setPosts(prev => prev.map(p => (p.id === post.id ? { ...p, pinned_at: post.pinned_at ?? null } : p)));
      toast({ variant: 'destructive', title: pinning ? "Couldn't pin this story" : "Couldn't unpin this story", description: 'Please try again.' });
    }
  };

  const confirmDelete = async () => {
    const post = pendingDelete;
    setPendingDelete(null);
    if (!post) return;
    setPosts(prev => prev.filter(p => p.id !== post.id));
    try {
      if (!String(post.id).startsWith('tpl')) await deletePost(post.id);
    } catch (e) { console.error(e); }
  };

  const saveReorder = async (newOrder) => {
    setReorderMode(false);
    const ordered = newOrder.map((p, i) => ({ ...p, display_order: i }));
    setPosts(ordered);
    try {
      await reorderPosts(ordered.map((p, i) => ({ id: p.id, display_order: i })));
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
      onTogglePin={String(post.id).startsWith('tpl') ? undefined : () => togglePin(post)}
      pinned={!!post.pinned_at}
      onShare={String(post.id).startsWith('tpl') ? undefined : () => setSharePost({ post, afterPublish: false })}
      onDownload={isPremium ? () => setDownloadPost(post) : undefined}
    />
  ) : null;

  if (loading) return <PageLoader />;

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
        // Wall colours are CSS variables (--wall-*, src/index.css); a
        // Lifetime supporter's profile colours replace them for this wall
        // (wallTheme.js). getPublicProfile only returns colours while the
        // owner has Lifetime.
        ...wallThemeVars(themePreview ?? profile?.wall_theme),
        background: 'var(--wall-bg)',
        backgroundImage: 'linear-gradient(var(--wall-grid) 1px, transparent 1px), linear-gradient(90deg, var(--wall-grid) 1px, transparent 1px)',
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
          background: 'radial-gradient(120% 100% at 50% 0%, transparent 0%, var(--wall-bg) 72%)',
        }}
      />

      <div className="relative z-10">

      {/* ── STICKY TOP BAR ── */}
      {/* Inner row uses the same width + horizontal padding as the page
          content below (px-4 mobile, DESKTOP_CONTAINER_WIDTH px-8 desktop), so
          the storywall.io/username label lines up with the profile picture's
          left edge and the buttons with the feed's right edge. Label and
          icons share one near-black ink colour (HEADER_INK). */}
      {/* Glass, Apple-style: at the top of the page the bar is fully
          transparent (it reads as part of the background, grid and all). Once
          the page scrolls it becomes a translucent tint of the page colour
          with a strong blur + saturation boost, so the cards' colours glow
          through it as they pass underneath, plus a hairline edge. */}
      <div
        className={`fixed top-0 left-0 right-0 z-30 py-1 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${
          scrolled ? 'shadow-[0_1px_12px_rgba(38,38,36,0.06)]' : 'bg-transparent border-transparent'
        }`}
        // The scrolled tint and edge are the page colours at 55% / 70%
        // (color-mix, since they're variables: Tailwind's /55 needs a fixed
        // colour).
        style={scrolled
          ? {
            backgroundColor: 'color-mix(in srgb, var(--wall-bg) 55%, transparent)',
            borderColor: 'color-mix(in srgb, var(--wall-grid) 70%, transparent)',
            backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          }
          : { backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
      >
        {/* Logo (wide desktop only): centred halfway between the window's
            left edge and the username, i.e. at a quarter of the left margin.
            Hidden below lg, where that margin is too narrow for it. */}
        <Link
          to="/"
          aria-label="Storywall home"
          className="hidden lg:block absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `calc((100% - ${DESKTOP_BLOCK_WIDTH}px) / 4)` }}
        >
          <img src={wallTopbarIsLight(themePreview ?? profile?.wall_theme) ? '/logo-slash-light.png' : '/logo-slash-ink.png'} alt="Storywall" className="h-[18px] w-auto" />
        </Link>
        <div className="mx-auto px-4 md:px-8 flex items-center justify-between" style={{ maxWidth: DESKTOP_CONTAINER_WIDTH }}>
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
        <div className="h-px bg-wall-grid mx-5 mt-5 mb-6" />
        <div className={`px-4 pb-20 ${visiblePosts.length === 0 ? 'flex flex-col items-center justify-center min-h-[45vh]' : ''}`}>
          {visiblePosts.length === 0 ? (
            <ProfileEmptyState isOwner={isOwner} hasTagFilter={selectedTags.length > 0} />
          ) : (
            <div className="flex flex-col gap-8">
              {visiblePosts.map((post) => (
                <LazyMount
                  key={post.id}
                  data-story-id={post.id}
                  placeholder={<div className="w-full rounded-2xl bg-wall-skeleton animate-pulse" style={{ aspectRatio: cardAspectRatio(cardSizeOf(post.cards?.[0], post.card_size)) }} />}
                >
                  {() => (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                      <StoryCard post={post} selectedTags={selectedTags} onToggleTag={toggleTag} kebab={storyKebab(post)} onTap={() => handleStoryTap(post.id)} {...storyViewProps(post)} />
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
        <div className="mx-auto px-8 flex gap-10 items-start" style={{ maxWidth: DESKTOP_CONTAINER_WIDTH, paddingTop: DESKTOP_CONTAINER_PAD, paddingBottom: DESKTOP_CONTAINER_PAD }}>

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
                    placeholder={<div className="w-full rounded-2xl bg-wall-surface animate-pulse" style={{ maxWidth: DESKTOP_CARD_MAX_WIDTH, aspectRatio: cardAspectRatio(cardSizeOf(post.cards?.[0], post.card_size)) }} />}
                  >
                    {() => (
                      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ maxWidth: DESKTOP_CARD_MAX_WIDTH }}>
                        <StoryCard post={post} selectedTags={selectedTags} onToggleTag={toggleTag} kebab={storyKebab(post)} onTap={() => handleStoryTap(post.id)} {...storyViewProps(post)} />
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
          className="fixed bottom-6 right-5 z-40 w-12 h-12 bg-wall-btn text-wall-btn-text rounded-full flex items-center justify-center shadow-lg hover:bg-wall-btn-hover active:scale-95 transition-all"
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
                  const freshUser = (await getWall(username))?.user || null;
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
          <BurgerMenu
            user={profileUser}
            onClose={() => { setShowMenu(false); setThemePreview(null); }}
            onArchivesChanged={reloadPosts}
            onThemePreview={setThemePreview}
            onThemeSaved={(wall_theme) => setProfile((p) => (p ? { ...p, wall_theme } : p))}
          />
        )}
      </AnimatePresence>

      {/* REORDER STORIES */}
      {reorderMode && (
        <Suspense fallback={null}>
          <ReorderStories
            posts={sortedPosts}
            onSave={saveReorder}
            onCancel={() => setReorderMode(false)}
          />
        </Suspense>
      )}

      {/* SHARE YOUR STORY (owner, decision 53) */}
      <AnimatePresence>
        {sharePost && isOwner && (
          <ShareStorySheet
            key={sharePost.post.id}
            post={sharePost.post}
            username={profileUser?.username || username}
            isPremium={isPremium}
            afterPublish={sharePost.afterPublish}
            onClose={() => setSharePost(null)}
          />
        )}
      </AnimatePresence>

      {/* CARD IMAGE EXPORT (Premium) — starts on open, closes itself
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
            <Suspense fallback={null}>
              <CardFormatProvider value={downloadPost.card_size}>
                <DownloadCardsButton
                  key={downloadPost.id}
                  cards={downloadPost.cards}
                  tokens={downloadPost.color_tokens}
                  title={downloadPost.title}
                  autoStart
                  onDone={() => setDownloadPost(null)}
                />
              </CardFormatProvider>
            </Suspense>
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
          url={withVia(`${window.location.origin}/${username}`)}
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
      className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-wall-surface active:bg-wall-grid transition-colors"
      style={{ color: HEADER_INK }}
    >
      {children}
    </button>
  );
}