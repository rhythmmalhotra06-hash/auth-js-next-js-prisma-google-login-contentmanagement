// Flatten the Design Component artboards into standalone HTML.
//
//   node build-export.mjs
//
// WHY: the .dc.html artboards are Design Component format — <x-dc>, <helmet>, {{handlebars}},
// sc-for / sc-if, and a `class Component extends DCLogic` that supplies the data. Open one in a
// browser and it renders nothing: the canvas editor is what interprets them. To hand a design to
// anyone outside that canvas it has to be flattened to real HTML.
//
// The .dc.html files stay the source of truth. Everything under export/ is GENERATED — re-run
// this after a canvas edit rather than hand-editing the output.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'export');

// ---------------------------------------------------------------------------
// Context that travels with every file. Claude Design will otherwise reasonably
// "improve" the parts that are deliberate, so the constraints ship with the markup.
// ---------------------------------------------------------------------------

const TOKENS = `Plus Jakarta Sans · 14px base / 1.5 · radii 4 / 8 / 12 / 16
brand #572280 · brand-content #3f1860 · brand-soft #f1eaf7
gold #f5b000 · gold-content #6b4e00 · gold-soft #fff6e0        (ATTENTION ONLY)
green #159f65 / #0e6742 / #e8f9f1 · blue #2563cf / #1c3bd4 / #ebf2ff
amber #c9801a / #7a5600 / #fff4d9 · red #dc2626 / #8a1f1f / #ffe4e4
page #faf9fc · surface #ffffff · subtle #f4f2f8
text #1a1523 · muted #6b6478 · subtle #a59db4 · border rgba(40,20,60,.12)
shadow 0 1px 2px 0 rgba(40,20,60,.06), 0 4px 12px 0 rgba(40,20,60,.05)
PROPOSED --mv-staged #7b6ea8 / #4b4173 / #f2f0f9`;

const NON_NEGOTIABLE = [
  'Gold is attention-only — exactly ONE gold element per page. "If two things are gold, neither reads as urgent."',
  '`blocked` ≠ `missed`. Blocked is upstream (content not recorded, no speaker list) and must not read as an editor failure. Two states, two colours, never merged.',
  'Never a zero. An empty 24h read renders "not filled". A percentage over an empty denominator renders blank — never 0% or NaN.',
  'Never borrow one brand’s message or goal to fill the other’s gap. Doing that is what made an earlier version read as "Mindvalley’s calendar".',
  'The three empty states are the feature, not a fallback — the meeting is largely about the gaps. Each says WHICH gap it is and who closes it.',
  'An inferred target shows a tilde and the sentence it was parsed from. A target that cannot be established renders "no target set" with no progress bar.',
  'Undated assets are counted and reachable, never filtered out of existence.',
  'Values are lifted from app/globals.css exactly — never rounded or snapped to a 4/8px grid.',
];

const FINDINGS = [
  '221 of 440 Vishen-lane assets have NO Live Date — and 66 of those are already published, mostly the agency source VL IG: Risevoice. A date-grouped calendar cannot show about a third of published VL work, which is why the not-dated tray carries a live count.',
  '`Goal` is empty on all 6 real Message-of-the-Week records, so the lookup chain resolves to nothing and no asset inherits a goal.',
  'Brand is misspelled `Mindalley` on 6 of 7 records in Airtable. It is recognised in code but never rewritten — the fix belongs upstream.',
  'The only Vishen-brand message in the base is named `test` with the goal `vcvdsv`, linked to one real asset.',
  'Nothing is dated past 22 September, and the Live Date field has no owner.',
  'Last week’s day-by-day numbers on the MOW pack are real (Glen’s actual report). This week’s figures are SAMPLE — Metabase is not wired yet, so a live week genuinely has no numbers.',
];

const OPEN = {
  cal: [
    'Main stacks Vishen above Mindvalley per day. At 7 columns a busy day gets tight — would day-rows read better?',
    'Mindvalley days collapse to "+5 social". Is the count enough, or does the meeting need the titles?',
    'Nothing is dated past 22 Sep. Should the calendar refuse to page beyond it, or show the empty weeks?',
  ],
  mow: [
    'Two brand cards means two numbers on the first screen. Right call, or should Mindvalley lead with Vishen Lakhiani Media smaller beneath?',
    'The day table is one row per slot, so a day with email + social takes two rows. Group them under a spanning day cell?',
    'Dark mode is first-class in this app and is not drawn yet.',
  ],
};

const META = {
  'CalMain':        { title: 'Comms Calendar — Main', route: '/studio/comms-calendar?brand=main', open: 'cal',
                      blurb: 'Both brands on the same date, two lanes. The view for the Monday meeting: on this day, what went out for Vishen and what went out for Mindvalley.' },
  'CalVishen':      { title: 'Comms Calendar — Vishen’s', route: '/studio/comms-calendar?brand=vl', open: 'cal',
                      blurb: 'The VL lane exactly as it renders on live data today — one message named "test", one linked asset, most of the week empty. Compare against the Mindvalley artboard: same layout, same week, the only difference is the data.' },
  'CalMindvalley':  { title: 'Comms Calendar — Mindvalley', route: '/studio/comms-calendar?brand=mv', open: 'cal',
                      blurb: 'The populated case, in the same layout as Vishen’s so the contrast is purely the data.' },
  'CalMonth':       { title: 'Comms Calendar — month', route: '/studio/comms-calendar (month)', open: 'cal',
                      blurb: 'The zoom-out. Density per day rather than detail — it exists mainly to make the 22 September cliff visible, which a week view only reveals by paging forward.' },
  'CalEmpty':       { title: 'Comms Calendar — the three empty states', route: '/studio/comms-calendar', open: 'cal',
                      blurb: 'no Live Date · no message committed · no goal set. Three gaps, three different sentences, each naming who closes it.' },
  'CalAsset':       { title: 'Comms Calendar — asset detail', route: '/studio/comms-calendar (drawer)', open: 'cal',
                      blurb: 'Clicking a cell opens the asset, not the day — that is the grain the Airtable link actually has.' },
  'Main':           { title: 'Message of the Week — the Monday pack', route: '/performance/week', open: 'mow',
                      blurb: 'The pack the Monday meeting runs from. Meeting mode collapses the prose; clicking a day row opens the full read.' },
  'Assets':         { title: 'Message of the Week — assets', route: '/performance/week/assets', open: 'mow',
                      blurb: 'Every owner’s released work and its 24-hour read, grouped by owner. Carries the mandated 5-column header because it is a ticket list.' },
  'StudioCard':     { title: 'Studio — blocker-first card', route: '/studio', open: 'mow',
                      blurb: 'What Vishen sees first: what is waiting on him, then the message, then the one number per brand.' },
  'System':         { title: 'Token & component sheet', route: '—', open: 'mow',
                      blurb: 'The shared vocabulary both surfaces are built from.' },
};

// ---------------------------------------------------------------------------
// Template expansion
// ---------------------------------------------------------------------------

/** Dotted lookup. Holes are paths only — never expressions. */
function lookup(scope, path) {
  const p = path.trim();
  if (p === 'true') return true;
  if (p === 'false') return false;
  let cur = scope;
  for (const seg of p.split('.')) {
    if (cur == null) return undefined;
    cur = cur[seg];
  }
  return cur;
}

const esc = (v) =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Fill {{ holes }}. Attribute position is the same substitution, so one pass covers both. */
function fill(str, scope) {
  return str.replace(/\{\{([^{}]+)\}\}/g, (_, path) => {
    const v = lookup(scope, path);
    return v === undefined || v === null ? '' : esc(v);
  });
}

/**
 * Find the matching close tag for `tag` starting at `from`, honouring nesting.
 * The artboards nest sc-for inside sc-for and sc-if inside sc-for, so a naive
 * lastIndexOf would close the wrong block.
 */
function matchClose(src, tag, from) {
  const open = new RegExp(`<${tag}(\\s|>)`, 'g');
  const close = new RegExp(`</${tag}>`, 'g');
  let depth = 1, i = from;
  while (i < src.length) {
    open.lastIndex = i; close.lastIndex = i;
    const o = open.exec(src), c = close.exec(src);
    if (!c) return -1;
    if (o && o.index < c.index) { depth++; i = o.index + 1; continue; }
    depth--;
    if (depth === 0) return c.index;
    i = c.index + 1;
  }
  return -1;
}

const attr = (tag, name) => {
  const m = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
};

/**
 * Expand sc-for / sc-if / holes.
 *
 * `forceTruthy` names hole-paths whose sc-if blocks are emitted even when false, wrapped with a
 * data-toggle marker. That is how the pack's interactivity survives flattening: every day's detail
 * block is rendered hidden, and a JS footer shows one at a time.
 */
function expand(src, scope, forceTruthy = new Set()) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const nf = src.indexOf('<sc-for', i);
    const ni = src.indexOf('<sc-if', i);
    const next = nf === -1 ? ni : ni === -1 ? nf : Math.min(nf, ni);
    if (next === -1) { out += fill(src.slice(i), scope); break; }

    out += fill(src.slice(i, next), scope);
    const isFor = next === nf;
    const tag = isFor ? 'sc-for' : 'sc-if';
    const tagEnd = src.indexOf('>', next);
    const openTag = src.slice(next, tagEnd + 1);
    const bodyStart = tagEnd + 1;
    const bodyEnd = matchClose(src, tag, bodyStart);
    if (bodyEnd === -1) throw new Error(`unclosed <${tag}>`);
    const body = src.slice(bodyStart, bodyEnd);

    if (isFor) {
      const listPath = (attr(openTag, 'list') || '').replace(/[{}]/g, '').trim();
      const as = attr(openTag, 'as') || 'item';
      const list = lookup(scope, listPath);
      if (Array.isArray(list)) {
        list.forEach((item, idx) => {
          out += expand(body, { ...scope, [as]: item, $index: idx }, forceTruthy);
        });
      }
    } else {
      const valPath = (attr(openTag, 'value') || '').replace(/[{}]/g, '').trim();
      const leaf = valPath.split('.').slice(-1)[0];
      const forced = forceTruthy.has(valPath) || forceTruthy.has(leaf);
      const truthy = !!lookup(scope, valPath);
      if (truthy || forced) {
        const inner = expand(body, scope, forceTruthy);
        out += forced
          ? `<div data-toggle="${esc(leaf)}"${truthy ? '' : ' hidden'}>${inner}</div>`
          : inner;
      }
    }
    i = bodyEnd + `</${tag}>`.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Running the artboard's data class
// ---------------------------------------------------------------------------

function runComponent(src) {
  const scriptM = /<script data-dc-script data-props='([\s\S]*?)'>([\s\S]*?)<\/script>/.exec(src);
  if (!scriptM) return { vals: {}, state: {} };

  // data-props is a normal HTML attribute: entities decode before the JSON parse.
  const propsRaw = scriptM[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  const propsDef = JSON.parse(propsRaw);
  const props = {};
  for (const [k, v] of Object.entries(propsDef)) {
    if (k.startsWith('$')) continue;
    props[k] = v && typeof v === 'object' && 'default' in v ? v.default : undefined;
  }

  const ctx = vm.createContext({ console });
  vm.runInContext(
    `class DCLogic {
       constructor(p){ this.props = p || {}; this.state = {}; }
       setState(s){ Object.assign(this.state, s); }
     }
     ${scriptM[2]}
     globalThis.__mk = (p) => new Component(p);`,
    ctx,
  );
  const inst = ctx.__mk(props);
  return { vals: inst.renderVals ? inst.renderVals() : {}, state: inst.state || {} };
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const TOGGLE_JS = `
<script>
// Re-emitted interactivity. Every day's detail block was rendered hidden with data-toggle="open";
// this shows one at a time, and the Meeting-mode button hides the prose blocks.
(function () {
  var rows = document.querySelectorAll('tr.row');
  rows.forEach(function (row) {
    row.addEventListener('click', function () {
      var next = row.nextElementSibling;
      if (!next) return;
      var block = next.querySelector('[data-toggle="open"]') ||
                  (next.matches('[data-toggle="open"]') ? next : null);
      if (!block) return;
      var wasOpen = !block.hidden;
      document.querySelectorAll('[data-toggle="open"]').forEach(function (b) { b.hidden = true; });
      block.hidden = wasOpen;
    });
  });
  var btn = Array.prototype.find.call(document.querySelectorAll('button'), function (b) {
    return /meeting mode/i.test(b.textContent || '');
  });
  if (btn) btn.addEventListener('click', function () {
    var on = btn.getAttribute('data-on') === '1';
    btn.setAttribute('data-on', on ? '0' : '1');
    btn.style.background = on ? '#ffffff' : '#572280';
    btn.style.color = on ? '#1a1523' : '#ffffff';
    btn.style.borderColor = on ? 'rgba(40,20,60,.22)' : '#572280';
    document.querySelectorAll('[data-toggle="showProse"]').forEach(function (b) { b.hidden = !on; });
  });
})();
</script>`;

function header(name) {
  const m = META[name];
  const openQs = OPEN[m.open];
  const li = (xs) => xs.map((x) => `<li>${x}</li>`).join('\n      ');
  return `<header class="x-ctx">
  <div class="x-wrap">
    <div class="x-eyebrow">Mindvalley Content Studio · design reference</div>
    <h1 class="x-h1">${m.title}</h1>
    <p class="x-route">${m.route}</p>
    <p class="x-blurb">${m.blurb}</p>
    <div class="x-grid">
      <section>
        <h2>Design tokens — exact values, do not re-derive</h2>
        <pre>${TOKENS}</pre>
      </section>
      <section>
        <h2>Non-negotiable — these are deliberate, not oversights</h2>
        <ul>
      ${li(NON_NEGOTIABLE)}
        </ul>
      </section>
      <section>
        <h2>Why the data looks like this</h2>
        <ul>
      ${li(FINDINGS)}
        </ul>
      </section>
      <section>
        <h2>Open for design</h2>
        <ul>
      ${li(openQs)}
        </ul>
      </section>
    </div>
    <p class="x-gen">Generated from <code>${name}.dc.html</code> by <code>build-export.mjs</code> — edit the artboard, not this file.</p>
  </div>
</header>`;
}

const CTX_CSS = `
.x-ctx { background:#1a1523; color:#f3eefa; padding:26px 0 30px; margin-bottom:0;
  font-family:"Plus Jakarta Sans",ui-sans-serif,system-ui,sans-serif; }
.x-ctx .x-wrap { max-width:1180px; margin:0 auto; padding:0 24px; }
.x-ctx .x-eyebrow { font-size:11px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#b98fe0; }
.x-ctx .x-h1 { margin:7px 0 3px; font-size:25px; font-weight:700; letter-spacing:-.02em; color:#fff; }
.x-ctx .x-route { margin:0 0 9px; font-family:ui-monospace,Menlo,monospace; font-size:12px; color:#b3a9c4; }
.x-ctx .x-blurb { margin:0 0 20px; font-size:13.5px; line-height:1.55; color:#e9dcf6; max-width:78ch; }
.x-ctx .x-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px 26px; }
.x-ctx h2 { margin:0 0 7px; font-size:11px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:#b98fe0; }
.x-ctx ul { margin:0; padding-left:17px; }
.x-ctx li { font-size:12.5px; line-height:1.55; color:#e9dcf6; margin-bottom:5px; }
.x-ctx pre { margin:0; font-family:ui-monospace,Menlo,monospace; font-size:11px; line-height:1.65;
  color:#e9dcf6; background:#241a33; border-radius:8px; padding:11px 13px; overflow-x:auto; }
.x-ctx code { font-family:ui-monospace,Menlo,monospace; font-size:11.5px; color:#b98fe0; }
.x-ctx .x-gen { margin:18px 0 0; font-size:11.5px; color:#877c99; }
@media (max-width:900px){ .x-ctx .x-grid { grid-template-columns:1fr; } }`;

function build(name) {
  const src = readFileSync(join(HERE, `${name}.dc.html`), 'utf8');
  const { vals, state } = runComponent(src);
  const scope = { ...vals, ...state };

  // Only the pack carries state; force its two state-driven conditionals so both branches are
  // present in the output and JS can toggle between them.
  const forced = name === 'Main' ? new Set(['open', 'showProse']) : new Set();

  const styleM = /<helmet>([\s\S]*?)<\/helmet>/.exec(src);
  const helmet = styleM ? styleM[1].trim() : '';

  const bodyM = /<x-dc>([\s\S]*?)<\/x-dc>/.exec(src);
  if (!bodyM) throw new Error(`${name}: no <x-dc>`);
  let body = bodyM[1].replace(/<helmet>[\s\S]*?<\/helmet>/, '');

  body = expand(body, scope, forced);
  // Handlers are meaningless once flattened; the JS footer re-adds the behaviour.
  body = body.replace(/\son[A-Z][a-zA-Z]*="[^"]*"/g, '');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${META[name].title} — Mindvalley Content Studio</title>
${helmet}
<style>${CTX_CSS}</style>
</head>
<body>
${header(name)}
${body}
${name === 'Main' ? TOGGLE_JS : ''}
</body>
</html>
`;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${name}.html`), html);
  return html.length;
}

const names = readdirSync(HERE).filter((f) => f.endsWith('.dc.html')).map((f) => f.replace('.dc.html', ''));
let total = 0;
for (const n of names) {
  if (!META[n]) { console.warn(`skip ${n} — no META entry`); continue; }
  const size = build(n);
  total += size;
  console.log(`  ${n}.html  ${(size / 1024).toFixed(1)} KB`);
}
console.log(`\n${names.length} files → export/  (${(total / 1024).toFixed(0)} KB total)`);
