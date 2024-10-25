import { execSync } from 'node:child_process';

export function checkPendingMigrations() {
  try {
    console.info('\x1b[34m%s\x1b[0m', 'Checking for pending migrations...');

    const output = execSync('pnpm --filter web supabase migration list', { encoding: 'utf-8', stdio: 'pipe' });
    const lines = output.split('\n');

    // Skip header lines
    const migrationLines = lines.slice(4);

    const pendingMigrations = migrationLines
        .filter(line => {
          const [local, remote] = line.split('│').map(s => s.trim());
          return local !== '' && remote === '';
        })
        .map(line => (line.split('│')[0] ?? '').trim());

    if (pendingMigrations.length > 0) {
      console.log('\x1b[33m%s\x1b[0m', '⚠️  There are pending migrations that need to be applied:');
      pendingMigrations.forEach(migration => console.log(`  - ${migration}`));
      console.log('\nPlease run "pnpm --filter web supabase db push" to apply these migrations.');
    } else {
      console.log('\x1b[32m%s\x1b[0m', '✅ All migrations are up to date.');
    }
  } catch (error) {
    console.log('\x1b[33m%s\x1b[0m', '⚠️  Migrations: No remote Supabase project found, we could not check pending migrations. This is normal if you have not yet have linked your Supabase project. Feel free to ignore this message.');
  }
}