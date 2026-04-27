const { notarize } = require('@electron/notarize');

const LOG_PREFIX = '[notarize]';

function getTimeoutMinutes() {
  const parsed = Number.parseInt(process.env.NOTARIZE_TIMEOUT_MINUTES || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 45;
}

async function withTimeout(promise, timeoutMinutes) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Apple notarization timed out after ${timeoutMinutes} minutes`));
    }, timeoutMinutes * 60 * 1000);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  console.log(`${LOG_PREFIX} Hook invoked for platform=${electronPlatformName}`);

  if (electronPlatformName !== 'darwin') {
    console.log(`${LOG_PREFIX} Skipping Apple notarization for non-macOS build`);
    return;
  }

  const missingEnvVars = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'].filter(
    (name) => !process.env[name]
  );

  if (missingEnvVars.length > 0) {
    console.log(`${LOG_PREFIX} Skipping Apple notarization; missing ${missingEnvVars.join(', ')}`);
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;
  const timeoutMinutes = getTimeoutMinutes();
  const startedAt = Date.now();

  console.log(`${LOG_PREFIX} Starting Apple notarization for ${appPath}`);
  console.log(`${LOG_PREFIX} Using Apple team ${process.env.APPLE_TEAM_ID}; timeout=${timeoutMinutes}m`);

  try {
    await withTimeout(
      notarize({
        appBundleId: 'com.klient.app',
        appPath,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID,
      }),
      timeoutMinutes
    );

    const elapsedMinutes = ((Date.now() - startedAt) / 60000).toFixed(1);
    console.log(`${LOG_PREFIX} Apple notarization finished in ${elapsedMinutes}m`);
  } catch (error) {
    const elapsedMinutes = ((Date.now() - startedAt) / 60000).toFixed(1);
    console.error(`${LOG_PREFIX} Apple notarization failed after ${elapsedMinutes}m`);
    throw error;
  }
};
