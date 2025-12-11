export type PartnerType = 'driver_ride' | 'driver_delivery' | 'restaurant' | 'shop_partner' | 'ticket_operator';
export type CountryCode = 'BD' | 'US';

export interface PartnerAvailabilityConfig {
  enabled: boolean;
  waitlistEnabled: boolean;
  approvalMessage: string;
}

export const PARTNER_AVAILABILITY: Record<PartnerType, Record<CountryCode, PartnerAvailabilityConfig>> = {
  driver_ride: {
    BD: {
      enabled: true,
      waitlistEnabled: false,
      approvalMessage: "Typical approval time: 24-48 hours after document submission",
    },
    US: {
      enabled: true,
      waitlistEnabled: false,
      approvalMessage: "Typical approval time: 3-5 business days after background check",
    },
  },
  driver_delivery: {
    BD: {
      enabled: true,
      waitlistEnabled: false,
      approvalMessage: "Typical approval time: 24-48 hours after document submission",
    },
    US: {
      enabled: true,
      waitlistEnabled: false,
      approvalMessage: "Typical approval time: 3-5 business days after background check",
    },
  },
  restaurant: {
    BD: {
      enabled: true,
      waitlistEnabled: false,
      approvalMessage: "Typical approval time: 3-5 business days after document review",
    },
    US: {
      enabled: true,
      waitlistEnabled: false,
      approvalMessage: "Typical approval time: 5-7 business days after verification",
    },
  },
  shop_partner: {
    BD: {
      enabled: true,
      waitlistEnabled: false,
      approvalMessage: "Typical approval time: 24-48 hours",
    },
    US: {
      enabled: false,
      waitlistEnabled: true,
      approvalMessage: "Coming soon to the United States",
    },
  },
  ticket_operator: {
    BD: {
      enabled: true,
      waitlistEnabled: false,
      approvalMessage: "Typical approval time: 24-48 hours",
    },
    US: {
      enabled: false,
      waitlistEnabled: true,
      approvalMessage: "Coming soon to the United States",
    },
  },
};

export function isPartnerAvailable(partnerType: PartnerType, countryCode: string): boolean {
  const config = PARTNER_AVAILABILITY[partnerType]?.[countryCode as CountryCode];
  return config?.enabled ?? false;
}

export function getPartnerConfig(partnerType: PartnerType, countryCode: string): PartnerAvailabilityConfig | null {
  return PARTNER_AVAILABILITY[partnerType]?.[countryCode as CountryCode] ?? null;
}
