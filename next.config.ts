import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    rules: {
        '@typescript-eslint/no-unused-vars': 'warn',
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    webpack: (config) => {
        config.resolve = config.resolve || {};
        config.resolve.alias = config.resolve.alias || {};
        config.resolve.alias["promptpay-qr"] = path.resolve(__dirname, "src/vendor/promptpay-qr.ts");
        return config;
    },
};

export default nextConfig;
