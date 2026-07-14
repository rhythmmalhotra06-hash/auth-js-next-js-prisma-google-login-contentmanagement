// Structured-output contract for the 10-section viral content strategy.
// The SHAPE is rigid (so `reelsClips` maps reliably to tickets); COUNTS/RANGES
// (1–10 score, 5–8 clips) are NOT schema-enforced — structured outputs ignore
// min/max — so they live in field descriptions and are validated in TS after the
// model responds (see validateStrategy below).

export const REELS_FORMATS = ['talking_head', 'quote_card', 'broll_overlay'] as const;
export const PLATFORMS = ['youtube', 'spotify', 'instagram', 'linkedin', 'x', 'tiktok'] as const;
export const TITLE_FORMATS = ['curiosity', 'bold', 'story'] as const;

export type ReelsFormat = (typeof REELS_FORMATS)[number];
export type Platform = (typeof PLATFORMS)[number];
export type TitleFormat = (typeof TITLE_FORMATS)[number];

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
      description: '5 to 8 high-performing Instagram Reels moments, grounded in the actual transcript.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['timestampStart', 'timestampEnd', 'rationale', 'caption', 'hookLine', 'format', 'viralityScore'],
        properties: {
          timestampStart: str('Clip start, copied from a transcript [M:SS] marker (e.g. 12:30). Use only a timestamp that appears in the transcript — never invent one.'),
          timestampEnd: str('Clip end, copied from a transcript [M:SS] marker (e.g. 13:45). Use only a timestamp that appears in the transcript — never invent one.'),
          rationale: str('Why this clip works (hook, insight, emotion).'),
          caption: str('Suggested caption for the reel.'),
          hookLine: str('A 3-second hook line.'),
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
  }
  if (!Array.isArray(s.episodeTitles) || s.episodeTitles.length === 0) {
    return { ok: false, error: 'No episode titles were generated' };
  }
  return { ok: true, strategy: s };
}
