import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { EdlComposition } from './EdlComposition';
import type { Edl } from './types';

const FPS = 30;

/** "9:16" -> {width, height} at a fixed 1920px long side. Falls back to 9:16 portrait
 *  on anything malformed — matches EdlComposition's centered-focus-point fallback. */
function parseAspect(aspect: string): { width: number; height: number } {
  const [wRatio, hRatio] = (aspect || '').split(':').map(Number);
  const longSide = 1920;
  if (!wRatio || !hRatio) return { width: 1080, height: 1920 };
  return hRatio >= wRatio
    ? { width: Math.round((longSide * wRatio) / hRatio), height: longSide }
    : { width: longSide, height: Math.round((longSide * hRatio) / wRatio) };
}

// durationInFrames/width/height below are placeholders — every real render overrides
// them via calculateMetadata, driven by the EDL passed as inputProps (server.mjs).
const Root: React.FC = () => (
  <Composition
    id="EdlClip"
    component={EdlComposition}
    durationInFrames={FPS * 10}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={{ edl: null as unknown as Edl }}
    calculateMetadata={async ({ props }) => {
      const { edl } = props;
      const { width, height } = parseAspect(edl.aspect);
      const durationInFrames = Math.max(1, Math.round((edl.out - edl.in) * FPS));
      return { durationInFrames, fps: FPS, width, height };
    }}
  />
);

registerRoot(Root);
