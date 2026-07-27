'use client';

import { useRef, useState } from 'react';
import * as htmlToImage from 'html-to-image';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Slider } from '@/components/ui/Slider';
import { Toggle } from '@/components/ui/Toggle';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import { TITLE_FONTS, DEFAULT_TITLE_FONT } from './fonts';
import { saveCoverToClip } from './actions';
import sample from './assets/sample.jpg';

// ── Cover artwork palette (team-approved, NOT app chrome) ──────────────────
// These are the colors that get rendered INTO the exported cover, so they stay
// as the approved literal values from the standalone tool rather than app tokens.
const HIGHLIGHT_PURPLE = '#9b37f2';
const HIGHLIGHT_YELLOW = '#f5c919';
const NAME_WHITE = '#fff';
const NAME_BLACK = '#0f131a';
const PURPLE_FILL = 'linear-gradient(160deg,#7a12d4 0%,#c2379f 100%)';

const SCALE = 3; // preview is 1/3 scale, so 1 screen px = 3 stage px

type Layout = '1a' | '1d';
type Pos = 'top' | 'bottom';
type Align = 'left' | 'center';

export interface CoverGeneratorProps {
  initialHook?: string;
  initialKeyword?: string;
  initialName?: string;
  clipId?: string; // present when launched from a clip → enables "Save to clip"
}

// Small segmented-control button — app chrome, so it uses tokens.
function Seg({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-md border px-3.5 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:shadow-[var(--mv-shadow-focus)]',
        active
          ? 'border-brand bg-brand-soft text-brand-content'
          : 'border-border-default bg-surface text-text-muted hover:bg-bg-subtle',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function CoverGenerator({ initialHook, initialKeyword, initialName, clipId }: CoverGeneratorProps) {
  const [layout, setLayout] = useState<Layout>('1a');
  const [hook, setHook] = useState(initialHook || 'The 6-Phase Meditation that rewires your brain');
  // When arriving prefilled from a clip, don't inherit the sample's keyword.
  const [keyword, setKeyword] = useState(initialKeyword ?? (initialHook ? '' : 'rewires'));
  const [name, setName] = useState(initialName || 'Vishen');
  const [img, setImg] = useState<string>(sample.src);
  const [accent, setAccent] = useState(HIGHLIGHT_PURPLE);
  const [pos, setPos] = useState<Pos>('top');
  const [align, setAlign] = useState<Align>('left');
  const [titleSize, setTitleSize] = useState(98);
  const [imgX, setImgX] = useState(0);
  const [imgY, setImgY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [imgNatW, setImgNatW] = useState(0);
  const [imgNatH, setImgNatH] = useState(0);
  const [showSafe, setShowSafe] = useState(false);
  const [lockX, setLockX] = useState(true);
  const [fill, setFill] = useState<'blur' | 'purple'>('blur');
  const [nameColor, setNameColor] = useState(NAME_WHITE);
  const [shadow, setShadow] = useState(false);
  const [overlay, setOverlay] = useState(true);
  const [font, setFont] = useState(DEFAULT_TITLE_FONT);
  const [customFonts, setCustomFonts] = useState<{ name: string; stack: string }[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const scalerRef = useRef<HTMLDivElement>(null);
  // Mirror the latest positional state so the drag handlers read fresh values.
  const latest = useRef({ imgX, imgY, zoom, lockX, imgNatW, imgNatH });
  latest.current = { imgX, imgY, zoom, lockX, imgNatW, imgNatH };

  const clampPos = (x: number, y: number, z: number) => {
    const nw = latest.current.imgNatW || 1080;
    const nh = latest.current.imgNatH || 1920;
    const rw = 1080 * z;
    const rh = 1080 * (nh / nw) * z;
    const maxX = rw / 2 + 1080;
    const maxY = rh / 2 + 1920;
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    setImgNatW(el.naturalWidth);
    setImgNatH(el.naturalHeight);
  };

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const t = 'touches' in e ? e.touches[0] : e;
    const sx = t.clientX;
    const sy = t.clientY;
    const { imgX: ix, imgY: iy, zoom: z, lockX: lock } = latest.current;
    const move = (ev: MouseEvent | TouchEvent) => {
      const p = 'touches' in ev ? ev.touches[0] : ev;
      const nx = lock ? ix : ix + (p.clientX - sx) * SCALE;
      const ny = iy + (p.clientY - sy) * SCALE;
      const c = clampPos(nx, ny, z);
      setImgX(c.x);
      setImgY(c.y);
      if (ev.cancelable) ev.preventDefault();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
  };

  const resetImg = () => {
    setImgX(0);
    setImgY(0);
    setZoom(1);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setImg(String(r.result));
    r.readAsDataURL(f);
  };

  const onFontFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fname = f.name.replace(/\.[^.]+$/, '');
    const r = new FileReader();
    r.onload = async () => {
      try {
        const face = new FontFace(fname, r.result as ArrayBuffer);
        await face.load();
        document.fonts.add(face);
        const stack = `'${fname}',sans-serif`;
        setCustomFonts((prev) => (prev.some((c) => c.stack === stack) ? prev : [...prev, { name: fname, stack }]));
        setFont(stack);
      } catch (err) {
        console.error('font load failed', err);
      }
    };
    r.readAsArrayBuffer(f);
  };

  const toDataURL = async (src: string) => {
    const res = await fetch(src);
    const b = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(b);
    });
  };

  const fileSlug = () => {
    const slug = (s: string) =>
      (s || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    return [...slug(name), ...slug(hook).slice(0, 3)].join('-') || 'clip-cover';
  };

  // Capture the un-scaled 1080×1920 stage 1:1. Shared by download (PNG) and
  // save-back (JPEG). Preserves the proven prototype gotchas: remove the preview
  // transform, wait for fonts, warm-up render, pin width/height + canvas.
  const capture = async (kind: 'png' | 'jpeg'): Promise<string> => {
    const stage = stageRef.current!;
    const scaler = scalerRef.current;
    const prevTransform = scaler ? scaler.style.transform : '';
    if (scaler) scaler.style.transform = 'none';
    const imgs = Array.from(stage.querySelectorAll('img'));
    const origSrc = imgs.map((i) => i.src);
    const restore = () => {
      imgs.forEach((i, ix) => (i.src = origSrc[ix]));
      if (scaler) scaler.style.transform = prevTransform;
    };
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      // html-to-image can't embed blob: URLs — swap to data URIs, restore after.
      for (const i of imgs) if (i.src.startsWith('blob:')) i.src = await toDataURL(i.src);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      // Pin node + canvas to 1080×1920 → 1:1 capture, correct wrap, no squash.
      const opts = { width: 1080, height: 1920, canvasWidth: 1080, canvasHeight: 1920, pixelRatio: 1, style: { transform: 'none', margin: '0' } };
      if (kind === 'jpeg') {
        const jpegOpts = { ...opts, quality: 0.92, backgroundColor: '#000' };
        await htmlToImage.toJpeg(stage, jpegOpts); // warm-up so the embedded font is used
        const url = await htmlToImage.toJpeg(stage, jpegOpts);
        restore();
        return url;
      }
      await htmlToImage.toPng(stage, opts); // warm-up
      const url = await htmlToImage.toPng(stage, opts);
      restore();
      return url;
    } catch (err) {
      restore();
      throw err;
    }
  };

  const download = async () => {
    if (!stageRef.current || downloading) return;
    setDownloading(true);
    try {
      const url = await capture('png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileSlug()}.png`;
      a.click();
    } catch (err) {
      console.error('export failed', err);
    }
    setDownloading(false);
  };

  // Save-back: JPEG (keeps the payload under Airtable's ~5MB attachment cap) →
  // server action attaches it to the clip's record. Never blocks the download.
  const saveToClip = async () => {
    if (!stageRef.current || !clipId || saving) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const dataUrl = await capture('jpeg');
      const res = await saveCoverToClip({ clipId, dataUrl, filename: `${fileSlug()}.jpg` });
      setSaveMsg(res.ok ? { ok: true, text: 'Saved to the clip in Airtable.' } : { ok: false, text: res.error });
    } catch (err) {
      setSaveMsg({ ok: false, text: err instanceof Error ? err.message : 'Save failed.' });
    }
    setSaving(false);
  };

  // ── Derived values (mirror the prototype's renderVals) ────────────────────
  const isYellow = accent === HIGHLIGHT_YELLOW;
  const markerText = isYellow ? '#1a1206' : '#fff';
  let pre = hook;
  let kw = '';
  let post = '';
  if (keyword.trim()) {
    const i = hook.toLowerCase().indexOf(keyword.toLowerCase());
    if (i >= 0) {
      pre = hook.slice(0, i);
      kw = hook.slice(i, i + keyword.length);
      post = hook.slice(i + keyword.length);
    }
  }
  const imgTransform = `translate(${imgX}px,${imgY}px) scale(${zoom})`;
  const textShadow = shadow ? '0 4px 24px rgba(0,0,0,.55), 0 1px 3px rgba(0,0,0,.5)' : 'none';
  const overlayDisplay = overlay ? 'block' : 'none';
  const is1d = layout === '1d';
  const isTop = pos === 'top';

  const titleLeft = is1d ? (align === 'left' ? '120px' : '64px') : align === 'left' ? '128px' : '72px';
  const titleWidthTop = is1d
    ? `${align === 'left' ? 1016 - 120 : 1016 - 64}px`
    : `${align === 'left' ? 1008 - 128 : 1008 - 72}px`;

  const keywordSpan = is1d ? (
    <span
      style={{
        background: accent,
        WebkitBoxDecorationBreak: 'clone',
        boxDecorationBreak: 'clone',
        padding: '4px 18px',
        color: markerText,
      }}
    >
      {kw}
    </span>
  ) : (
    <span style={{ color: accent }}>{kw}</span>
  );
  const titleInner = (
    <>
      {pre}
      {keywordSpan}
      {post}
    </>
  );

  const titleTypeStyle: React.CSSProperties = {
    position: 'absolute',
    whiteSpace: 'pre-wrap',
    fontSize: `${titleSize}px`,
    lineHeight: is1d ? 1.24 : 0.98,
    fontWeight: 700,
    letterSpacing: '-.02em',
    fontFamily: font,
    color: '#fff',
    textShadow,
    textAlign: align,
  };
  const titlePosStyle: React.CSSProperties = isTop
    ? { top: '200px', left: titleLeft, width: titleWidthTop }
    : { left: is1d ? '64px' : '72px', width: is1d ? '952px' : '936px', bottom: '640px' };

  const nameStyle: React.CSSProperties = {
    position: 'absolute',
    left: '72px',
    right: '72px',
    bottom: '400px',
    textAlign: 'center',
    color: nameColor,
    fontSize: '49px',
    fontWeight: 700,
    letterSpacing: '-.01em',
  };

  const topOverlay = is1d
    ? 'linear-gradient(180deg,rgba(0,0,0,.7) 0%,rgba(0,0,0,.35) 50%,rgba(0,0,0,0) 100%)'
    : 'linear-gradient(180deg,rgba(0,0,0,.82) 0%,rgba(0,0,0,.5) 45%,rgba(0,0,0,0) 100%)';
  const bottomOverlay = is1d
    ? 'linear-gradient(0deg,rgba(0,0,0,.82) 0%,rgba(0,0,0,.5) 40%,rgba(0,0,0,0) 100%)'
    : 'linear-gradient(0deg,rgba(0,0,0,.86) 0%,rgba(0,0,0,.55) 40%,rgba(0,0,0,0) 100%)';

  return (
    <div className="flex flex-wrap items-start gap-10">
      {/* ── Controls (app chrome) ─────────────────────────────────────────── */}
      <div className="min-w-[320px] flex-1 basis-[380px] space-y-5">
        {/* Portrait upload + reposition */}
        <div className="card pad space-y-3">
          <span className="block text-2xs font-medium uppercase tracking-wide text-text-muted">Portrait (9:16)</span>
          <label className="flex cursor-pointer items-center gap-4 rounded-md border border-dashed border-border-strong bg-bg-subtle p-3.5 hover:border-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="" className="h-24 w-[54px] flex-none rounded-sm object-cover" />
            <div>
              <div className="text-sm font-medium text-text">Click to upload image</div>
              <div className="mt-0.5 text-xs text-text-subtle">JPG or PNG · vertical crop works best</div>
            </div>
            <input type="file" accept="image/*" onChange={onFile} className="hidden" />
          </label>
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-subtle">
              Drag to reposition · Zoom {Math.round(zoom * 100)}% · zoom out to see full image
            </span>
            <button type="button" onClick={resetImg} className="text-xs font-medium text-brand hover:underline">
              Reset
            </button>
          </div>
          <Slider min={40} max={200} step={2} value={Math.round(zoom * 100)} onChange={(e) => {
            const z = Number(e.target.value) / 100;
            const c = clampPos(imgX, imgY, z);
            setZoom(z);
            setImgX(c.x);
            setImgY(c.y);
          }} />
          <Toggle checked={lockX} onChange={setLockX} label="Vertical drag only" hint="lock horizontal" />
        </div>

        <div className="card pad space-y-5">
          {/* Background fill */}
          <div className="space-y-2">
            <span className="block text-2xs font-medium uppercase tracking-wide text-text-muted">
              Background fill <span className="normal-case text-text-subtle">· if image doesn’t cover</span>
            </span>
            <div className="flex gap-3">
              <Seg active={fill === 'blur'} onClick={() => setFill('blur')}>Blurred photo</Seg>
              <Seg active={fill === 'purple'} onClick={() => setFill('purple')}>MV Purple</Seg>
            </div>
          </div>

          {/* Highlight color */}
          <div className="space-y-2">
            <span className="block text-2xs font-medium uppercase tracking-wide text-text-muted">Highlight color</span>
            <div className="flex gap-3">
              <Seg active={!isYellow} onClick={() => setAccent(HIGHLIGHT_PURPLE)}>
                <span className="flex items-center gap-2.5">
                  <span className="h-5 w-5 flex-none rounded-full" style={{ background: '#7a12d4' }} />MV Purple
                </span>
              </Seg>
              <Seg active={isYellow} onClick={() => setAccent(HIGHLIGHT_YELLOW)}>
                <span className="flex items-center gap-2.5">
                  <span className="h-5 w-5 flex-none rounded-full" style={{ background: HIGHLIGHT_YELLOW }} />Yellow
                </span>
              </Seg>
            </div>
          </div>

          {/* Layout */}
          <div className="space-y-2">
            <span className="block text-2xs font-medium uppercase tracking-wide text-text-muted">Layout</span>
            <div className="flex gap-3">
              <Seg active={layout === '1a'} onClick={() => setLayout('1a')}>
                <div className="font-semibold">1a · Highlight</div>
                <div className="mt-0.5 text-xs opacity-80">Scrim + keyword accent</div>
              </Seg>
              <Seg active={layout === '1d'} onClick={() => setLayout('1d')}>
                <div className="font-semibold">1d · Marker</div>
                <div className="mt-0.5 text-xs opacity-80">Highlighted marker block</div>
              </Seg>
            </div>
          </div>

          {/* Text align */}
          <div className="space-y-2">
            <span className="block text-2xs font-medium uppercase tracking-wide text-text-muted">Text align</span>
            <div className="flex gap-3">
              <Seg active={align === 'left'} onClick={() => setAlign('left')} className="text-center">Left</Seg>
              <Seg active={align === 'center'} onClick={() => setAlign('center')} className="text-center">Center</Seg>
            </div>
          </div>

          {/* Title position */}
          <div className="space-y-2">
            <span className="block text-2xs font-medium uppercase tracking-wide text-text-muted">Title position</span>
            <div className="flex gap-3">
              <Seg active={pos === 'top'} onClick={() => setPos('top')} className="text-center">Top</Seg>
              <Seg active={pos === 'bottom'} onClick={() => setPos('bottom')} className="text-center">Bottom</Seg>
            </div>
          </div>
        </div>

        <div className="card pad space-y-5">
          <Field label="Hook title" hint="press Enter for a line break">
            <Textarea rows={3} value={hook} onChange={(e) => setHook(e.target.value)} />
          </Field>

          <div className="flex gap-4">
            <div className="flex-1">
              <Field label="Highlight word" hint="1a & 1d">
                <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
              </Field>
            </div>
            <div className="flex-1 space-y-2.5">
              <Field label="Author name">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <div className="flex gap-3">
                <Seg active={nameColor === NAME_WHITE} onClick={() => setNameColor(NAME_WHITE)} className="text-center">White</Seg>
                <Seg active={nameColor !== NAME_WHITE} onClick={() => setNameColor(NAME_BLACK)} className="text-center">Black</Seg>
              </div>
            </div>
          </div>

          <Field label="Title font">
            <Select value={font} onChange={(e) => setFont(e.target.value)}>
              {TITLE_FONTS.map((f) => (
                <option key={f.label} value={f.stack}>
                  {f.label}
                </option>
              ))}
              {customFonts.map((cf) => (
                <option key={cf.stack} value={cf.stack}>
                  {cf.name} · custom
                </option>
              ))}
            </Select>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-brand">
              <input type="file" accept=".ttf,.otf,.woff,.woff2,font/*" onChange={onFontFile} className="hidden" />
              <Icon name="upload" size={13} /> Upload custom font
              <span className="font-normal text-text-subtle">(.ttf .otf .woff .woff2)</span>
            </label>
          </Field>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-text">
              Title size <span className="text-text-subtle">· {titleSize}px · default 98px</span>
            </label>
            <Slider min={60} max={140} step={2} value={titleSize} onChange={(e) => setTitleSize(Number(e.target.value))} />
            <Toggle checked={shadow} onChange={setShadow} label="Title shadow" hint="for light or busy backgrounds" />
            <Toggle checked={overlay} onChange={setOverlay} label="Gradient overlay" hint="dark scrim behind title" />
          </div>

          <Button onClick={download} className="w-full rounded-full" disabled={downloading}>
            {downloading ? 'Preparing…' : 'Download PNG'}
          </Button>

          {/* Save-back — only when launched from a clip. */}
          {clipId && (
            <div className="space-y-2">
              <Button
                variant="secondary"
                onClick={saveToClip}
                className="w-full rounded-full"
                disabled={saving}
              >
                <Icon name="upload" size={15} /> {saving ? 'Saving…' : 'Save cover to clip'}
              </Button>
              {saveMsg && (
                <p
                  className={cn(
                    'rounded-sm px-3 py-2 text-sm',
                    saveMsg.ok ? 'bg-success-soft text-success-content' : 'bg-danger-soft text-danger-content',
                  )}
                >
                  {saveMsg.text}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Preview (the exported artwork) ─────────────────────────────────── */}
      <div className="sticky top-6 flex flex-none flex-col items-center gap-3.5 self-start">
        <div
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
          className="relative h-[640px] w-[360px] cursor-grab overflow-hidden rounded-[22px] bg-black shadow-[var(--mv-shadow-strong)]"
        >
          <div ref={scalerRef} className="absolute top-0 left-0 origin-top-left" style={{ transform: 'scale(0.33333)' }}>
            <div ref={stageRef} className="relative overflow-hidden bg-black" style={{ width: 1080, height: 1920 }}>
              {img && (
                <>
                  <div
                    style={{ position: 'absolute', inset: 0, background: fill === 'purple' ? PURPLE_FILL : '#000' }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt=""
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      ...(fill === 'blur'
                        ? { filter: 'blur(48px) brightness(.7)', transform: 'scale(1.15)', opacity: 1 }
                        : { opacity: 0 }),
                    }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt=""
                    draggable={false}
                    onLoad={onImgLoad}
                    style={{
                      position: 'absolute',
                      width: '1080px',
                      height: 'auto',
                      top: '50%',
                      left: '50%',
                      transform: `translate(-50%,-50%) ${imgTransform}`,
                      transformOrigin: 'center',
                    }}
                  />
                </>
              )}

              {isTop ? (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '600px',
                    display: overlayDisplay,
                    background: topOverlay,
                  }}
                />
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: '900px',
                    display: overlayDisplay,
                    background: bottomOverlay,
                  }}
                />
              )}

              {isTop && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: '420px',
                    background: 'linear-gradient(0deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,0) 100%)',
                  }}
                />
              )}

              <div style={{ ...titleTypeStyle, ...titlePosStyle }}>{titleInner}</div>
              <div style={nameStyle}>{name}</div>
            </div>
          </div>

          {showSafe && (
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute top-0 left-0 right-0 h-[66px] border-b border-dashed border-red-400/90 bg-red-500/20" />
              <div className="absolute bottom-0 left-0 right-0 h-[140px] border-t border-dashed border-red-400/90 bg-red-500/20" />
              <div className="absolute bottom-0 right-0 h-[250px] w-[50px] border-l border-dashed border-red-400/90 bg-red-500/20" />
            </div>
          )}
        </div>
        <Toggle checked={showSafe} onChange={setShowSafe} label="Show safe-area guides" hint="not exported" />
        <div className="text-xs text-text-subtle">Live preview · exports at 1080×1920</div>
      </div>
    </div>
  );
}
