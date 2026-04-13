import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Silences the "multiple lockfiles" workspace-root warning
    root: __dirname,
  },
};

export default nextConfig;
