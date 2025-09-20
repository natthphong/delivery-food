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
};

export default nextConfig;
