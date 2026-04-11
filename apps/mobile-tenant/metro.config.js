const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Metro config for pnpm monorepo — without this, Babel's transform worker
// resolves presets from the monorepo root and can't find babel-preset-expo
// which is only hoisted to the app's virtual node_modules.
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so Metro can resolve workspace packages (e.g. @maya/types)
config.watchFolders = [monorepoRoot];

// Search order: app-local node_modules first, then monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;
