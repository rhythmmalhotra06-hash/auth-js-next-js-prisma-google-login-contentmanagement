import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { ClipRulesEditor, type EditorRule } from '@/components/settings/ClipRulesEditor';
import { listClipRules } from '@/lib/clip-rules/repository';
import { getAdminAccess } from '@/lib/admin/access';
import { RULE_SCOPES } from '@/lib/clipping/clip-types';
import { homeRouteForRoles } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export default async function ClipRulesPage() {
  const adminAccess = await getAdminAccess();
  if (!adminAccess.isAdmin) redirect(homeRouteForRoles(adminAccess.roles)); // admin-only surface
  const access = { canEdit: adminAccess.isAdmin };
  const rulesRes = await listClipRules();

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
      updatedAt: r.updatedAt,
    }));

  return (
    <AppShell
      title="Clip rules"
      subtitle="Edit the prompt the AI uses to suggest clips — changes apply on the next generation."
    >
      <Link href="/media" className="btn ghost sm" style={{ textDecoration: 'none', marginBottom: 14 }}>← Media inbox</Link>
      <div>
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
