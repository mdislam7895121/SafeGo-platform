import { Car, Bike, Truck, UtensilsCrossed, Store, Ticket, Bus } from "lucide-react";

export type PartnerKind = "driver_ride" | "driver_delivery" | "restaurant" | "shop_partner" | "ticket_operator";

export interface PartnerCardText {
  kind: PartnerKind;
  title: string;
  description: string;
  buttonText: string;
  icon: typeof Car;
  bdOnly?: boolean;
}

export interface PartnerTexts {
  masterTagline: string;
  sectionTitle: string;
  cards: PartnerCardText[];
  statusLabels: {
    not_started: string;
    draft: string;
    kyc_pending: string;
    setup_incomplete: string;
    ready_for_review: string;
    live: string;
    rejected: string;
  };
  loginButtonText: string;
}

const BD_TEXTS: PartnerTexts = {
  masterTagline: "আপনার সময়কে আয়ে পরিণত করুন। SafeGo–তে পার্টনার হোন।",
  sectionTitle: "SafeGo Partner Programs",
  cards: [
    {
      kind: "driver_ride",
      title: "রাইড শেয়ার ড্রাইভার",
      description: "নিজের মতো চালান, প্রতিদিন আয় করুন।",
      buttonText: "রাইড ড্রাইভার হোন",
      icon: Car,
    },
    {
      kind: "driver_delivery",
      title: "ডেলিভারি ড্রাইভার",
      description: "ডেলিভারি দিন, আয় বাড়ান।",
      buttonText: "ডেলিভারি ড্রাইভার হোন",
      icon: Truck,
    },
    {
      kind: "restaurant",
      title: "রেস্টুরেন্ট পার্টনার",
      description: "নতুন গ্রাহক পান, অর্ডার বাড়ান।",
      buttonText: "রেস্টুরেন্ট পার্টনার হোন",
      icon: UtensilsCrossed,
    },
    {
      kind: "shop_partner",
      title: "দোকান পার্টনার",
      description: "দোকান অনলাইনে আনুন, বেশি ক্রেতা পান।",
      buttonText: "দোকান পার্টনার হোন",
      icon: Store,
      bdOnly: true,
    },
    {
      kind: "ticket_operator",
      title: "টিকিট পার্টনার",
      description: "টিকিট অনলাইনে দিন, বিক্রি বাড়ান।",
      buttonText: "টিকিট পার্টনার হোন",
      icon: Ticket,
      bdOnly: true,
    },
  ],
  statusLabels: {
    not_started: "শুরু করুন",
    draft: "খসড়া",
    kyc_pending: "KYC পেন্ডিং",
    setup_incomplete: "সেটআপ অসম্পূর্ণ",
    ready_for_review: "রিভিউ পেন্ডিং",
    live: "সক্রিয়",
    rejected: "বাতিল",
  },
  loginButtonText: "লগইন করে শুরু করুন",
};

const US_TEXTS: PartnerTexts = {
  masterTagline: "Turn your time into income. Become a SafeGo Partner.",
  sectionTitle: "SafeGo Partner Programs",
  cards: [
    {
      kind: "driver_ride",
      title: "Ride Share Driver",
      description: "Drive your way. Earn every day.",
      buttonText: "Become a Ride Driver",
      icon: Car,
    },
    {
      kind: "driver_delivery",
      title: "Food & Parcel Delivery Driver",
      description: "Deliver more. Earn more.",
      buttonText: "Become a Delivery Driver",
      icon: Truck,
    },
    {
      kind: "restaurant",
      title: "Restaurant Partner",
      description: "Reach more customers. Grow your orders.",
      buttonText: "Become a Restaurant Partner",
      icon: UtensilsCrossed,
    },
  ],
  statusLabels: {
    not_started: "Start Now",
    draft: "Draft",
    kyc_pending: "KYC Pending",
    setup_incomplete: "Setup Incomplete",
    ready_for_review: "Under Review",
    live: "Active",
    rejected: "Rejected",
  },
  loginButtonText: "Login to Start",
};

export function getPartnerTexts(countryCode: string): PartnerTexts {
  if (countryCode === "BD") {
    return BD_TEXTS;
  }
  return US_TEXTS;
}

export function getPartnerCardText(countryCode: string, partnerKind: PartnerKind): PartnerCardText | undefined {
  const texts = getPartnerTexts(countryCode);
  return texts.cards.find(card => card.kind === partnerKind);
}

export function getFilteredPartnerCards(countryCode: string): PartnerCardText[] {
  const texts = getPartnerTexts(countryCode);
  if (countryCode === "BD") {
    return texts.cards;
  }
  return texts.cards.filter(card => !card.bdOnly);
}
