// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://meoww.weikuwu.me',
  output: 'static',
  integrations: [sitemap()],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh-TW'],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false
    }
  }
});
