import type { PlopTypes } from '@turbo/gen';
import { execSync } from 'node:child_process';

export function createSetupGenerator(plop: PlopTypes.NodePlopAPI) {
  plop.setGenerator('setup', {
    description: 'Setup your Makerkit project',
    prompts: [
      {
        type: 'input',
        name: 'projectName',
        message: 'What is the name of the project?',
      },
    ],
    actions: [
      {
        type: 'modify',
        path: 'package.json',
        async transform(content, answers) {
          const pkg = JSON.parse(content);

          // Update project name in package.json
          pkg.name = answers.projectName;

          return JSON.stringify(pkg, null, 2);
        },
      },
      async () => {
        try {
          setupRemote();

          return 'Project setup complete';
        } catch (error) {
          console.error('Project setup failed. Aborting package generation.');
          process.exit(1);
        }
      },
    ],
  });
}

function setupRemote() {
  // Setup remote upstream
  const getRemoteUrl = execSync('git remote get-url origin', {
    stdio: 'inherit',
  });

  const currentRemote = getRemoteUrl.toString().trim();

  console.log(`Setting upstream remote to ${currentRemote} ...`);

  if (currentRemote && currentRemote.includes('github.com')) {
    execSync(`git remote delete origin`, {
      stdio: 'inherit',
    });

    execSync(`git remote set-url upstream ${currentRemote}`, {
      stdio: 'inherit',
    });
  } else {
    console.error('Your current remote is not GitHub');
  }

  // Run license script
  try {
    execSync('turbo run --filter license dev', {
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('License script failed. Aborting package generation.');
    process.exit(1);
  }
}
