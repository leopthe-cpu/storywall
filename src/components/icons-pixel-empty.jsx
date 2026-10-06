// Pixel-styled icons (Pixelarticons, https://github.com/halfmage/pixelarticons,
// MIT), kept ONLY for the app's two empty-state placeholders — the rest of
// the app moved to Iconoir (see '@/components/icons') for a more modern,
// Apple-like look. These two stay pixel on purpose (matches the 8-bit
// PixelSpinner and gives empty states their own distinct, playful feel):
//   - the "wall/story list is empty" diamond-sparkle icon
//   - the "no profile picture yet" camera placeholder
//
// Same drop-in shape as the old app-wide icons.jsx: size/color/className
// props work the same way.
import * as P from 'pixelarticons/react';

function wrap(Pixel, name) {
  function Icon({ size = 24, color, strokeWidth, absoluteStrokeWidth, fill, style, ...rest }) {
    return (
      <Pixel
        width={size}
        height={size}
        shapeRendering="crispEdges"
        aria-hidden={rest['aria-label'] ? undefined : true}
        style={color ? { color, ...style } : style}
        {...rest}
      />
    );
  }
  Icon.displayName = `PixelIcon(${name})`;
  return Icon;
}

export const PixelSparkles = wrap(P.Sparkles, 'PixelSparkles');
export const PixelCamera = wrap(P.Camera, 'PixelCamera');
