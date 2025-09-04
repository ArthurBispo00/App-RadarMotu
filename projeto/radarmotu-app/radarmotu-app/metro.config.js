// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Workaround: desabilita "package.json:exports" no resolver do Metro,
// evitando imports profundos quebrarem (ex.: metro/src/lib/TerminalReporter)
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: false,
};

module.exports = config;
