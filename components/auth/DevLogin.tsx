import { devLogin } from '@/app/dev-login-action';
import { ROLES } from '@/lib/roles';

// DEV-ONLY login box (rendered on the home page only when ENABLE_DEV_LOGIN=true in
// development). Lets you sign in as any email with a chosen role to preview each
// role's view locally — no Google needed. Never rendered in production.
export function DevLogin() {
  return (
    <form action={devLogin} className="mt-8 rounded-lg border border-dashed border-border-strong bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Dev login (local only)</p>
      <div className="mt-3 space-y-2">
        <input
          name="email"
          defaultValue="dev@mindvalley.com"
          placeholder="you@mindvalley.com"
          className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-text outline-none focus:border-brand"
        />
        <select
          name="roles"
          defaultValue=""
          className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-text outline-none focus:border-brand"
        >
          <option value="">Stakeholder (untagged default)</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
          <option value="Manager, Approver">Manager + Approver</option>
        </select>
        <select
          name="division"
          defaultValue=""
          className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-text outline-none focus:border-brand"
        >
          <option value="">No division (default)</option>
          <option value="Marketing">Marketing (Social Media surface)</option>
          <option value="Creatives">Creatives</option>
        </select>
        <button
          type="submit"
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          Sign in as this role
        </button>
      </div>
    </form>
  );
}
