// check requirements to run Makerkit
void checkRequirements();

function checkRequirements() {
  checkNodeVersion();
  checkPathNotOneDrive();
}

/**
 * Checks if the current Node version is compatible with Makerkit.
 * If the current Node version is not compatible, it exits the script with an error message.
 */
function checkNodeVersion() {
  const requiredNodeVersion = '>=v18.18.0';
  const currentNodeVersion = process.versions.node;
  const [major, minor] = currentNodeVersion.split('.').map(Number);

  if (major < 18 || (major === 18 && minor < 18)) {
    console.error(
      `\x1b[31m%s\x1b[0m`,
      `You are running Node ${currentNodeVersion}. Makerkit requires Node ${requiredNodeVersion}.`,
    );

    process.exit(1);
  } else {
    console.log(
      `\x1b[32m%s\x1b[0m`,
      `You are running Node ${currentNodeVersion}.`,
    );
  }
}

/**
 * Checks if the current working directory is not OneDrive.
 * If the current working directory is OneDrive, it exits the script with an error message.
 */
function checkPathNotOneDrive() {
  const path = process.cwd();

  if (path.includes('OneDrive')) {
    console.error(
      `\x1b[31m%s\x1b[0m`,
      `You are running Makerkit from OneDrive. Please move your project to a local folder.`,
    );

    process.exit(1);
  }
}
