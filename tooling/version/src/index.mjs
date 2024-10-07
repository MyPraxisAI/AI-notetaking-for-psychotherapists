import { execSync } from 'node:child_process';
import { checkPendingMigrations } from './migrations.mjs';

function runGitCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (error) {
    return null;
  }
}

function checkMakerkitVersion() {
  // Fetch the latest changes from upstream without merging
  const fetchResult = runGitCommand('git fetch upstream');

  if (fetchResult === null) {
    console.info(
        '\x1b[33m%s\x1b[0m', "⚠️ You have not setup 'upstream'. Please set up the upstream remote so you can update your Makerkit version.",
    );

    return;
  }

  // Get the number of commits the local branch is behind upstream
  const behindCount = runGitCommand('git rev-list --count HEAD..upstream/main');

  if (behindCount === null) {
    console.warn(
      "Failed to get commit count. Ensure you're on a branch that tracks upstream/main.",
    );

    return;
  }

  const count = parseInt(behindCount, 10);

  if (count > 0) {
    console.log('\x1b[33m%s\x1b[0m', '⚠️  Your Makerkit version is outdated!');

    console.log(
      '\x1b[33m%s\x1b[0m',
      `You are ${count} commit(s) behind the latest version.`,
    );

    console.log(
      '\x1b[33m%s\x1b[0m',
      'Please consider updating to the latest version for the best experience.',
    );

    console.log('\x1b[36m%s\x1b[0m', 'To update, run: git pull upstream main');
  } else {
    console.log('\x1b[32m%s\x1b[0m', '✅ Your Makerkit version is up to date!');
  }
}

checkMakerkitVersion();
checkPendingMigrations();