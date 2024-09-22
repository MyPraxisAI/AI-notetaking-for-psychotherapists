import { execSync } from 'child_process';

const endpoint = 'https://makerkit.dev/api/license/check';

async function checkLicense() {
  let gitUser, gitEmail;

  try {
    gitUser =
      execSync('git config user.username').toString().trim() ||
      execSync('git config user.name').toString().trim();
  } catch (error) {
    return;
  }

  if (!gitUser && !gitEmail) {
    throw new Error(
      "Please set the git user name with the command 'git config user.username <username>'. The username needs to match the GitHub username in your Makerkit organization.",
    );
  }

  try {
    gitEmail = execSync('git config user.email').toString().trim();
  } catch (error) {
    console.info('Error getting git config:', error.message);

    if (!gitUser) {
      throw new Error(
        "Please set the git user name with the command 'git config user.username <username>'. The username needs to match the GitHub username in your Makerkit organization.",
      );
    }
  }

  const searchParams = new URLSearchParams();

  searchParams.append('username', gitUser);

  if (gitEmail) {
    searchParams.append('email', gitEmail);
  }

  const res = await fetch(`${endpoint}?${searchParams.toString()}`);

  if (res.status === 200) {
    return Promise.resolve();
  } else {
    return Promise.reject(
      new Error(`License check failed. Please set the git user name with the command 'git config user.username <username>'. The username needs to match the GitHub username in your Makerkit organization.`),
    );
  }
}

function checkVisibility() {
  let remoteUrl;

  try {
    remoteUrl = execSync('git config --get remote.origin.url')
      .toString()
      .trim();
  } catch (error) {
    return Promise.resolve();
  }

  if (!remoteUrl.includes('github.com')) {
    return Promise.resolve();
  }

  let ownerRepo;

  if (remoteUrl.startsWith('https://github.com/')) {
    ownerRepo = remoteUrl.slice('https://github.com/'.length);
  } else if (remoteUrl.startsWith('git@github.com:')) {
    ownerRepo = remoteUrl.slice('git@github.com:'.length);
  } else {
    return;
  }

  ownerRepo = ownerRepo.replace(/\.git$/, '');

  return fetch(`https://api.github.com/repos/${ownerRepo}`)
    .then((res) => {
      if (res.status === 200) {
        return res.json();
      } else if (res.status === 404) {
        return Promise.resolve();
      } else {
        return Promise.reject(
          new Error(
            `GitHub API request failed with status code: ${res.status}`,
          ),
        );
      }
    })
    .then((data) => {
      if (data && !data.private) {
        console.error(
          'The repository has been LEAKED on GitHub. Please delete the repository. A DMCA Takedown Request will automatically be requested in the coming hours.',
        );

        process.exit(1);
      }
    });
}

async function main() {
  try {
    await checkVisibility();
    await checkLicense();
  } catch (error) {
    console.error(`Check failed with error: ${error.message}`);

    process.exit(1);
  }
}

void main();
