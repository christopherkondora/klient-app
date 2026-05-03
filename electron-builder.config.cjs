const azureCodeSigningEndpoint = process.env.AZURE_CODE_SIGNING_ENDPOINT || '';
const azureCodeSigningAccountName = process.env.AZURE_CODE_SIGNING_ACCOUNT_NAME || '';
const azureCertificateProfileName = process.env.AZURE_CERTIFICATE_PROFILE_NAME || '';
const azurePublisherName = process.env.AZURE_CODE_SIGNING_PUBLISHER_NAME || 'Klient';

module.exports = {
  appId: 'com.klient.app',
  productName: 'Klient',
  directories: {
    output: 'release',
  },
  files: ['dist-react/**/*', 'dist-electron/**/*', 'assets/**/*'],
  win: {
    icon: 'assets/icon.ico',
    target: 'nsis',
    signAndEditExecutable: true,
    forceCodeSigning: process.env.CI === 'true',
    signingHashAlgorithms: ['sha256'],
    azureSignOptions: {
      publisherName: azurePublisherName,
      endpoint: azureCodeSigningEndpoint,
      certificateProfileName: azureCertificateProfileName,
      codeSigningAccountName: azureCodeSigningAccountName,
      fileDigest: 'SHA256',
      timestampRfc3161: 'http://timestamp.acs.microsoft.com',
      timestampDigest: 'SHA256',
    },
    rfc3161TimeStampServer: 'http://timestamp.acs.microsoft.com',
    timeStampServer: 'http://timestamp.acs.microsoft.com',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Klient',
  },
  linux: {
    icon: 'assets/icon.png',
    target: 'AppImage',
  },
  mac: {
    icon: 'assets/icon.icns',
    category: 'public.app-category.business',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    target: [
      {
        target: 'dmg',
        arch: ['universal'],
      },
    ],
  },
  dmg: {
    sign: true,
  },
  afterSign: 'scripts/notarize.js',
  publish: {
    provider: 'github',
    owner: 'christopherkondora',
    repo: 'klient-app',
  },
};