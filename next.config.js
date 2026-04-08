/** @type {import('next').NextConfig} */
const webpack = require('webpack')

const nextConfig = {
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
  },
  webpack: (config, { isServer }) => {
    // Ignore playwright/test and playwright-core completely
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(playwright|@playwright\/test)$/,
      })
    )

    // Ignore all files in src/pages/test/ from being bundled
    // These are test pages that import fs-based modules
    config.module.rules.push({
      test: /src\/pages\/test\//,
      loader: 'null-loader',
    })

    if (!isServer) {
      // Map node: prefix modules to false (ignore them) using alias
      // This works for node: protocol imports which resolve.fallback doesn't handle
      config.resolve.alias = {
        ...config.resolve.alias,
        'node:buffer': false,
        'node:fs': false,
        'node:https': false,
        'node:http': false,
        'node:net': false,
        'node:path': false,
        'node:os': false,
        'node:util': false,
        child_process: false,
      }
    }

    return config
  },
}

module.exports = nextConfig