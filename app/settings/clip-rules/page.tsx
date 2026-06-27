import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { ClipRulesEditor, type EditorRule } from '@/components/settings/ClipRulesEditor';
import { listClipRules } from '@/lib/clip-rules/repository';
import { getClipRulesAccess } from '@/lib/clip-rules/access';
import { RULE_SCOPES } from '@/lib/clipping/clip-types';

export const dynamic = 'force-dynamic';

export default async function ClipRulesPage() {
  const [rulesRes, access] = await Promise.all([listClipRules(), getClipRulesAccess()]);

  if (!rulesRes.ok) {
    return (
      <AppShell title="Clip rules" subtitle="Edit the AI clip-generation prompt">
        <div className="rounded-[8px] bg-red-50 px-3 py-2 text-sm text-danger">
          Couldn’t load clip rules from Airtable: {rulesRes.error.message}
        </div>
      </AppShell>
    );
  }

  const rows = rulesRes.data;
  const baseRow = rows.find((r) => r.kind === 'Base Prompt' && r.active) ?? rows.find((r) => r.kind === 'Base Prompt');
  const pillarsRow = rows.find((r) => r.kind === 'Brand Pillars' && r.active) ?? rows.find((r) => r.kind === 'Brand Pillars');

  const basePrompt = baseRow?.content ? { id: baseRow.id, content: baseRow.content } : null;
  const pillars = pillarsRow?.content ? { id: pillarsRow.id, content: pillarsRow.content } : null;
  const rules: EditorRule[] = rows
    .filter((r) => r.kind === 'Rule')
    .map((r) => ({
      id: r.id,
      content: r.content,
      clipType: r.clipType,
      section: r.section,
      note: r.note,
      active: r.active,
      updatedBy: r.updatedBy,
    }));

  return (
    <AppShell
      title="Clip rules"
      subtitle="Edit the prompt the AI uses to suggest clips — changes apply on the next generation."
    >
      <Link href="/media" className="text-sm text-brand hover:underline">← Media inbox</Link>
      <div className="mt-3">
        <ClipRulesEditor
          basePrompt={basePrompt}
          pillars={pillars}
          rules={rules}
          ruleScopes={RULE_SCOPES}
          canEdit={access.canEdit}
        />
      </div>
    </AppShell>
  );
}
