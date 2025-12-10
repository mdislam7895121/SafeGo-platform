import { memo } from "react";

type Region = "BD" | "US" | "GLOBAL";

const CTA_CONFIG: Record<Region, { subtitle: string }> = {
  BD: {
    subtitle: "SafeGo is launching soon in Bangladesh. App download links will be available on release."
  },
  US: {
    subtitle: "SafeGo is coming soon to the App Store and Google Play in the United States."
  },
  GLOBAL: {
    subtitle: "SafeGo is expanding globally. Download links will be available in your region soon."
  }
};

interface ReadyToMoveSectionProps {
  selectedRegion: Region;
}

export const ReadyToMoveSection = memo(function ReadyToMoveSection({ selectedRegion }: ReadyToMoveSectionProps) {
  const config = CTA_CONFIG[selectedRegion] || CTA_CONFIG.GLOBAL;
  
  return (
    <section 
      aria-labelledby="ready-to-move-heading"
      className="bg-gradient-to-b from-[#0054F5] to-[#0131A0] py-24 md:py-28"
      data-testid="section-cta"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2
          id="ready-to-move-heading"
          className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-3"
        >
          Ready to move with SafeGo?
        </h2>

        <p className="text-base sm:text-lg text-white/90 max-w-2xl mx-auto mb-9">
          {config.subtitle}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mb-9">
          <a
            href="#"
            aria-label="Download SafeGo on the App Store (coming soon)"
            className="group inline-flex items-center justify-center rounded-xl bg-black px-5 py-3 shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition-transform duration-150 hover:-translate-y-0.5"
            data-testid="link-app-store"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </div>
              <div className="text-left leading-tight">
                <div className="text-[11px] uppercase tracking-[0.12em] text-white/70">
                  Download on the
                </div>
                <div className="text-lg font-semibold text-white">
                  App Store
                </div>
              </div>
            </div>
          </a>

          <a
            href="#"
            aria-label="Get SafeGo on Google Play (coming soon)"
            className="group inline-flex items-center justify-center rounded-xl bg-black px-5 py-3 shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition-transform duration-150 hover:-translate-y-0.5"
            data-testid="link-google-play"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/>
                </svg>
              </div>
              <div className="text-left leading-tight">
                <div className="text-[11px] uppercase tracking-[0.12em] text-white/70">
                  Get it on
                </div>
                <div className="text-lg font-semibold text-white">
                  Google Play
                </div>
              </div>
            </div>
          </a>
        </div>

        <div>
          <a
            href="/partners"
            className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm sm:text-base font-semibold text-[#0054F5] shadow-md shadow-black/20 transition-all duration-150 hover:shadow-lg hover:-translate-y-0.5"
            data-testid="button-cta-partner"
          >
            Become a partner
          </a>
        </div>
      </div>
    </section>
  );
});

export default ReadyToMoveSection;
