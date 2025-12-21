import { defineConfig } from 'astro/config';
import vercel from 'astro/integrations/vercel';

export default defineConfig({
  integrations: [vercel()],
  output: 'server',
});
