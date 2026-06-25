---
version: 1.0.0
author: Norman
description: Backup or restore the local development PostgreSQL database with timestamped dumps.
allowed-tools: Bash(mkdir -p *), Bash(date *), Bash(ls *), Bash(PGPASSWORD=* psql *), Bash(PGPASSWORD=* pg_dump *), Bash(pnpm prisma migrate deploy)
argument-hint: '[backup | restore [<filename>] | list]'
---

# /backup-data — Database Backup & Restore

Backup or restore the local development PostgreSQL database. All backups are saved to `backups/` in the project root with timestamps.

---

## Routing

Parse `$ARGUMENTS` and route:

| Input                 | Action                                                      |
| --------------------- | ----------------------------------------------------------- |
| _(empty)_ or `backup` | **Backup Flow** — dump the full database                    |
| `restore`             | **Restore Flow** — list available backups and restore one   |
| `restore <filename>`  | **Restore Flow** — restore a specific backup file           |
| `list`                | **List Flow** — show available backups with sizes and dates |

---

## Backup Flow

### Steps

1. Create the backups directory if it doesn't exist:

   ```
   mkdir -p backups
   ```

2. Generate a timestamped filename:

   ```
   TIMESTAMP=$(date +%Y%m%d-%H%M%S)
   BACKUP_FILE="backups/db-backup-${TIMESTAMP}.sql"
   ```

3. Get a quick count of key tables for the summary:

   ```
   PGPASSWORD=postgres psql -h localhost -U postgres -d mindvalley_ai_advanced -c "
     SELECT 'users' as tbl, count(*) FROM users
     UNION ALL SELECT 'conversations', count(*) FROM conversations
     UNION ALL SELECT 'conversation_messages', count(*) FROM conversation_messages
     UNION ALL SELECT 'companion_memories', count(*) FROM companion_memories
     UNION ALL SELECT 'memory_entities', count(*) FROM memory_entities
     UNION ALL SELECT 'smart_notes', count(*) FROM smart_notes
     UNION ALL SELECT 'tasks', count(*) FROM tasks
     UNION ALL SELECT 'projects', count(*) FROM projects
     UNION ALL SELECT 'life_areas', count(*) FROM life_areas
     UNION ALL SELECT 'daily_logs', count(*) FROM daily_logs
     UNION ALL SELECT 'ai_companions', count(*) FROM ai_companions
     ORDER BY tbl;
   "
   ```

4. Dump the full database (data + schema, excluding the `_prisma_migrations` table data since migrations handle schema):

   ```
   PGPASSWORD=postgres pg_dump -h localhost -U postgres -d mindvalley_ai_advanced \
     --no-owner --no-privileges --clean --if-exists \
     --exclude-table-data='_prisma_migrations' \
     -f "$BACKUP_FILE"
   ```

5. Show file size:
   ```
   ls -lh "$BACKUP_FILE"
   ```

### Output

```
Database backed up!

File: <backup_file>
Size: <file_size>

Data summary:
  Users:          <count>
  Conversations:  <count>
  Messages:       <count>
  Memories:       <count>
  Notes:          <count>
  Tasks:          <count>
  Projects:       <count>
  Life Areas:     <count>
  Daily Logs:     <count>
  Companions:     <count>

To restore this backup later: /backup-data restore <filename>
```

---

## List Flow

1. List all backups:

   ```
   ls -lhtr backups/db-backup-*.sql 2>/dev/null
   ```

2. If no backups found, say: "No backups found. Run `/backup-data` to create one."

3. Otherwise show them in a clean table with date, size, and filename.

---

## Restore Flow

### Steps

1. If no specific filename was given, list available backups (run **List Flow**) and ask the user which one to restore.

2. Verify the backup file exists. If not, show available backups and ask again.

3. **IMPORTANT: Always ask for confirmation before restoring.** Show this warning:

   ```
   This will replace ALL data in your local database with the backup.
   Current data will be lost. Are you sure?

   Backup: <filename>
   ```

4. Wait for explicit "yes" confirmation.

5. Once confirmed, restore:

   ```
   PGPASSWORD=postgres psql -h localhost -U postgres -d mindvalley_ai_advanced < "<backup_file>"
   ```

6. After restore, re-apply any pending Prisma migrations to ensure schema is current:

   ```
   pnpm prisma migrate deploy
   ```

7. Verify the restore by counting key tables (same query as backup step 3).

### Output

```
Database restored from <filename>!

Data summary:
  Users:          <count>
  Conversations:  <count>
  Messages:       <count>
  ...

Your app may need a restart to pick up the changes. Run: pnpm dev
```

---

## Important Rules

1. **Always confirm before restore** — restoring overwrites all current data.
2. **Never delete backups** — only the user should delete old backup files.
3. **Backups stay local** — the `backups/` directory is in `.gitignore`. Never commit backup files.
4. **Use `migrate deploy` after restore** — this applies any migrations that were created after the backup was taken, without requiring a reset.
5. **Check Docker first** — if Postgres isn't reachable, tell the user to start Docker: `docker compose -f docker/docker-compose.yml up -d postgres`
