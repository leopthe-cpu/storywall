// App-wide icon set: Iconoir (https://github.com/iconoir-icons/iconoir, MIT),
// chosen for a cleaner, more restrained "Apple-like" look than the pixel set.
//
// This module is a drop-in: it exports the SAME names the app has always
// imported (X, ChevronLeft, Trash2 ...) so every existing call site keeps
// working, and every existing `size` / `color` / `className` prop keeps
// working too. Import icons from here, never from 'iconoir-react' directly
// (two exceptions noted below), so the whole app stays on one icon style and
// a future swap is a one-file change.
//
// Exceptions — two pixel-only empty-state icons live in
// '@/components/icons-pixel-empty' instead (see that file for why):
// the "wall is empty" state and the "no profile picture yet" placeholder.
// Everywhere else, including the OTHER call sites of Sparkles/Camera below
// (an AI-generate badge, a camera menu entry), uses the Iconoir versions
// exported from this file as normal.
//
// Differences from the old pixel set worth knowing:
// - Iconoir icons are STROKED outlines, not filled pixel shapes, so they
//   scale smoothly at any size (no more crispEdges/24px-grid tricks).
// - Default stroke width is 1.8 (a light, Apple-Settings-app weight) —
//   pass `strokeWidth` to override per call site.
// - `absoluteStrokeWidth` and `fill` are accepted and ignored, same as
//   before — some call sites still pass a `fill` prop harmlessly.
import * as I from 'iconoir-react';

function wrap(IconoirIcon, name) {
  function Icon({ size = 24, color, strokeWidth = 1.8, absoluteStrokeWidth, fill, style, ...rest }) {
    return (
      <IconoirIcon
        width={size}
        height={size}
        strokeWidth={strokeWidth}
        aria-hidden={rest['aria-label'] ? undefined : true}
        style={color ? { color, ...style } : style}
        {...rest}
      />
    );
  }
  Icon.displayName = `Icon(${name})`;
  return Icon;
}

// old (lucide/pixel) name → Iconoir name. Picked by eye from the full
// Iconoir set for the closest look/meaning; where there was no exact twin
// the closest meaning wins (noted).
export const X = wrap(I.Xmark, 'X');
export const Check = wrap(I.Check, 'Check');
export const EmojiSad = wrap(I.EmojiSad, 'EmojiSad');
export const ChevronLeft = wrap(I.NavArrowLeft, 'ChevronLeft');
export const ChevronRight = wrap(I.NavArrowRight, 'ChevronRight');
export const ChevronDown = wrap(I.NavArrowDown, 'ChevronDown');
export const ChevronUp = wrap(I.NavArrowUp, 'ChevronUp');
export const ArrowLeft = wrap(I.ArrowLeft, 'ArrowLeft');
export const ArrowRight = wrap(I.ArrowRight, 'ArrowRight');
export const Plus = wrap(I.Plus, 'Plus');
export const Minus = wrap(I.Minus, 'Minus');
export const Play = wrap(I.Play, 'Play');
export const Pause = wrap(I.Pause, 'Pause');
export const Pencil = wrap(I.Edit, 'Pencil');
export const Trash2 = wrap(I.Trash, 'Trash2');
export const Circle = wrap(I.Circle, 'Circle');
export const Square = wrap(I.Square, 'Square');
export const Sparkles = wrap(I.MagicWand, 'Sparkles'); // no literal sparkle glyph; magic wand reads the same for an AI-generate badge
export const RotateCw = wrap(I.Redo, 'RotateCw'); // no plain rotate arrow; redo reads the same
export const RotateCcw = wrap(I.Undo, 'RotateCcw');
export const Undo2 = wrap(I.Undo, 'Undo2');
export const Redo2 = wrap(I.Redo, 'Redo2');
export const RefreshCw = wrap(I.Refresh, 'RefreshCw');
export const MoreHorizontal = wrap(I.MoreHoriz, 'MoreHorizontal');
export const MoreVertical = wrap(I.MoreVert, 'MoreVertical');
export const GripVertical = wrap(I.MoreVert, 'GripVertical'); // no grip icon; dotted column
export const Menu = wrap(I.Menu, 'Menu');
export const Search = wrap(I.Search, 'Search');
export const ZoomIn = wrap(I.ZoomIn, 'ZoomIn');
export const ZoomOut = wrap(I.ZoomOut, 'ZoomOut');
export const Mic = wrap(I.Microphone, 'Mic');
export const Music = wrap(I.MusicNote, 'Music');
export const Video = wrap(I.VideoCamera, 'Video');
export const Film = wrap(I.Movie, 'Film');
export const Camera = wrap(I.Camera, 'Camera');
export const Image = wrap(I.MediaImage, 'Image');
export const ImageIcon = wrap(I.MediaImage, 'ImageIcon');
export const ImagePlus = wrap(I.MediaImagePlus, 'ImagePlus');
export const Lock = wrap(I.Lock, 'Lock');
export const ShieldCheck = wrap(I.ShieldCheck, 'ShieldCheck');
export const Copy = wrap(I.Copy, 'Copy');
export const Clipboard = wrap(I.PasteClipboard, 'Clipboard');
export const Paperclip = wrap(I.Attachment, 'Paperclip');
export const Link = wrap(I.Link, 'Link');
export const Share2 = wrap(I.ShareIos, 'Share2'); // Apple's own share-arrow glyph
export const Download = wrap(I.Download, 'Download');
export const Archive = wrap(I.Archive, 'Archive');
export const FolderOpen = wrap(I.Folder, 'FolderOpen');
export const FileEdit = wrap(I.PageEdit, 'FileEdit');
export const AlertCircle = wrap(I.WarningCircle, 'AlertCircle');
export const Globe = wrap(I.Globe, 'Globe');
export const LogOut = wrap(I.LogOut, 'LogOut');
export const Loader2 = wrap(I.Refresh, 'Loader2'); // callers add animate-spin
export const Type = wrap(I.Text, 'Type');
export const AlignLeft = wrap(I.AlignLeft, 'AlignLeft');
export const AlignCenter = wrap(I.AlignCenter, 'AlignCenter');
export const AlignRight = wrap(I.AlignRight, 'AlignRight');
export const Pipette = wrap(I.ColorPicker, 'Pipette');
export const Palette = wrap(I.Palette, 'Palette');
export const Eraser = wrap(I.Erase, 'Eraser');
export const FlaskConical = wrap(I.TestTube, 'FlaskConical');
export const PanelLeft = wrap(I.LayoutLeft, 'PanelLeft');

// Iconoir has one generic "Flip" glyph, not separate horizontal/vertical
// ones — rotate it 90° for the vertical variant so the two read distinctly.
const FlipBase = wrap(I.Flip, 'Flip');
export function FlipHorizontal(props) {
  return <FlipBase {...props} />;
}
export function FlipVertical({ style, ...rest }) {
  return <FlipBase style={{ transform: 'rotate(90deg)', ...style }} {...rest} />;
}

// Two icons picked directly by Oz (not part of the lucide/pixel-name
// mapping above): builder's back-to-wall button, and the profile page's
// settings button (was a hamburger/Menu glyph).
export const PerspectiveView = wrap(I.PerspectiveView, 'PerspectiveView');
export const SelectFace3d = wrap(I.SelectFace3d, 'SelectFace3d');
