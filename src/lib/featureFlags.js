// Feature flags — flip these to enable/disable features without code restructuring

export const ENABLE_DARK_MODE = false;

// When false, the Templates and Styles tabs are hidden from the Cards panel
export const SHOW_TEMPLATES_AND_STYLES = false;

// When true, the Templates tab is shown in the Cards panel with the 6 launch
// templates. Can be restricted to a paid plan later without further engineering.
export const templatesEnabled = true;

// When false, video and audio entry points are hidden from the media panel
// (record audio, video file picker, and video/audio gallery thumbnails).
// The underlying code remains so it can be re-enabled without code changes.
export const ENABLE_VIDEO_AND_AUDIO = false;

// AI Carousel Builder (Generate mode) — master kill switch.
// When false, the ENTIRE Generate pipeline is hidden: no Write/Generate toggle,
// no Notes view, no Base44.com/Wan calls — regardless of a user's premium
// value. This is independent of the premium flag; its only purpose is a fast
// app-wide off switch if Base44.com or Wan misbehave in production.
export const aiCarouselBuilderEnabled = true;