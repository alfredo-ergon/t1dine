/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are consumed as TypeScript source; Next must transpile them.
  transpilePackages: ["@t1dine/domain", "@t1dine/food-schema", "@t1dine/design-tokens"],
  webpack: (config) => {
    // The shared packages use NodeNext-style ".js" specifiers on relative
    // imports (required for Node ESM), which point at ".ts" sources. Let
    // webpack resolve ".js" imports to their ".ts"/".tsx" equivalents.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

module.exports = nextConfig;
