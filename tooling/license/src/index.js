import { execSync } from 'child_process';

async function checkLicense() {
  let gitUser, gitEmail;

  try {
    gitUser = execSync('git config user.name').toString().trim();
    gitEmail = execSync('git config user.email').toString().trim();
  } catch (error) {
    console.error('Error getting git config:', error.message);
    process.exit(1);
  }

  if (!gitUser) {
    console.error(
      "Please set the git user name with the command 'git config user.name <username>'. The username needs to match the username in your Makerkit organization.",
    );

    process.exit(1);
  }

  const res = await fetch(
    `https://makerkit.dev/api/license/check?username=${encodeURIComponent(gitUser)}&email=${encodeURIComponent(gitEmail)}`,
  );
  if (res.status === 200) {
    return Promise.resolve();
  } else {
    return Promise.reject(
      new Error(`License check failed with status code: ${res.status}`),
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
    console.error('Error getting git remote URL:', error.message);
    process.exit(1);
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
    console.error('Unsupported GitHub URL format');
    process.exit(1);
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
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  try {
    await checkVisibility();
    await checkLicense();
  } catch (error) {
    process.exit(1);
  }
}

void main();
