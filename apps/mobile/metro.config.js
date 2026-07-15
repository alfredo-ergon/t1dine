// Monorepo-aware Metro config: watch the workspace root and resolve modules
// from both the app and the hoisted workspace-root node_modules.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// The shared workspace packages are TypeScript source authored for NodeNext
// (Node ESM requires explicit ".js" extensions on relative imports). Metro does
// not remap those to the ".ts" sources, so a runtime import of, say,
// @t1dine/food-schema fails on `export * from "./validation.js"`. Fall back to
// the extensionless specifier (which resolves to .ts via sourceExts) when the
// literal ".js" cannot be found.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  try {
    return resolve(context, moduleName, platform);
  } catch (error) {
    if (moduleName.endsWith(".js")) {
      return resolve(context, moduleName.slice(0, -3), platform);
    }
    throw error;
  }
};

module.exports = config;
