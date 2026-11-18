// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  redirects: {
    // Old URLs keep working: /collections moved under /photography, and "projects" was the earlier name.
    "/collections": "/photography/collections",
    "/collections/[slug]": "/photography/collections/[slug]",
    "/projects": "/photography/collections",
    "/projects/[slug]": "/photography/collections/[slug]",
  },
  // Start loading a page as soon as you hover/focus its link, so clicks feel instant
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  devToolbar: { enabled: false },
});
