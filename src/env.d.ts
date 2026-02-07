/// <reference types="astro/client" />

// Cloudflare portal bindings (D1, KV, R2, SESSION_SECRET) + Phase 3.5 notification vars
interface Env {
  DB: D1Database;
  CLOURHOA_USERS: KVNamespace;
  CLOURHOA_FILES: R2Bucket;
  SESSION_SECRET: string;
  KV?: KVNamespace;
  NOTIFY_BOARD_EMAIL?: string;
  NOTIFY_ARB_EMAIL?: string;
  NOTIFY_NOREPLY_EMAIL?: string;
  MAILCHANNELS_API_KEY?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}

interface ImportMetaEnv {
  // Form and security
  readonly PUBLIC_STATICFORMS_API_KEY?: string;
  readonly PUBLIC_RECAPTCHA_SITE_KEY?: string;
  readonly PUBLIC_ANALYTICS_PROVIDER?: string;
  /** Cloudflare Web Analytics: token from Web Analytics → Add site → Manage site (script snippet). */
  readonly PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN?: string;
  readonly SITE?: string;
  
  // Contact information (PII)
  readonly PUBLIC_SECURITY_EMAIL?: string;
  readonly PUBLIC_MAILING_ADDRESS_NAME?: string;
  readonly PUBLIC_MAILING_ADDRESS_LINE1?: string;
  readonly PUBLIC_MAILING_ADDRESS_LINE2?: string;
  readonly PUBLIC_PHYSICAL_ADDRESS_STREET?: string;
  readonly PUBLIC_PHYSICAL_ADDRESS_CITY?: string;
  readonly PUBLIC_PHYSICAL_ADDRESS_STATE?: string;
  readonly PUBLIC_PHYSICAL_ADDRESS_ZIP?: string;
  readonly PUBLIC_MEETING_LOCATION?: string;
  readonly PUBLIC_MEETING_ROOM?: string;
  readonly PUBLIC_MEETING_ADDRESS_STREET?: string;
  readonly PUBLIC_MEETING_ADDRESS_CITY?: string;
  readonly PUBLIC_MEETING_ADDRESS_STATE?: string;
  readonly PUBLIC_MEETING_ADDRESS_ZIP?: string;
  
  // Waste Management & Recycling
  readonly PUBLIC_TRASH_SCHEDULE?: string;
  readonly PUBLIC_RECYCLING_SCHEDULE?: string;
  readonly PUBLIC_RECYCLING_CENTER_NAME?: string;
  readonly PUBLIC_RECYCLING_CENTER_ADDRESS?: string;
  readonly PUBLIC_RECYCLING_CENTER_HOURS?: string;
  readonly PUBLIC_RECYCLING_CENTER_PHONE?: string;
  readonly PUBLIC_RECYCLING_CENTER_WEBSITE?: string;
  readonly PUBLIC_WASTE_MANAGEMENT_CONTACT?: string;
  readonly PUBLIC_WASTE_MANAGEMENT_PHONE?: string;
  readonly PUBLIC_WASTE_MANAGEMENT_WEBSITE?: string;
  
  // Dues & Payment Information
  readonly PUBLIC_QUARTERLY_DUES_AMOUNT?: string;
  readonly PUBLIC_PAYMENT_METHODS?: string;
  readonly PUBLIC_LATE_FEE_AMOUNT?: string;
  readonly PUBLIC_LATE_FEE_DAYS?: string;
  readonly PUBLIC_PAYMENT_INSTRUCTIONS?: string;
  readonly PUBLIC_PAYMENT_DROP_OFF_LOCATION?: string;
  
  // Water Restrictions
  readonly PUBLIC_WATER_RESTRICTION_SCHEDULE?: string;
  readonly PUBLIC_WATER_RESTRICTION_PHONE?: string;
  readonly PUBLIC_WATER_RESTRICTION_WEBSITE?: string;
  readonly PUBLIC_WATER_UTILITY_CONTACT?: string;
  readonly PUBLIC_WATER_UTILITY_PHONE?: string;
  readonly PUBLIC_WATER_UTILITY_WEBSITE?: string;
  
  // Social Media (Optional)
  readonly PUBLIC_FACEBOOK_URL?: string;
  readonly PUBLIC_TWITTER_URL?: string;
  readonly PUBLIC_INSTAGRAM_URL?: string;
  readonly PUBLIC_NEXTDOOR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
