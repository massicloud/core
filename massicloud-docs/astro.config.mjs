import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import mermaid from 'astro-mermaid'

export default defineConfig({
  site: 'https://docs.massicloud.dz',
  integrations: [
    mermaid({
      theme: 'dark',
      autoTheme: true,
    }),
    starlight({
      title: 'MassiCloud Docs',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: false,
      },
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        fr: { label: 'Français', lang: 'fr' },
        ar: { label: 'العربية', lang: 'ar', dir: 'rtl' },
      },
      customCss: [
        './src/styles/custom.css',
      ],
      lastUpdated: true,
      sidebar: [
        {
          label: 'Get Started',
          translations: {
            fr: 'Démarrage',
            ar: 'البدء',
          },
          items: [
            { label: 'Welcome',           slug: 'get-started/welcome' },
            { label: 'Create an account', slug: 'get-started/create-account' },
            { label: 'Create a project',  slug: 'get-started/create-project' },
            { label: 'Your first request', slug: 'get-started/first-request' },
            { label: 'Next steps',        slug: 'get-started/next-steps' },
          ],
        },
        {
          label: 'Concepts',
          translations: {
            fr: 'Concepts',
            ar: 'المفاهيم',
          },
          items: [
            { label: 'Overview',                 slug: 'concepts/overview' },
            { label: 'Projects & Databases',     slug: 'concepts/projects-databases' },
            { label: 'Stages',                   slug: 'concepts/stages', translations: { fr: 'Étapes', ar: 'المراحل' } },
            { label: 'Authentication',           slug: 'concepts/authentication' },
            { label: 'Row Level Security',       slug: 'concepts/rls' },
            { label: 'API Keys',                 slug: 'concepts/api-keys' },
            { label: 'Object Storage',           slug: 'concepts/object-storage' },
            { label: 'Redis Cache',              slug: 'concepts/redis' },
            { label: 'Sovereignty & Compliance', slug: 'concepts/sovereignty' },
          ],
        },
        {
          label: 'JavaScript SDK',
          translations: {
            fr: 'SDK JavaScript',
            ar: 'مكتبة JavaScript',
          },
          collapsed: false,
          items: [
            { label: 'Overview',        slug: 'sdk/javascript/overview' },
            { label: 'Installation',    slug: 'sdk/javascript/installation' },
            { label: 'Create a client', slug: 'sdk/javascript/create-client' },
            {
              label: 'Auth',
              collapsed: true,
              items: [
                { label: 'signUp',            slug: 'sdk/javascript/auth/sign-up' },
                { label: 'signIn',            slug: 'sdk/javascript/auth/sign-in' },
                { label: 'signOut',           slug: 'sdk/javascript/auth/sign-out' },
                { label: 'getUser',           slug: 'sdk/javascript/auth/get-user' },
                { label: 'getSession',        slug: 'sdk/javascript/auth/get-session' },
                { label: 'onAuthStateChange', slug: 'sdk/javascript/auth/on-auth-state-change' },
              ],
            },
            {
              label: 'REST',
              collapsed: true,
              items: [
                { label: 'from()',     slug: 'sdk/javascript/rest/from' },
                { label: 'select()',   slug: 'sdk/javascript/rest/select' },
                { label: 'insert()',   slug: 'sdk/javascript/rest/insert' },
                { label: 'update()',   slug: 'sdk/javascript/rest/update' },
                { label: 'delete()',   slug: 'sdk/javascript/rest/delete' },
                { label: 'Filters',    slug: 'sdk/javascript/rest/filters' },
                { label: 'Modifiers',  slug: 'sdk/javascript/rest/modifiers' },
              ],
            },
            {
              label: 'Storage',
              collapsed: true,
              items: [
                { label: 'Overview',          slug: 'sdk/javascript/storage/overview' },
                { label: 'list()',             slug: 'sdk/javascript/storage/list' },
                { label: 'upload()',           slug: 'sdk/javascript/storage/upload' },
                { label: 'download()',         slug: 'sdk/javascript/storage/download' },
                { label: 'createSignedUrl()',  slug: 'sdk/javascript/storage/create-signed-url' },
                { label: 'remove()',           slug: 'sdk/javascript/storage/remove' },
              ],
            },
          ],
        },
        {
          label: 'Other SDKs',
          translations: {
            fr: 'Autres SDKs',
            ar: 'مكتبات أخرى',
          },
          collapsed: true,
          items: [
            { label: 'Dart / Flutter (soon)', slug: 'sdk/dart/overview',   badge: { text: 'Soon', variant: 'caution' } },
            { label: 'Python (soon)',          slug: 'sdk/python/overview', badge: { text: 'Soon', variant: 'caution' } },
          ],
        },
        {
          label: 'API Reference',
          translations: {
            fr: 'Référence API',
            ar: 'مرجع API',
          },
          collapsed: true,
          items: [
            { label: 'Overview',        slug: 'api-reference/overview' },
            { label: 'Authentication',  slug: 'api-reference/authentication' },
            { label: 'Database (REST)', slug: 'api-reference/database' },
            { label: 'Storage (Buckets)', slug: 'api-reference/storage' },
            { label: 'Errors',          slug: 'api-reference/errors' },
          ],
        },
      ],
    }),
  ],
})
