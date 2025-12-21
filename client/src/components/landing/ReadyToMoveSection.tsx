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
  cmsTitle?: string;
  cmsSubtitle?: string;
}

export const ReadyToMoveSection = memo(function ReadyToMoveSection({ selectedRegion, cmsTitle, cmsSubtitle }: ReadyToMoveSectionProps) {
  const config = CTA_CONFIG[selectedRegion] || CTA_CONFIG.GLOBAL;
  const title = cmsTitle || "Ready to move with SafeGo?";
  const subtitle = cmsSubtitle || config.subtitle;
  
  return (
    <section 
      aria-labelledby="ready-to-move-heading"
      className="relative py-24 md:py-28 overflow-hidden"
      style={{
        background: `
          linear-gradient(180deg, #005DFF 0%, #0039C7 55%, #002477 100%)
        `,
      }}
      data-testid="section-cta"
    >
      {/* Radial highlight at top */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at top center, rgba(255,255,255,0.12), transparent 70%)',
        }}
      />
      
      {/* Radial shadow at bottom */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at bottom center, rgba(0,0,0,0.35), transparent 75%)',
        }}
      />

      <div 
        className="relative mx-auto px-6 sm:px-8 text-center"
        style={{ maxWidth: '960px' }}
      >
        <h2
          id="ready-to-move-heading"
          className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white"
          style={{ marginBottom: '16px' }}
        >
          {title}
        </h2>

        <p 
          className="text-base sm:text-lg text-white/90 max-w-2xl mx-auto"
          style={{ marginBottom: '36px' }}
        >
          {subtitle}
        </p>

        {/* App Store Badges */}
        <div 
          className="flex flex-col sm:flex-row flex-wrap items-center justify-center"
          style={{ 
            gap: '20px',
            marginBottom: '44px'
          }}
        >
          {/* App Store Badge */}
          <a
            href="#"
            aria-label="Download SafeGo on the App Store (coming soon)"
            className="inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-700"
            style={{
              background: '#000000',
              borderRadius: '14px',
              padding: '14px 22px',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 12px 28px rgba(0,0,0,0.45), inset 0 3px 6px rgba(255,255,255,0.18)',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 18px 38px rgba(0,0,0,0.55), inset 0 3px 6px rgba(255,255,255,0.20)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.45), inset 0 3px 6px rgba(255,255,255,0.18)';
            }}
            data-testid="link-app-store"
          >
            <div className="flex items-center gap-3.5">
              <div 
                className="flex items-center justify-center rounded-lg bg-white/10"
                style={{ width: '42px', height: '42px' }}
              >
                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
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

          {/* Google Play Badge */}
          <a
            href="#"
            aria-label="Get SafeGo on Google Play (coming soon)"
            className="inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-700"
            style={{
              background: '#000000',
              borderRadius: '14px',
              padding: '14px 22px',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 12px 28px rgba(0,0,0,0.45), inset 0 3px 6px rgba(255,255,255,0.18)',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 18px 38px rgba(0,0,0,0.55), inset 0 3px 6px rgba(255,255,255,0.20)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.45), inset 0 3px 6px rgba(255,255,255,0.18)';
            }}
            data-testid="link-google-play"
          >
            <div className="flex items-center gap-3.5">
              <div 
                className="flex items-center justify-center rounded-lg bg-white/10"
                style={{ width: '42px', height: '42px' }}
              >
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
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

        {/* Become a Partner Button */}
        <div>
          <a
            href="/partners"
            className="inline-flex items-center justify-center font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-700"
            style={{
              borderRadius: '40px',
              background: '#FFFFFF',
              color: '#004DFF',
              padding: '14px 40px',
              fontSize: '16px',
              boxShadow: '0 10px 28px rgba(0,0,0,0.30)',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 16px 38px rgba(0,0,0,0.40)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.30)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
            }}
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
