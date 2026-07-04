import type { NextConfig } from "next";

let basePath: string | undefined = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

if (basePath) {
  // Strip trailing slashes
  if (basePath.endsWith('/')) {
    basePath = basePath.slice(0, -1);
  }
  
  // Strip protocol and domain if present
  if (basePath.includes('://')) {
    try {
      const url = new URL(basePath);
      basePath = url.pathname;
    } catch {
      // fallback
    }
  } else if (!basePath.startsWith('/')) {
    if (basePath.includes('/')) {
      // "staging.strivelin.com/do" -> "/do"
      basePath = '/' + basePath.split('/').slice(1).join('/');
    } else {
      basePath = '/' + basePath;
    }
  }
  
  // Final check to ensure it starts with '/'
  if (basePath && !basePath.startsWith('/')) {
    basePath = '/' + basePath;
  }
}

const nextConfig: NextConfig = {
  output: 'standalone',
  basePath: basePath || undefined,
};

export default nextConfig;
