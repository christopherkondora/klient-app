const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const LOG_PREFIX = '[notarize]';
const COMMAND_TIMEOUTS = {
  archive: 10 * 60 * 1000,
  submit: 30 * 60 * 1000,
  info: 2 * 60 * 1000,
  staple: 5 * 60 * 1000,
};

function getPositiveIntEnv(name, defaultValue) {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runCommand(command, args, timeoutMs) {
  try {
    const result = await execFileAsync(command, args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: timeoutMs,
    });

    return result.stdout.trim();
  } catch (error) {
    const stdout = typeof error.stdout === 'string' ? error.stdout.trim() : '';
    const stderr = typeof error.stderr === 'string' ? error.stderr.trim() : '';
    const details = [stderr, stdout].filter(Boolean).join('\n');
    const timeoutText = error.killed ? ' timed out or was killed' : ' failed';
    const safeError = new Error(`${command}${timeoutText}${details ? `\n${details}` : ''}`);
    safeError.code = error.code;
    throw safeError;
  }
}

function parseJson(output, label) {
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`Unable to parse ${label} JSON output: ${output}`);
  }
}

function getCredentialArgs() {
  return [
    '--apple-id',
    process.env.APPLE_ID,
    '--password',
    process.env.APPLE_APP_SPECIFIC_PASSWORD,
    '--team-id',
    process.env.APPLE_TEAM_ID,
  ];
}

async function createNotaryArchive(appPath, archivePath) {
  await fs.rm(archivePath, { force: true });
  console.log(`${LOG_PREFIX} Creating notarization archive at ${archivePath}`);
  await runCommand('ditto', ['-c', '-k', '--keepParent', appPath, archivePath], COMMAND_TIMEOUTS.archive);
}

async function submitArchive(archivePath, credentialArgs) {
  console.log(`${LOG_PREFIX} Submitting archive to Apple notary service`);
  const output = await runCommand(
    'xcrun',
    ['notarytool', 'submit', archivePath, ...credentialArgs, '--output-format', 'json'],
    COMMAND_TIMEOUTS.submit
  );
  const result = parseJson(output, 'notarytool submit');

  if (!result.id) {
    throw new Error(`Apple notarization submit did not return a submission id: ${output}`);
  }

  console.log(`${LOG_PREFIX} Submission id=${result.id}; status=${result.status || 'Submitted'}`);
  return result.id;
}

async function fetchNotaryLog(submissionId, credentialArgs) {
  try {
    const output = await runCommand(
      'xcrun',
      ['notarytool', 'log', submissionId, ...credentialArgs],
      COMMAND_TIMEOUTS.info
    );
    console.log(`${LOG_PREFIX} Apple notarization log for ${submissionId}:`);
    console.log(output);
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to fetch Apple notarization log for ${submissionId}`);
    console.error(error.message);
  }
}

async function waitForNotarization(submissionId, credentialArgs, timeoutMinutes, pollIntervalSeconds) {
  const startedAt = Date.now();
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const pollIntervalMs = pollIntervalSeconds * 1000;

  while (Date.now() - startedAt < timeoutMs) {
    const output = await runCommand(
      'xcrun',
      ['notarytool', 'info', submissionId, ...credentialArgs, '--output-format', 'json'],
      COMMAND_TIMEOUTS.info
    );
    const result = parseJson(output, 'notarytool info');
    const status = result.status || 'Unknown';
    const elapsedMinutes = ((Date.now() - startedAt) / 60000).toFixed(1);

    console.log(`${LOG_PREFIX} Apple status=${status}; elapsed=${elapsedMinutes}m; submissionId=${submissionId}`);

    if (status === 'Accepted') {
      return;
    }

    if (status === 'Invalid' || status === 'Rejected') {
      await fetchNotaryLog(submissionId, credentialArgs);
      throw new Error(`Apple notarization ${status}; submissionId=${submissionId}`);
    }

    await delay(pollIntervalMs);
  }

  throw new Error(`Apple notarization timed out after ${timeoutMinutes} minutes; submissionId=${submissionId}`);
}

async function stapleApp(appPath) {
  console.log(`${LOG_PREFIX} Stapling Apple notarization ticket to ${appPath}`);
  await runCommand('xcrun', ['stapler', 'staple', appPath], COMMAND_TIMEOUTS.staple);
  await runCommand('xcrun', ['stapler', 'validate', appPath], COMMAND_TIMEOUTS.staple);
  console.log(`${LOG_PREFIX} Stapling validation succeeded`);
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
  const archivePath = path.join(appOutDir, `${appName}-notarize.zip`);
  const credentialArgs = getCredentialArgs();
  const timeoutMinutes = getPositiveIntEnv('NOTARIZE_TIMEOUT_MINUTES', 120);
  const pollIntervalSeconds = getPositiveIntEnv('NOTARIZE_POLL_INTERVAL_SECONDS', 60);
  const startedAt = Date.now();

  console.log(`${LOG_PREFIX} Starting Apple notarization for ${appPath}`);
  console.log(`${LOG_PREFIX} Using Apple team ${process.env.APPLE_TEAM_ID}; timeout=${timeoutMinutes}m; poll=${pollIntervalSeconds}s`);

  try {
    await createNotaryArchive(appPath, archivePath);
    const submissionId = await submitArchive(archivePath, credentialArgs);
    await waitForNotarization(submissionId, credentialArgs, timeoutMinutes, pollIntervalSeconds);
    await stapleApp(appPath);

    const elapsedMinutes = ((Date.now() - startedAt) / 60000).toFixed(1);
    console.log(`${LOG_PREFIX} Apple notarization finished in ${elapsedMinutes}m`);
  } catch (error) {
    const elapsedMinutes = ((Date.now() - startedAt) / 60000).toFixed(1);
    console.error(`${LOG_PREFIX} Apple notarization failed after ${elapsedMinutes}m`);
    throw error;
  } finally {
    await fs.rm(archivePath, { force: true });
  }
};
