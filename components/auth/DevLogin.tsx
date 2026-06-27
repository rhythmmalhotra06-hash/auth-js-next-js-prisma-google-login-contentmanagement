import { devLogin } from '@/app/dev-login-action';
import { ROLES } from '@/lib/roles';

// DEV-ONLY login box (rendered on the home page only when ENABLE_DEV_LOGIN=true in
// development). Lets you sign in as any email with a chosen role to preview each
// role's view locally — no Google needed. Never rendered in production.
export function DevLogin() {
  return (
    <form action={devLogin} className="mt-8 rounded-lg border border-dashed border-neutral-300 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Dev login (local only)</p>
      <div className="mt-3 space-y-2">
        <input
          name="email"
          defaultValue="dev@mindvalley.com"
          placeholder="you@mindvalley.com"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-800 outline-none focus:border-neutral-500"
        />
        <select
          name="roles"
          defaultValue=""
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-800 outline-none focus:border-neutral-500"
        >
          <option value="">Stakeholder (untagged default)</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
          <option value="Manager, Approver">Manager + Approver</option>
        </select>
        <button
          type="submit"
          className="w-full rounded-md px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: '#572280' }}
        >
          Sign in as this role
        </button>
      </div>
    </form>
  );
}
