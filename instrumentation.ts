// TEMPORARY startup diagnostic — logs what the APP's own Prisma connection sees,
// straight to stdout (readable via `kessel runtime-logs`). No browser/route needed.
// Investigating ticket.create P2022 "column (not available)". Remove after.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { prisma } = await import('@/lib/prisma');
    const conn = await prisma.$queryRaw<{ db: string; usr: string; host: string | null }[]>`
      SELECT current_database()::text AS db, current_user::text AS usr, inet_server_addr()::text AS host`;
    const col = await prisma.$queryRaw<{ has_col: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.columns
        WHERE table_name='tickets' AND column_name='airtable_pushed_at'
      ) AS has_col`;
    let selectTest = 'ok';
    try {
      await prisma.ticket.findFirst({ select: { id: true, airtablePushedAt: true } });
    } catch (e) {
      selectTest = e instanceof Error ? e.message : String(e);
    }
    console.error('[DBDIAG] conn=' + JSON.stringify(conn?.[0]) + ' hasColumn=' + JSON.stringify(col?.[0]) + ' selectAirtablePushedAt=' + selectTest);
  } catch (e) {
    console.error('[DBDIAG] failed:', e instanceof Error ? e.message : String(e));
  }
}
