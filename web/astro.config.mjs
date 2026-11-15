// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  // Old URLs from before the rename keep working
  redirects: { "/projects": "/collections", "/projects/[slug]": "/collections/[slug]" },
  // Start loading a page as soon as you hover/focus its link, so clicks feel instant
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  devToolbar: { enabled: false },
});