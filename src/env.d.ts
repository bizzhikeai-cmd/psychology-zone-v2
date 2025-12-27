/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly ADMIN_PASSWORD: string;
  readonly ADMIN_SESSION_TOKEN: string;
  readonly RAZORPAY_KEY_ID: string;
  readonly RAZORPAY_KEY_SECRET: string;
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_KEY: string;
  readonly INTERAKT_API_KEY: string;
  readonly INTERAKT_CUSTOMER_TEMPLATE: string;
  readonly INTERAKT_ADMIN_TEMPLATE: string;
  readonly ADMIN_WHATSAPP_NUMBER: string;
  readonly GTM_CONTAINER_ID: string;
  readonly SITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}