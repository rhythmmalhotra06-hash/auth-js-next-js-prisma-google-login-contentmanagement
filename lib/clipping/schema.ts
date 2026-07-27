// Structured-output contract for the 10-section viral content strategy.
// The SHAPE is rigid (so `reelsClips` maps reliably to tickets); COUNTS/RANGES
// (1–10 score, 5–8 clips) are NOT schema-enforced — structured outputs ignore
// min/max — so they live in field descriptions and are validated in TS after the
// model responds (see validateStrategy below).

export const REELS_FORMATS = ['talking_head', 'quote_card', 'broll_overlay'] as const;
export const PLATFORMS = ['youtube', 'spotify', 'instagram', 'linkedin', 'x', 'tiktok'] as const;
export const TITLE_FORMATS = ['curiosity', 'bold', 'story'] as const;

// Viral Clip Extractor mechanisms — names match the Airtable "Viral Mechanism"
// singleSelect choices exactly so they persist without typecasting.
export const VIRAL_MECHANISMS = [
  'Pattern Interrupt',
  'Contrarian Claim',
  'Specific Prediction / Stat',
  'Identity Challenge',
  'Emotional Payoff',
  'Shareable Insight',
  'Story Hook',
] as const;

export type ReelsFormat = (typeof REELS_FORMATS)[number];
export type Platform = (typeof PLATFORMS)[number];
export type TitleFormat = (typeof TITLE_FORMATS)[number];
export type ViralMechanism = (typeof VIRAL_MECHANISMS)[number];

export interface EpisodeTitle {
  format: TitleFormat;
  title: string;
  description: string;
}

export interface ThumbnailStrategy {
  primaryConcept: {
    background: string;
    textOverlay: string;
    expression: string;
    palette: string;
    composition: string;
  };
  abVariant: string;
  textOverlayOptions: string[];
  emotionalTrigger: string;
}

export interface ChapterMarker {
  timestamp: string;
  label: string;
}

export interface YoutubeHook {
  hookScript: string;
  cutIns: string[];
  chapterMarkers: ChapterMarker[];
}

export interface ReelsClip {
  timestampStart: string;
  timestampEnd: string;
  rationale: string;
  caption: string;
  hookLine: string;
  format: ReelsFormat;
  viralityScore: number; // 1–10
  // ── Viral Clip Extractor fields (optional in TS so existing constructors that
  // read persisted rows still compile; the JSON schema requires them on fresh
  // generation so the model always produces them). ────────────────────────────
  /** ≤8-word punchy, scroll-stopping title. */
  nuclearHookTitle?: string;
  /** Longer context-giving title explaining what the clip is about. */
  descriptiveTitle?: string;
  /** Primary viral mechanism tag. */
  viralMechanism?: ViralMechanism;
  /** Virality gate: challenges conventional wisdom / invites debate. */
  gateControversy?: boolean;
  /** Virality gate: a specific insight/fact/framework the audience likely hasn't heard. */
  gateUncommonKnowledge?: boolean;
  /** Virality gate: a genuinely funny / absurd / surprising moment. */
  gateHumour?: boolean;
  /** Exact opening line/visual for the first 3 seconds. */
  coldOpen?: string;
  /** Raw, word-for-word transcript passage for this clip (never paraphrased). */
  verbatimExtract?: string;
  /** Specific editing instructions: cut in/out, b-roll, overlays, pacing. */
  editNotes?: string;
}

export interface PullQuote {
  quote: string;
  visualTreatment: string;
}

export interface ShowNotes {
  timestamps: ChapterMarker[];
  keyInsights: string[];
  guestBio: string;
}

export interface DistributionPlanItem {
  platform: Platform;
  sequence: string;
  timing: string;
  crossPromoHook: string;
}

export interface YoutubeTitleTest {
  title: string;
  predictedCtrRank: number; // 1 = highest predicted CTR
  rationale: string;
}

export interface Strategy {
  episodeTitles: EpisodeTitle[];
  episodeDescriptionShort: string;
  episodeDescriptionLong: string;
  youtubeTags: string[];
  thumbnailStrategy: ThumbnailStrategy;
  youtubeHook: YoutubeHook;
  reelsClips: ReelsClip[];
  pullQuotes: PullQuote[];
  showNotes: ShowNotes;
  distributionPlan: DistributionPlanItem[];
  youtubeTitleTests: YoutubeTitleTest[];
}

// JSON Schema for output_config.format. Every object sets additionalProperties:false.
const str = (description: string) => ({ type: 'string', description });

export const STRATEGY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'episodeTitles',
    'episodeDescriptionShort',
    'episodeDescriptionLong',
    'youtubeTags',
    'thumbnailStrategy',
    'youtubeHook',
    'reelsClips',
    'pullQuotes',
    'showNotes',
    'distributionPlan',
    'youtubeTitleTests',
  ],
  properties: {
    episodeTitles: {
      type: 'array',
      description: 'Exactly 3 title options: one curiosity-gap, one bold claim, one story-hook.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['format', 'title', 'description'],
        properties: {
          format: { type: 'string', enum: [...TITLE_FORMATS] },
          title: str('The episode title in this format.'),
          description: str('A punchy sub-20-word episode description for this title.'),
        },
      },
    },
    episodeDescriptionShort: str('A punchy sub-20-word episode description.'),
    episodeDescriptionLong: str('A 150-word, hook-first, SEO-optimized full description.'),
    youtubeTags: { type: 'array', description: 'Relevant YouTube tags.', items: { type: 'string' } },
    thumbnailStrategy: {
      type: 'object',
      additionalProperties: false,
      required: ['primaryConcept', 'abVariant', 'textOverlayOptions', 'emotionalTrigger'],
      properties: {
        primaryConcept: {
          type: 'object',
          additionalProperties: false,
          required: ['background', 'textOverlay', 'expression', 'palette', 'composition'],
          properties: {
            background: str('Background description.'),
            textOverlay: str('Primary text overlay.'),
            expression: str('Facial expression.'),
            palette: str('Color palette.'),
            composition: str('Composition / layout.'),
          },
        },
        abVariant: str('An A/B test variant concept.'),
        textOverlayOptions: { type: 'array', description: 'Up to 5 high-contrast text overlay options.', items: { type: 'string' } },
        emotionalTrigger: str('The emotional trigger targeted (curiosity, shock, aspiration, or FOMO).'),
      },
    },
    youtubeHook: {
      type: 'object',
      additionalProperties: false,
      required: ['hookScript', 'cutIns', 'chapterMarkers'],
      properties: {
        hookScript: str('A 60-second YouTube hook: pattern interrupt + bold claim + clear promise of value.'),
        cutIns: { type: 'array', description: 'Timestamp cut-in suggestions.', items: { type: 'string' } },
        chapterMarkers: {
          type: 'array',
          description: 'Full chapter marker list with click-worthy titles.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['timestamp', 'label'],
            properties: { timestamp: str('e.g. 00:00 — copied from a transcript [M:SS] marker, never invented.'), label: str('Click-worthy chapter title.') },
          },
        },
      },
    },
    reelsClips: {
      type: 'array',
      description:
        '5 to 8 high-performing short-form clip moments, grounded in the actual transcript. ' +
        'Each must hit ≥1 virality gate (Controversy / Uncommon Knowledge / Humour); prefer all three.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'nuclearHookTitle',
          'descriptiveTitle',
          'timestampStart',
          'timestampEnd',
          'viralMechanism',
          'gateControversy',
          'gateUncommonKnowledge',
          'gateHumour',
          'rationale',
          'coldOpen',
          'caption',
          'hookLine',
          'verbatimExtract',
          'editNotes',
          'format',
          'viralityScore',
        ],
        properties: {
          nuclearHookTitle: str('Nuclear Hook Title: max 8 words, punchy, scroll-stopping, provocative (e.g. "Working Hard Is the Dumbest Thing You Can Do in 2026"). Mandatory on every clip.'),
          descriptiveTitle: str('Longer, context-giving title that explains what the clip is actually about.'),
          timestampStart: str('Clip start, copied from a transcript [M:SS] marker (e.g. 12:30). Use only a timestamp that appears in the transcript — never invent one.'),
          timestampEnd: str('Clip end, copied from a transcript [M:SS] marker (e.g. 13:45). Use only a timestamp that appears in the transcript — never invent one.'),
          viralMechanism: { type: 'string', enum: [...VIRAL_MECHANISMS], description: 'The primary viral mechanism this clip uses. Flag Specific Prediction / Stat moments (especially about AI) — they outperform.' },
          gateControversy: { type: 'boolean', description: 'Virality gate — Controversy: a claim/opinion that challenges conventional wisdom, takes a strong stance, or invites debate.' },
          gateUncommonKnowledge: { type: 'boolean', description: 'Virality gate — Uncommon Knowledge: a specific insight/fact/framework/story detail the audience is unlikely to have heard, stated with enough specificity to feel like an "unlock".' },
          gateHumour: { type: 'boolean', description: 'Virality gate — Humour: a genuinely funny, self-deprecating, absurd, or surprising moment worth sharing for entertainment.' },
          rationale: str('Why This Clips: 2–3 sentences tied to the gate(s) it hits — the hook, the payoff, why someone would comment/share.'),
          coldOpen: str('Cold Open — the exact opening line or visual moment for the first 3 seconds. The make-or-break hook before the viewer scrolls.'),
          caption: str('Suggested caption / hook text for the post itself — designed to stop the scroll in feed before the video plays.'),
          hookLine: str('A short 3-second on-screen hook line (can echo the cold open).'),
          verbatimExtract: str('Raw, word-for-word transcript text for this clip segment. Full passage — NEVER paraphrase or summarize. Mandatory; this is the source material the editor will use.'),
          editNotes: str('Specific editing instructions — where to cut in/out, B-roll suggestions, text overlays, pacing notes.'),
          format: { type: 'string', enum: [...REELS_FORMATS] },
          viralityScore: { type: 'integer', description: 'Viral potential from 1 (low) to 10 (high).' },
        },
      },
    },
    pullQuotes: {
      type: 'array',
      description: 'Exactly 5 pull quotes for static posts.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['quote', 'visualTreatment'],
        properties: { quote: str('A verbatim or lightly-edited pull quote.'), visualTreatment: str('Visual treatment notes.') },
      },
    },
    showNotes: {
      type: 'object',
      additionalProperties: false,
      required: ['timestamps', 'keyInsights', 'guestBio'],
      properties: {
        timestamps: {
          type: 'array',
          description: 'Timestamped show-note entries.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['timestamp', 'label'],
            properties: { timestamp: str('e.g. 05:12 — copied from a transcript [M:SS] marker, never invented.'), label: str('What happens at this timestamp.') },
          },
        },
        keyInsights: { type: 'array', description: 'Key insights from the episode.', items: { type: 'string' } },
        guestBio: str('A short guest bio.'),
      },
    },
    distributionPlan: {
      type: 'array',
      description: 'Platform-by-platform distribution plan covering YouTube, Spotify, Instagram, LinkedIn, X/Twitter, and TikTok.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['platform', 'sequence', 'timing', 'crossPromoHook'],
        properties: {
          platform: { type: 'string', enum: [...PLATFORMS] },
          sequence: str('Where this platform sits in the posting sequence.'),
          timing: str('Recommended posting timing.'),
          crossPromoHook: str('Cross-promotion hook for this platform.'),
        },
      },
    },
    youtubeTitleTests: {
      type: 'array',
      description: 'Exactly 5 YouTube title split-test options ranked by predicted CTR.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'predictedCtrRank', 'rationale'],
        properties: {
          title: str('The split-test title.'),
          predictedCtrRank: { type: 'integer', description: 'Rank by predicted CTR; 1 = highest.' },
          rationale: str('The psychological rationale for this title.'),
        },
      },
    },
  },
} as const;

/** Validate the model output shape + the count/range rules the schema can't enforce. */
export function validateStrategy(value: unknown): { ok: true; strategy: Strategy } | { ok: false; error: string } {
  const s = value as Strategy;
  if (!s || typeof s !== 'object') return { ok: false, error: 'Strategy is not an object' };
  if (!Array.isArray(s.reelsClips) || s.reelsClips.length < 1) {
    return { ok: false, error: 'No Reels clips were generated' };
  }
  // Clamp/normalize virality scores into 1–10 rather than rejecting (the model is reliable on shape, looser on bounds).
  for (const c of s.reelsClips) {
    if (typeof c.viralityScore !== 'number' || Number.isNaN(c.viralityScore)) c.viralityScore = 0;
    c.viralityScore = Math.max(1, Math.min(10, Math.round(c.viralityScore)));
    // Viral Clip Extractor fields: coerce virality-gate flags to booleans; backfill
    // titles so downstream (ticket titles, board labels) always has a usable string.
    c.gateControversy = !!c.gateControversy;
    c.gateUncommonKnowledge = !!c.gateUncommonKnowledge;
    c.gateHumour = !!c.gateHumour;
    if (!c.nuclearHookTitle?.trim()) c.nuclearHookTitle = c.hookLine || c.descriptiveTitle || '';
  }
  if (!Array.isArray(s.episodeTitles) || s.episodeTitles.length === 0) {
    return { ok: false, error: 'No episode titles were generated' };
  }
  return { ok: true, strategy: s };
}
