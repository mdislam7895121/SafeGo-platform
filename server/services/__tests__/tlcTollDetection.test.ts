import { describe, it, expect, beforeAll } from "@jest/globals";

const NYC_TLC_TOLL_FACILITIES = [
  {
    id: 'verrazzano_bridge',
    name: 'Verrazzano-Narrows Bridge',
    shortName: 'Verrazzano Bridge',
    segmentIdentifiers: ['verrazzano', 'verrazano', 'verrazzano-narrows', 'verrazzano narrows'],
    ezPassRate: 6.94,
    ezPassRatePeak: 10.17,
    inboundOnly: true,
    operator: 'MTA',
  },
  {
    id: 'battery_tunnel',
    name: 'Hugh L. Carey Tunnel (Brooklyn-Battery)',
    shortName: 'Battery Tunnel',
    segmentIdentifiers: ['hugh l. carey', 'battery tunnel', 'brooklyn-battery', 'brooklyn battery'],
    ezPassRate: 6.94,
    ezPassRatePeak: 10.17,
    inboundOnly: true,
    operator: 'MTA',
  },
  {
    id: 'queens_midtown_tunnel',
    name: 'Queens-Midtown Tunnel',
    shortName: 'Midtown Tunnel',
    segmentIdentifiers: ['queens-midtown', 'midtown tunnel', 'queens midtown'],
    ezPassRate: 6.94,
    ezPassRatePeak: 10.17,
    inboundOnly: true,
    operator: 'MTA',
  },
  {
    id: 'rfk_bridge',
    name: 'Robert F. Kennedy Bridge (Triborough)',
    shortName: 'RFK Bridge',
    segmentIdentifiers: ['rfk', 'triborough', 'triboro', 'robert f. kennedy'],
    ezPassRate: 6.94,
    ezPassRatePeak: 10.17,
    inboundOnly: true,
    operator: 'MTA',
  },
  {
    id: 'whitestone_bridge',
    name: 'Bronx-Whitestone Bridge',
    shortName: 'Whitestone Bridge',
    segmentIdentifiers: ['whitestone', 'bronx-whitestone', 'bronx whitestone'],
    ezPassRate: 6.94,
    ezPassRatePeak: 10.17,
    inboundOnly: true,
    operator: 'MTA',
  },
  {
    id: 'throgs_neck_bridge',
    name: 'Throgs Neck Bridge',
    shortName: 'Throgs Neck',
    segmentIdentifiers: ['throgs neck', 'throgsneck', 'throgs'],
    ezPassRate: 6.94,
    ezPassRatePeak: 10.17,
    inboundOnly: true,
    operator: 'MTA',
  },
  {
    id: 'george_washington_bridge',
    name: 'George Washington Bridge',
    shortName: 'GW Bridge',
    segmentIdentifiers: ['george washington', 'gw bridge', 'gwb'],
    ezPassRate: 13.75,
    ezPassRatePeak: 16.75,
    direction: 'both',
    operator: 'PANYNJ',
  },
  {
    id: 'goethals_bridge',
    name: 'Goethals Bridge',
    shortName: 'Goethals Bridge',
    segmentIdentifiers: ['goethals'],
    ezPassRate: 13.75,
    ezPassRatePeak: 16.75,
    direction: 'both',
    operator: 'PANYNJ',
  },
  {
    id: 'bayonne_bridge',
    name: 'Bayonne Bridge',
    shortName: 'Bayonne Bridge',
    segmentIdentifiers: ['bayonne'],
    ezPassRate: 13.75,
    ezPassRatePeak: 16.75,
    direction: 'both',
    operator: 'PANYNJ',
  },
  {
    id: 'outerbridge_crossing',
    name: 'Outerbridge Crossing',
    shortName: 'Outerbridge',
    segmentIdentifiers: ['outerbridge'],
    ezPassRate: 13.75,
    ezPassRatePeak: 16.75,
    direction: 'both',
    operator: 'PANYNJ',
  },
  {
    id: 'lincoln_tunnel',
    name: 'Lincoln Tunnel',
    shortName: 'Lincoln Tunnel',
    segmentIdentifiers: ['lincoln tunnel', 'lincoln tun'],
    ezPassRate: 13.75,
    ezPassRatePeak: 16.75,
    direction: 'both',
    operator: 'PANYNJ',
  },
  {
    id: 'holland_tunnel',
    name: 'Holland Tunnel',
    shortName: 'Holland Tunnel',
    segmentIdentifiers: ['holland tunnel', 'holland tun'],
    ezPassRate: 13.75,
    ezPassRatePeak: 16.75,
    direction: 'both',
    operator: 'PANYNJ',
  },
];

interface NYCTollFacility {
  id: string;
  name: string;
  shortName: string;
  segmentIdentifiers: string[];
  ezPassRate: number;
  ezPassRatePeak?: number;
  inboundOnly?: boolean;
  direction?: string;
  operator: string;
}

function detectNYCTLCTolls(
  tollSegments: string[],
  isPeakHour: boolean = false
): Array<{
  facility: NYCTollFacility;
  amount: number;
  isPeak: boolean;
}> {
  const detectedTolls: Array<{
    facility: NYCTollFacility;
    amount: number;
    isPeak: boolean;
  }> = [];
  
  const processedFacilities = new Set<string>();
  
  for (const segment of tollSegments) {
    const normalizedSegment = segment.toLowerCase().trim();
    
    for (const facility of NYC_TLC_TOLL_FACILITIES) {
      if (processedFacilities.has(facility.id)) continue;
      
      const matches = facility.segmentIdentifiers.some(identifier =>
        normalizedSegment.includes(identifier.toLowerCase()) ||
        identifier.toLowerCase().includes(normalizedSegment)
      );
      
      if (matches) {
        const rate = isPeakHour && facility.ezPassRatePeak
          ? facility.ezPassRatePeak
          : facility.ezPassRate;
        
        detectedTolls.push({
          facility,
          amount: rate,
          isPeak: isPeakHour && !!facility.ezPassRatePeak,
        });
        
        processedFacilities.add(facility.id);
      }
    }
  }
  
  return detectedTolls;
}

describe("NYC TLC Toll Detection System", () => {
  describe("Toll Facility Detection", () => {
    describe("MTA Bridges (Inbound Only - Manhattan-bound)", () => {
      it("should detect Verrazzano-Narrows Bridge with off-peak rate", () => {
        const tolls = detectNYCTLCTolls(["Verrazzano-Narrows Bridge"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("verrazzano_bridge");
        expect(tolls[0].amount).toBe(6.94);
        expect(tolls[0].isPeak).toBe(false);
        expect(tolls[0].facility.operator).toBe("MTA");
      });

      it("should detect Verrazzano-Narrows Bridge with peak rate", () => {
        const tolls = detectNYCTLCTolls(["verrazzano"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("verrazzano_bridge");
        expect(tolls[0].amount).toBe(10.17);
        expect(tolls[0].isPeak).toBe(true);
      });

      it("should detect alternate spelling 'verrazano'", () => {
        const tolls = detectNYCTLCTolls(["verrazano bridge"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("verrazzano_bridge");
      });

      it("should detect Hugh L. Carey (Battery) Tunnel with off-peak rate", () => {
        const tolls = detectNYCTLCTolls(["Hugh L. Carey Tunnel"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("battery_tunnel");
        expect(tolls[0].amount).toBe(6.94);
        expect(tolls[0].facility.operator).toBe("MTA");
      });

      it("should detect Battery Tunnel with peak rate", () => {
        const tolls = detectNYCTLCTolls(["Battery Tunnel"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("battery_tunnel");
        expect(tolls[0].amount).toBe(10.17);
        expect(tolls[0].isPeak).toBe(true);
      });

      it("should detect Brooklyn-Battery Tunnel", () => {
        const tolls = detectNYCTLCTolls(["brooklyn-battery tunnel"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("battery_tunnel");
      });

      it("should detect Queens-Midtown Tunnel with off-peak rate", () => {
        const tolls = detectNYCTLCTolls(["Queens-Midtown Tunnel"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("queens_midtown_tunnel");
        expect(tolls[0].amount).toBe(6.94);
      });

      it("should detect Midtown Tunnel with peak rate", () => {
        const tolls = detectNYCTLCTolls(["midtown tunnel"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("queens_midtown_tunnel");
        expect(tolls[0].amount).toBe(10.17);
      });

      it("should detect RFK Bridge (Triborough) with off-peak rate", () => {
        const tolls = detectNYCTLCTolls(["Triborough Bridge"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("rfk_bridge");
        expect(tolls[0].amount).toBe(6.94);
      });

      it("should detect RFK Bridge with peak rate", () => {
        const tolls = detectNYCTLCTolls(["RFK Bridge"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("rfk_bridge");
        expect(tolls[0].amount).toBe(10.17);
      });

      it("should detect Robert F. Kennedy Bridge", () => {
        const tolls = detectNYCTLCTolls(["Robert F. Kennedy Bridge"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("rfk_bridge");
      });

      it("should detect Bronx-Whitestone Bridge with off-peak rate", () => {
        const tolls = detectNYCTLCTolls(["Whitestone Bridge"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("whitestone_bridge");
        expect(tolls[0].amount).toBe(6.94);
      });

      it("should detect Bronx-Whitestone Bridge with peak rate", () => {
        const tolls = detectNYCTLCTolls(["Bronx-Whitestone Bridge"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("whitestone_bridge");
        expect(tolls[0].amount).toBe(10.17);
      });

      it("should detect Throgs Neck Bridge with off-peak rate", () => {
        const tolls = detectNYCTLCTolls(["Throgs Neck Bridge"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("throgs_neck_bridge");
        expect(tolls[0].amount).toBe(6.94);
      });

      it("should detect Throgs Neck Bridge with peak rate", () => {
        const tolls = detectNYCTLCTolls(["throgs neck"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("throgs_neck_bridge");
        expect(tolls[0].amount).toBe(10.17);
      });
    });

    describe("PANYNJ Crossings (NY-NJ Bi-directional)", () => {
      it("should detect George Washington Bridge with off-peak rate", () => {
        const tolls = detectNYCTLCTolls(["George Washington Bridge"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("george_washington_bridge");
        expect(tolls[0].amount).toBe(13.75);
        expect(tolls[0].facility.operator).toBe("PANYNJ");
      });

      it("should detect George Washington Bridge with peak rate", () => {
        const tolls = detectNYCTLCTolls(["GW Bridge"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("george_washington_bridge");
        expect(tolls[0].amount).toBe(16.75);
        expect(tolls[0].isPeak).toBe(true);
      });

      it("should detect GWB abbreviation", () => {
        const tolls = detectNYCTLCTolls(["GWB"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("george_washington_bridge");
      });

      it("should detect Lincoln Tunnel with off-peak rate", () => {
        const tolls = detectNYCTLCTolls(["Lincoln Tunnel"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("lincoln_tunnel");
        expect(tolls[0].amount).toBe(13.75);
      });

      it("should detect Lincoln Tunnel with peak rate", () => {
        const tolls = detectNYCTLCTolls(["Lincoln Tunnel"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("lincoln_tunnel");
        expect(tolls[0].amount).toBe(16.75);
      });

      it("should detect Holland Tunnel with off-peak rate", () => {
        const tolls = detectNYCTLCTolls(["Holland Tunnel"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("holland_tunnel");
        expect(tolls[0].amount).toBe(13.75);
      });

      it("should detect Holland Tunnel with peak rate", () => {
        const tolls = detectNYCTLCTolls(["Holland Tunnel"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("holland_tunnel");
        expect(tolls[0].amount).toBe(16.75);
      });

      it("should detect Goethals Bridge with off-peak rate", () => {
        const tolls = detectNYCTLCTolls(["Goethals Bridge"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("goethals_bridge");
        expect(tolls[0].amount).toBe(13.75);
      });

      it("should detect Goethals Bridge with peak rate", () => {
        const tolls = detectNYCTLCTolls(["goethals"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("goethals_bridge");
        expect(tolls[0].amount).toBe(16.75);
      });

      it("should detect Bayonne Bridge with off-peak rate", () => {
        const tolls = detectNYCTLCTolls(["Bayonne Bridge"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("bayonne_bridge");
        expect(tolls[0].amount).toBe(13.75);
      });

      it("should detect Bayonne Bridge with peak rate", () => {
        const tolls = detectNYCTLCTolls(["bayonne"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("bayonne_bridge");
        expect(tolls[0].amount).toBe(16.75);
      });

      it("should detect Outerbridge Crossing with off-peak rate", () => {
        const tolls = detectNYCTLCTolls(["Outerbridge Crossing"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("outerbridge_crossing");
        expect(tolls[0].amount).toBe(13.75);
      });

      it("should detect Outerbridge Crossing with peak rate", () => {
        const tolls = detectNYCTLCTolls(["outerbridge"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("outerbridge_crossing");
        expect(tolls[0].amount).toBe(16.75);
      });
    });

    describe("Multi-Toll Route Detection", () => {
      it("should detect multiple tolls on a single route", () => {
        const tolls = detectNYCTLCTolls([
          "George Washington Bridge",
          "Lincoln Tunnel",
        ], false);
        expect(tolls).toHaveLength(2);
        expect(tolls.map(t => t.facility.id)).toContain("george_washington_bridge");
        expect(tolls.map(t => t.facility.id)).toContain("lincoln_tunnel");
      });

      it("should calculate correct total for multi-toll route (off-peak)", () => {
        const tolls = detectNYCTLCTolls([
          "Verrazzano Bridge",
          "Battery Tunnel",
        ], false);
        const total = tolls.reduce((sum, t) => sum + t.amount, 0);
        expect(total).toBe(13.88); // 6.94 + 6.94
      });

      it("should calculate correct total for multi-toll route (peak)", () => {
        const tolls = detectNYCTLCTolls([
          "Verrazzano Bridge",
          "Battery Tunnel",
        ], true);
        const total = tolls.reduce((sum, t) => sum + t.amount, 0);
        expect(total).toBe(20.34); // 10.17 + 10.17
      });

      it("should detect mixed MTA and PANYNJ tolls", () => {
        const tolls = detectNYCTLCTolls([
          "Throgs Neck Bridge",
          "Lincoln Tunnel",
        ], false);
        expect(tolls).toHaveLength(2);
        const total = tolls.reduce((sum, t) => sum + t.amount, 0);
        expect(total).toBe(20.69); // 6.94 + 13.75
      });

      it("should not duplicate tolls when same segment appears twice", () => {
        const tolls = detectNYCTLCTolls([
          "Lincoln Tunnel",
          "Lincoln Tunnel",
          "lincoln tunnel",
        ], false);
        expect(tolls).toHaveLength(1);
      });

      it("should detect all 12 facilities in a hypothetical super-route", () => {
        const tolls = detectNYCTLCTolls([
          "Verrazzano-Narrows Bridge",
          "Battery Tunnel",
          "Queens-Midtown Tunnel",
          "RFK Bridge",
          "Whitestone Bridge",
          "Throgs Neck Bridge",
          "George Washington Bridge",
          "Goethals Bridge",
          "Bayonne Bridge",
          "Outerbridge Crossing",
          "Lincoln Tunnel",
          "Holland Tunnel",
        ], false);
        expect(tolls).toHaveLength(12);
        const total = tolls.reduce((sum, t) => sum + t.amount, 0);
        const expectedTotal = (6.94 * 6) + (13.75 * 6);
        expect(total).toBe(expectedTotal);
      });
    });

    describe("Edge Cases and Robustness", () => {
      it("should return empty array for no toll segments", () => {
        const tolls = detectNYCTLCTolls([], false);
        expect(tolls).toHaveLength(0);
      });

      it("should return empty array for non-matching segments", () => {
        const tolls = detectNYCTLCTolls([
          "I-95 North",
          "Belt Parkway",
          "Cross Bronx Expressway",
        ], false);
        expect(tolls).toHaveLength(0);
      });

      it("should handle case-insensitive matching", () => {
        const tolls = detectNYCTLCTolls([
          "GEORGE WASHINGTON BRIDGE",
          "george washington bridge",
          "George Washington Bridge",
        ], false);
        expect(tolls).toHaveLength(1);
      });

      it("should handle whitespace variations", () => {
        const tolls = detectNYCTLCTolls(["  lincoln tunnel  "], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("lincoln_tunnel");
      });

      it("should match partial segment identifiers", () => {
        const tolls = detectNYCTLCTolls(["Take the triboro to Manhattan"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("rfk_bridge");
      });
    });

    describe("Rate Accuracy", () => {
      it("should apply correct MTA off-peak rate ($6.94)", () => {
        const mtaFacilities = [
          "verrazzano",
          "battery tunnel",
          "midtown tunnel",
          "triborough",
          "whitestone",
          "throgs neck",
        ];
        for (const facility of mtaFacilities) {
          const tolls = detectNYCTLCTolls([facility], false);
          expect(tolls[0].amount).toBe(6.94);
        }
      });

      it("should apply correct MTA peak rate ($10.17)", () => {
        const mtaFacilities = [
          "verrazzano",
          "battery tunnel",
          "midtown tunnel",
          "triborough",
          "whitestone",
          "throgs neck",
        ];
        for (const facility of mtaFacilities) {
          const tolls = detectNYCTLCTolls([facility], true);
          expect(tolls[0].amount).toBe(10.17);
        }
      });

      it("should apply correct PANYNJ off-peak rate ($13.75)", () => {
        const panynjFacilities = [
          "george washington",
          "goethals",
          "bayonne",
          "outerbridge",
          "lincoln tunnel",
          "holland tunnel",
        ];
        for (const facility of panynjFacilities) {
          const tolls = detectNYCTLCTolls([facility], false);
          expect(tolls[0].amount).toBe(13.75);
        }
      });

      it("should apply correct PANYNJ peak rate ($16.75)", () => {
        const panynjFacilities = [
          "george washington",
          "goethals",
          "bayonne",
          "outerbridge",
          "lincoln tunnel",
          "holland tunnel",
        ];
        for (const facility of panynjFacilities) {
          const tolls = detectNYCTLCTolls([facility], true);
          expect(tolls[0].amount).toBe(16.75);
        }
      });
    });

    describe("Operator Attribution", () => {
      it("should correctly attribute MTA-operated facilities", () => {
        const mtaIds = [
          "verrazzano_bridge",
          "battery_tunnel",
          "queens_midtown_tunnel",
          "rfk_bridge",
          "whitestone_bridge",
          "throgs_neck_bridge",
        ];
        for (const id of mtaIds) {
          const facility = NYC_TLC_TOLL_FACILITIES.find(f => f.id === id);
          expect(facility?.operator).toBe("MTA");
        }
      });

      it("should correctly attribute PANYNJ-operated facilities", () => {
        const panynjIds = [
          "george_washington_bridge",
          "goethals_bridge",
          "bayonne_bridge",
          "outerbridge_crossing",
          "lincoln_tunnel",
          "holland_tunnel",
        ];
        for (const id of panynjIds) {
          const facility = NYC_TLC_TOLL_FACILITIES.find(f => f.id === id);
          expect(facility?.operator).toBe("PANYNJ");
        }
      });
    });

    describe("Peak vs Off-Peak Detection", () => {
      it("should correctly flag peak pricing when isPeakHour is true", () => {
        const tolls = detectNYCTLCTolls(["GW Bridge"], true);
        expect(tolls[0].isPeak).toBe(true);
      });

      it("should correctly flag off-peak pricing when isPeakHour is false", () => {
        const tolls = detectNYCTLCTolls(["GW Bridge"], false);
        expect(tolls[0].isPeak).toBe(false);
      });

      it("should calculate peak-to-off-peak difference correctly for MTA", () => {
        const offPeak = detectNYCTLCTolls(["verrazzano"], false);
        const peak = detectNYCTLCTolls(["verrazzano"], true);
        const difference = peak[0].amount - offPeak[0].amount;
        expect(difference).toBe(3.23); // 10.17 - 6.94
      });

      it("should calculate peak-to-off-peak difference correctly for PANYNJ", () => {
        const offPeak = detectNYCTLCTolls(["lincoln tunnel"], false);
        const peak = detectNYCTLCTolls(["lincoln tunnel"], true);
        const difference = peak[0].amount - offPeak[0].amount;
        expect(difference).toBe(3.00); // 16.75 - 13.75
      });
    });
  });

  describe("Toll Route Scenarios", () => {
    describe("Common NYC Trip Patterns", () => {
      it("JFK to Manhattan via Battery Tunnel (off-peak)", () => {
        const tolls = detectNYCTLCTolls(["Battery Tunnel"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(6.94);
      });

      it("JFK to Manhattan via Battery Tunnel (peak)", () => {
        const tolls = detectNYCTLCTolls(["Battery Tunnel"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(10.17);
      });

      it("Manhattan to Newark via Lincoln Tunnel (off-peak)", () => {
        const tolls = detectNYCTLCTolls(["Lincoln Tunnel"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(13.75);
      });

      it("Manhattan to Newark via Holland Tunnel (peak)", () => {
        const tolls = detectNYCTLCTolls(["Holland Tunnel"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(16.75);
      });

      it("Brooklyn to Staten Island via Verrazzano (off-peak)", () => {
        const tolls = detectNYCTLCTolls(["Verrazzano-Narrows Bridge"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(6.94);
      });

      it("Bronx to Queens via Whitestone Bridge (peak)", () => {
        const tolls = detectNYCTLCTolls(["Bronx-Whitestone Bridge"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(10.17);
      });

      it("Long Island to Manhattan via Midtown Tunnel (off-peak)", () => {
        const tolls = detectNYCTLCTolls(["Queens-Midtown Tunnel"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(6.94);
      });
    });

    describe("Cross-State Trip Patterns", () => {
      it("NYC to New Jersey via GW Bridge (off-peak)", () => {
        const tolls = detectNYCTLCTolls(["George Washington Bridge"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(13.75);
      });

      it("NYC to New Jersey via GW Bridge (peak)", () => {
        const tolls = detectNYCTLCTolls(["George Washington Bridge"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(16.75);
      });

      it("Staten Island to New Jersey via Goethals (off-peak)", () => {
        const tolls = detectNYCTLCTolls(["Goethals Bridge"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(13.75);
      });

      it("Staten Island to New Jersey via Bayonne (peak)", () => {
        const tolls = detectNYCTLCTolls(["Bayonne Bridge"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(16.75);
      });

      it("Staten Island to New Jersey via Outerbridge (off-peak)", () => {
        const tolls = detectNYCTLCTolls(["Outerbridge Crossing"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(13.75);
      });
    });

    describe("Multi-Borough Trip Patterns", () => {
      it("Bronx to Manhattan via RFK/Triborough (off-peak)", () => {
        const tolls = detectNYCTLCTolls(["Triborough Bridge"], false);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(6.94);
      });

      it("Queens to Bronx via Throgs Neck (peak)", () => {
        const tolls = detectNYCTLCTolls(["Throgs Neck Bridge"], true);
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(10.17);
      });
    });
  });

  describe("Toll Total Calculations", () => {
    it("should calculate total for single MTA toll (off-peak)", () => {
      const tolls = detectNYCTLCTolls(["Battery Tunnel"], false);
      const total = tolls.reduce((sum, t) => sum + t.amount, 0);
      expect(total).toBe(6.94);
    });

    it("should calculate total for single PANYNJ toll (peak)", () => {
      const tolls = detectNYCTLCTolls(["Holland Tunnel"], true);
      const total = tolls.reduce((sum, t) => sum + t.amount, 0);
      expect(total).toBe(16.75);
    });

    it("should calculate total for two MTA tolls (off-peak)", () => {
      const tolls = detectNYCTLCTolls([
        "RFK Bridge",
        "Battery Tunnel",
      ], false);
      const total = tolls.reduce((sum, t) => sum + t.amount, 0);
      expect(total).toBe(13.88); // 6.94 + 6.94
    });

    it("should calculate total for two PANYNJ tolls (peak)", () => {
      const tolls = detectNYCTLCTolls([
        "Lincoln Tunnel",
        "Holland Tunnel",
      ], true);
      const total = tolls.reduce((sum, t) => sum + t.amount, 0);
      expect(total).toBe(33.50); // 16.75 + 16.75
    });

    it("should calculate total for mixed operator tolls (off-peak)", () => {
      const tolls = detectNYCTLCTolls([
        "Battery Tunnel",
        "Lincoln Tunnel",
      ], false);
      const total = tolls.reduce((sum, t) => sum + t.amount, 0);
      expect(total).toBe(20.69); // 6.94 + 13.75
    });

    it("should calculate total for mixed operator tolls (peak)", () => {
      const tolls = detectNYCTLCTolls([
        "Battery Tunnel",
        "Lincoln Tunnel",
      ], true);
      const total = tolls.reduce((sum, t) => sum + t.amount, 0);
      expect(total).toBe(26.92); // 10.17 + 16.75
    });
  });

  describe("Regulatory Compliance", () => {
    it("should use EZ-Pass rates (not cash rates) for all facilities", () => {
      const allSegments = [
        "verrazzano",
        "battery tunnel",
        "midtown tunnel",
        "triborough",
        "whitestone",
        "throgs neck",
        "george washington",
        "goethals",
        "bayonne",
        "outerbridge",
        "lincoln tunnel",
        "holland tunnel",
      ];
      const tolls = detectNYCTLCTolls(allSegments, false);
      const mtaTolls = tolls.filter(t => t.facility.operator === "MTA");
      const panynjTolls = tolls.filter(t => t.facility.operator === "PANYNJ");
      
      mtaTolls.forEach(t => {
        expect(t.amount).toBe(6.94);
      });
      
      panynjTolls.forEach(t => {
        expect(t.amount).toBe(13.75);
      });
    });

    it("should have inboundOnly flag set for MTA bridges", () => {
      const mtaIds = [
        "verrazzano_bridge",
        "battery_tunnel",
        "queens_midtown_tunnel",
        "rfk_bridge",
        "whitestone_bridge",
        "throgs_neck_bridge",
      ];
      for (const id of mtaIds) {
        const facility = NYC_TLC_TOLL_FACILITIES.find(f => f.id === id);
        expect(facility?.inboundOnly).toBe(true);
      }
    });

    it("should have direction='both' for PANYNJ crossings", () => {
      const panynjIds = [
        "george_washington_bridge",
        "goethals_bridge",
        "bayonne_bridge",
        "outerbridge_crossing",
        "lincoln_tunnel",
        "holland_tunnel",
      ];
      for (const id of panynjIds) {
        const facility = NYC_TLC_TOLL_FACILITIES.find(f => f.id === id);
        expect(facility?.direction).toBe("both");
      }
    });

    it("should have all 12 NYC metro area toll facilities", () => {
      expect(NYC_TLC_TOLL_FACILITIES).toHaveLength(12);
    });

    it("should have valid facility structure for all entries", () => {
      for (const facility of NYC_TLC_TOLL_FACILITIES) {
        expect(facility.id).toBeTruthy();
        expect(facility.name).toBeTruthy();
        expect(facility.shortName).toBeTruthy();
        expect(facility.segmentIdentifiers.length).toBeGreaterThan(0);
        expect(facility.ezPassRate).toBeGreaterThan(0);
        expect(facility.operator).toMatch(/^(MTA|PANYNJ)$/);
      }
    });
  });
});
