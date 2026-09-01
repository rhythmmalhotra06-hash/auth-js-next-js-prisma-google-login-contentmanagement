import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Edl, ReframeKeyframe } from './types';

/**
 * Renders one EDL as a Remotion composition. Reframe is applied via CSS `object-fit:
 * cover` + `object-position` rather than pixel-accurate crop math — cover already
 * scales correctly to fill the frame at the right aspect without distortion, and
 * object-position lets the focus point (the EDL's `reframe.keyframes[].x/y`) move over
 * time for "speaker_track" mode. This deliberately does NOT use the keyframes' `w`/`h`
 * fields — those are kept in the EDL contract for a future finer-grained crop, unused
 * here. Simpler and more robust than computing an arbitrary crop rect without knowing
 * the source video's actual pixel dimensions up front.
 */
export function EdlComposition({ edl }: { edl: Edl }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const clipDurationSec = edl.out - edl.in;
  const { x, y } = focusPointAt(edl.reframe.keyframes, frame / fps, clipDurationSec);

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <OffthreadVideo
        src={edl.source_uri}
        startFrom={Math.round(edl.in * fps)}
        endAt={Math.round(edl.out * fps)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${x * 100}% ${y * 100}%` }}
      />
      {edl.captions.map((c, i) => {
        const from = Math.round(c.t_in * fps);
        const durationInFrames = Math.max(1, Math.round((c.t_out - c.t_in) * fps));
        return (
          <Sequence key={i} from={from} durationInFrames={durationInFrames}>
            <div
              style={{
                position: 'absolute',
                left: `${c.x * 100}%`,
                top: `${c.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                fontFamily: c.font,
                fontWeight: c.weight,
                fontSize: c.size_px,
                color: 'white',
                textAlign: 'center',
                textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                maxWidth: '90%',
                whiteSpace: 'pre-wrap',
              }}
            >
              {c.text}
            </div>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

/** Static mode: constant focus point from the single keyframe. Speaker-track mode:
 *  linearly interpolate between whichever two keyframes bracket the current time. */
function focusPointAt(keyframes: ReframeKeyframe[], tSec: number, clipDurationSec: number): { x: number; y: number } {
  if (keyframes.length === 0) return { x: 0.5, y: 0.5 }; // centered fallback — should never happen, EDL validation requires ≥1
  if (keyframes.length === 1) return { x: keyframes[0].x, y: keyframes[0].y };

  const t = Math.max(0, Math.min(tSec, clipDurationSec));
  let prev = keyframes[0];
  let next = keyframes[keyframes.length - 1];
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (t >= keyframes[i].t && t <= keyframes[i + 1].t) {
      prev = keyframes[i];
      next = keyframes[i + 1];
      break;
    }
  }
  if (prev === next || next.t === prev.t) return { x: prev.x, y: prev.y };
  const x = interpolate(t, [prev.t, next.t], [prev.x, next.x], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = interpolate(t, [prev.t, next.t], [prev.y, next.y], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return { x, y };
}
