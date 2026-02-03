/// <reference types="astro/client" />

interface ImportMetaEnv {
  // Form and security
  readonly PUBLIC_FORMSPREE_FORM_ID?: string;
  readonly PUBLIC_STATICFORMS_API_KEY?: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  readonly PUBLIC_RECAPTCHA_SITE_KEY?: string;
  readonly PUBLIC_ANALYTICS_PROVIDER?: string;
  readonly PUBLIC_PLAUSIBLE_DOMAIN?: string;
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
