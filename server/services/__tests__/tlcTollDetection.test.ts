import { describe, it, expect } from "@jest/globals";
import {
  detectNYCTLCTolls,
  determineTripDirection,
  NYC_TLC_TOLL_FACILITIES,
  type NYCTollFacility,
} from "../fareCalculationService";

describe("NYC TLC Toll Detection System", () => {
  describe("Direction Detection", () => {
    describe("Manhattan-bound (Inbound) Detection", () => {
      it("should detect Brooklyn to Manhattan as inbound", () => {
        const result = determineTripDirection("NY", "NY", "Brooklyn", "Manhattan");
        expect(result.isInbound).toBe(true);
        expect(result.actualDirection).toBe("inbound");
      });

      it("should detect Queens to Manhattan as inbound", () => {
        const result = determineTripDirection("NY", "NY", "Queens", "Manhattan");
        expect(result.isInbound).toBe(true);
        expect(result.actualDirection).toBe("inbound");
      });

      it("should detect Bronx to Manhattan as inbound", () => {
        const result = determineTripDirection("NY", "NY", "Bronx", "Manhattan");
        expect(result.isInbound).toBe(true);
        expect(result.actualDirection).toBe("inbound");
      });

      it("should detect Staten Island to Manhattan as inbound", () => {
        const result = determineTripDirection("NY", "NY", "Staten Island", "Manhattan");
        expect(result.isInbound).toBe(true);
        expect(result.actualDirection).toBe("inbound");
      });

      it("should detect Manhattan to Manhattan as inbound (bidirectional)", () => {
        const result = determineTripDirection("NY", "NY", "Manhattan", "Manhattan");
        expect(result.isInbound).toBe(true);
        expect(result.actualDirection).toBe("inbound");
      });

      it("should detect Manhattan to Brooklyn as outbound", () => {
        const result = determineTripDirection("NY", "NY", "Manhattan", "Brooklyn");
        expect(result.isInbound).toBe(false);
        expect(result.actualDirection).toBe("outbound");
      });

      it("should detect Manhattan to Queens as outbound", () => {
        const result = determineTripDirection("NY", "NY", "Manhattan", "Queens");
        expect(result.isInbound).toBe(false);
        expect(result.actualDirection).toBe("outbound");
      });
    });

    describe("NY-NJ Direction Detection (PANYNJ Crossings)", () => {
      it("should detect NJ to NY as eastbound (NY-bound)", () => {
        const result = determineTripDirection("NJ", "NY", undefined, undefined);
        expect(result.isNYBound).toBe(true);
        expect(result.actualDirection).toBe("eastbound");
      });

      it("should detect NY to NJ as westbound (NJ-bound)", () => {
        const result = determineTripDirection("NY", "NJ", undefined, undefined);
        expect(result.isNYBound).toBe(false);
        expect(result.actualDirection).toBe("westbound");
      });

      it("should handle Newark to Manhattan as eastbound", () => {
        const result = determineTripDirection("NJ", "NY", undefined, "Manhattan");
        expect(result.isNYBound).toBe(true);
        expect(result.actualDirection).toBe("eastbound");
      });

      it("should handle Manhattan to Newark as westbound", () => {
        const result = determineTripDirection("NY", "NJ", "Manhattan", undefined);
        expect(result.isNYBound).toBe(false);
        expect(result.actualDirection).toBe("westbound");
      });
    });

    describe("Edge Cases", () => {
      it("should return unknown for undefined locations", () => {
        const result = determineTripDirection(undefined, undefined, undefined, undefined);
        expect(result.actualDirection).toBe("unknown");
      });

      it("should handle 'New York' as Manhattan", () => {
        const result = determineTripDirection("NY", "NY", "Brooklyn", "New York");
        expect(result.isInbound).toBe(true);
      });

      it("should be case-insensitive", () => {
        const result = determineTripDirection("ny", "ny", "brooklyn", "manhattan");
        expect(result.isInbound).toBe(true);
      });
    });

    describe("Outer-Borough Trips (No Manhattan Destination)", () => {
      it("should detect Queens to Bronx as outbound (not Manhattan-bound)", () => {
        const result = determineTripDirection("NY", "NY", "Queens", "Bronx");
        expect(result.isInbound).toBe(false);
        expect(result.actualDirection).toBe("outbound");
      });

      it("should detect Bronx to Queens as outbound", () => {
        const result = determineTripDirection("NY", "NY", "Bronx", "Queens");
        expect(result.isInbound).toBe(false);
        expect(result.actualDirection).toBe("outbound");
      });

      it("should detect Staten Island to Brooklyn as outbound", () => {
        const result = determineTripDirection("NY", "NY", "Staten Island", "Brooklyn");
        expect(result.isInbound).toBe(false);
        expect(result.actualDirection).toBe("outbound");
      });

      it("should detect Brooklyn to Staten Island as outbound", () => {
        const result = determineTripDirection("NY", "NY", "Brooklyn", "Staten Island");
        expect(result.isInbound).toBe(false);
        expect(result.actualDirection).toBe("outbound");
      });

      it("should detect NJ to Brooklyn as eastbound but NOT inbound", () => {
        const result = determineTripDirection("NJ", "NY", undefined, "Brooklyn");
        expect(result.isNYBound).toBe(true);
        expect(result.actualDirection).toBe("eastbound");
        expect(result.isInbound).toBe(false);
      });

      it("should detect NJ to Queens as eastbound but NOT inbound", () => {
        const result = determineTripDirection("NJ", "NY", undefined, "Queens");
        expect(result.isNYBound).toBe(true);
        expect(result.actualDirection).toBe("eastbound");
        expect(result.isInbound).toBe(false);
      });

      it("should detect Brooklyn to Bronx as outbound", () => {
        const result = determineTripDirection("NY", "NY", "Brooklyn", "Bronx");
        expect(result.isInbound).toBe(false);
        expect(result.actualDirection).toBe("outbound");
      });
    });
  });

  describe("Toll Facility Detection", () => {
    describe("MTA Bridges (Inbound Only - Manhattan-bound)", () => {
      it("should detect Verrazzano Bridge only when Staten Island-bound (toll target)", () => {
        // Verrazzano toll is collected on Staten Island-bound traffic
        const statenIslandBound = detectNYCTLCTolls(
          ["Verrazzano-Narrows Bridge"],
          false,
          "NY", "NY", "Brooklyn", "Staten Island"
        );
        expect(statenIslandBound).toHaveLength(1);
        expect(statenIslandBound[0].facility.id).toBe("verrazzano_bridge");
        expect(statenIslandBound[0].direction).toBe("inbound");
        
        // No toll when leaving Staten Island (Brooklyn-bound)
        const brooklynBound = detectNYCTLCTolls(
          ["Verrazzano-Narrows Bridge"],
          false,
          "NY", "NY", "Staten Island", "Brooklyn"
        );
        expect(brooklynBound).toHaveLength(0);
        
        // No toll when going to Manhattan (wrong target)
        const manhattanBound = detectNYCTLCTolls(
          ["Verrazzano-Narrows Bridge"],
          false,
          "NY", "NY", "Staten Island", "Manhattan"
        );
        expect(manhattanBound).toHaveLength(0);
      });

      it("should detect Battery Tunnel only when inbound", () => {
        const inboundTolls = detectNYCTLCTolls(
          ["Battery Tunnel"],
          false,
          "NY", "NY", "Brooklyn", "Manhattan"
        );
        expect(inboundTolls).toHaveLength(1);
        expect(inboundTolls[0].facility.id).toBe("battery_tunnel");
        
        const outboundTolls = detectNYCTLCTolls(
          ["Battery Tunnel"],
          false,
          "NY", "NY", "Manhattan", "Brooklyn"
        );
        expect(outboundTolls).toHaveLength(0);
      });

      it("should detect Queens-Midtown Tunnel only when inbound", () => {
        const inboundTolls = detectNYCTLCTolls(
          ["Queens-Midtown Tunnel"],
          false,
          "NY", "NY", "Queens", "Manhattan"
        );
        expect(inboundTolls).toHaveLength(1);
        expect(inboundTolls[0].facility.id).toBe("queens_midtown_tunnel");
        
        const outboundTolls = detectNYCTLCTolls(
          ["Queens-Midtown Tunnel"],
          false,
          "NY", "NY", "Manhattan", "Queens"
        );
        expect(outboundTolls).toHaveLength(0);
      });

      it("should detect RFK/Triborough Bridge only when inbound", () => {
        const inboundTolls = detectNYCTLCTolls(
          ["Triborough Bridge"],
          false,
          "NY", "NY", "Queens", "Manhattan"
        );
        expect(inboundTolls).toHaveLength(1);
        expect(inboundTolls[0].facility.id).toBe("rfk_bridge");
        
        const outboundTolls = detectNYCTLCTolls(
          ["Triborough Bridge"],
          false,
          "NY", "NY", "Manhattan", "Bronx"
        );
        expect(outboundTolls).toHaveLength(0);
      });

      it("should detect Bronx-Whitestone Bridge only when inbound", () => {
        const inboundTolls = detectNYCTLCTolls(
          ["Whitestone Bridge"],
          false,
          "NY", "NY", "Queens", "Manhattan"
        );
        expect(inboundTolls).toHaveLength(1);
        expect(inboundTolls[0].facility.id).toBe("whitestone_bridge");
        
        const outboundTolls = detectNYCTLCTolls(
          ["Whitestone Bridge"],
          false,
          "NY", "NY", "Manhattan", "Queens"
        );
        expect(outboundTolls).toHaveLength(0);
      });

      it("should detect Throgs Neck Bridge only when inbound", () => {
        const inboundTolls = detectNYCTLCTolls(
          ["Throgs Neck Bridge"],
          false,
          "NY", "NY", "Queens", "Manhattan"
        );
        expect(inboundTolls).toHaveLength(1);
        expect(inboundTolls[0].facility.id).toBe("throgs_neck_bridge");
        
        const outboundTolls = detectNYCTLCTolls(
          ["Throgs Neck Bridge"],
          false,
          "NY", "NY", "Manhattan", "Queens"
        );
        expect(outboundTolls).toHaveLength(0);
      });
    });

    describe("PANYNJ Crossings (Bidirectional)", () => {
      it("should detect GW Bridge in both directions", () => {
        const eastbound = detectNYCTLCTolls(
          ["George Washington Bridge"],
          false,
          "NJ", "NY", undefined, "Manhattan"
        );
        expect(eastbound).toHaveLength(1);
        expect(eastbound[0].facility.id).toBe("george_washington_bridge");
        expect(eastbound[0].direction).toBe("eastbound");
        
        const westbound = detectNYCTLCTolls(
          ["George Washington Bridge"],
          false,
          "NY", "NJ", "Manhattan", undefined
        );
        expect(westbound).toHaveLength(1);
        expect(westbound[0].direction).toBe("westbound");
      });

      it("should detect Lincoln Tunnel in both directions", () => {
        const eastbound = detectNYCTLCTolls(
          ["Lincoln Tunnel"],
          false,
          "NJ", "NY", undefined, "Manhattan"
        );
        expect(eastbound).toHaveLength(1);
        expect(eastbound[0].facility.id).toBe("lincoln_tunnel");
        
        const westbound = detectNYCTLCTolls(
          ["Lincoln Tunnel"],
          false,
          "NY", "NJ", "Manhattan", undefined
        );
        expect(westbound).toHaveLength(1);
      });

      it("should detect Holland Tunnel in both directions", () => {
        const eastbound = detectNYCTLCTolls(
          ["Holland Tunnel"],
          false,
          "NJ", "NY", undefined, "Manhattan"
        );
        expect(eastbound).toHaveLength(1);
        expect(eastbound[0].facility.id).toBe("holland_tunnel");
        
        const westbound = detectNYCTLCTolls(
          ["Holland Tunnel"],
          false,
          "NY", "NJ", "Manhattan", undefined
        );
        expect(westbound).toHaveLength(1);
      });

      it("should detect Goethals Bridge in both directions", () => {
        const eastbound = detectNYCTLCTolls(
          ["Goethals Bridge"],
          false,
          "NJ", "NY", undefined, "Staten Island"
        );
        expect(eastbound).toHaveLength(1);
        expect(eastbound[0].facility.id).toBe("goethals_bridge");
        
        const westbound = detectNYCTLCTolls(
          ["Goethals Bridge"],
          false,
          "NY", "NJ", "Staten Island", undefined
        );
        expect(westbound).toHaveLength(1);
      });

      it("should detect Bayonne Bridge in both directions", () => {
        const eastbound = detectNYCTLCTolls(
          ["Bayonne Bridge"],
          false,
          "NJ", "NY", undefined, "Staten Island"
        );
        expect(eastbound).toHaveLength(1);
        expect(eastbound[0].facility.id).toBe("bayonne_bridge");
        
        const westbound = detectNYCTLCTolls(
          ["Bayonne Bridge"],
          false,
          "NY", "NJ", "Staten Island", undefined
        );
        expect(westbound).toHaveLength(1);
      });

      it("should detect Outerbridge Crossing in both directions", () => {
        const eastbound = detectNYCTLCTolls(
          ["Outerbridge Crossing"],
          false,
          "NJ", "NY", undefined, "Staten Island"
        );
        expect(eastbound).toHaveLength(1);
        expect(eastbound[0].facility.id).toBe("outerbridge_crossing");
        
        const westbound = detectNYCTLCTolls(
          ["Outerbridge Crossing"],
          false,
          "NY", "NJ", "Staten Island", undefined
        );
        expect(westbound).toHaveLength(1);
      });
    });

    describe("Rate Accuracy", () => {
      it("should apply MTA off-peak rate ($6.94)", () => {
        const tolls = detectNYCTLCTolls(
          ["Battery Tunnel"],
          false,
          "NY", "NY", "Brooklyn", "Manhattan"
        );
        expect(tolls[0].amount).toBe(6.94);
        expect(tolls[0].isPeak).toBe(false);
      });

      it("should apply MTA peak rate ($10.17)", () => {
        const tolls = detectNYCTLCTolls(
          ["Battery Tunnel"],
          true,
          "NY", "NY", "Brooklyn", "Manhattan"
        );
        expect(tolls[0].amount).toBe(10.17);
        expect(tolls[0].isPeak).toBe(true);
      });

      it("should apply PANYNJ off-peak rate ($13.75)", () => {
        const tolls = detectNYCTLCTolls(
          ["Lincoln Tunnel"],
          false,
          "NJ", "NY", undefined, "Manhattan"
        );
        expect(tolls[0].amount).toBe(13.75);
        expect(tolls[0].isPeak).toBe(false);
      });

      it("should apply PANYNJ peak rate ($16.75)", () => {
        const tolls = detectNYCTLCTolls(
          ["Lincoln Tunnel"],
          true,
          "NJ", "NY", undefined, "Manhattan"
        );
        expect(tolls[0].amount).toBe(16.75);
        expect(tolls[0].isPeak).toBe(true);
      });
    });

    describe("Multi-Toll Route Detection", () => {
      it("should detect multiple tolls on a route", () => {
        const tolls = detectNYCTLCTolls(
          ["George Washington Bridge", "Lincoln Tunnel"],
          false,
          "NJ", "NY", undefined, "Manhattan"
        );
        expect(tolls).toHaveLength(2);
        const ids = tolls.map(t => t.facility.id);
        expect(ids).toContain("george_washington_bridge");
        expect(ids).toContain("lincoln_tunnel");
      });

      it("should not duplicate tolls", () => {
        const tolls = detectNYCTLCTolls(
          ["Lincoln Tunnel", "Lincoln Tunnel", "lincoln tunnel"],
          false,
          "NJ", "NY", undefined, "Manhattan"
        );
        expect(tolls).toHaveLength(1);
      });

      it("should calculate correct total for multi-toll route", () => {
        const tolls = detectNYCTLCTolls(
          ["George Washington Bridge", "Battery Tunnel"],
          false,
          "NJ", "NY", undefined, "Manhattan"
        );
        const total = tolls.reduce((sum, t) => sum + t.amount, 0);
        expect(total).toBe(13.75); // Only GW Bridge because Battery Tunnel is inbound-only and trip is from NJ
      });
    });

    describe("Edge Cases", () => {
      it("should return empty for no segments", () => {
        const tolls = detectNYCTLCTolls(
          [],
          false,
          "NY", "NY", "Brooklyn", "Manhattan"
        );
        expect(tolls).toHaveLength(0);
      });

      it("should return empty for non-matching segments", () => {
        const tolls = detectNYCTLCTolls(
          ["I-95 North", "Belt Parkway"],
          false,
          "NY", "NY", "Brooklyn", "Manhattan"
        );
        expect(tolls).toHaveLength(0);
      });

      it("should handle case-insensitive matching", () => {
        const tolls = detectNYCTLCTolls(
          ["GEORGE WASHINGTON BRIDGE"],
          false,
          "NJ", "NY", undefined, "Manhattan"
        );
        expect(tolls).toHaveLength(1);
      });

      it("should handle whitespace variations", () => {
        const tolls = detectNYCTLCTolls(
          ["  lincoln tunnel  "],
          false,
          "NJ", "NY", undefined, "Manhattan"
        );
        expect(tolls).toHaveLength(1);
      });

      it("should match partial identifiers", () => {
        const tolls = detectNYCTLCTolls(
          ["Take the triboro to Manhattan"],
          false,
          "NY", "NY", "Queens", "Manhattan"
        );
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("rfk_bridge");
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
          expect(facility?.inboundOnly).toBe(true);
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
          expect(facility?.direction).toBe("both");
        }
      });
    });
  });

  describe("Toll Route Scenarios", () => {
    describe("Outer-Borough Trips via Toll Facilities (NO MTA toll should apply)", () => {
      it("Queens to Bronx via RFK/Triborough Bridge should NOT trigger toll", () => {
        const tolls = detectNYCTLCTolls(
          ["Triborough Bridge"],
          false,
          "NY", "NY", "Queens", "Bronx"
        );
        expect(tolls).toHaveLength(0);
      });

      it("Bronx to Queens via RFK/Triborough Bridge should NOT trigger toll", () => {
        const tolls = detectNYCTLCTolls(
          ["Triborough Bridge"],
          false,
          "NY", "NY", "Bronx", "Queens"
        );
        expect(tolls).toHaveLength(0);
      });

      it("Staten Island to Brooklyn via Verrazzano should NOT trigger toll", () => {
        // Verrazzano toll is collected on Staten Island-bound, not Brooklyn-bound
        const tolls = detectNYCTLCTolls(
          ["Verrazzano-Narrows Bridge"],
          false,
          "NY", "NY", "Staten Island", "Brooklyn"
        );
        expect(tolls).toHaveLength(0);
      });

      it("Brooklyn to Staten Island via Verrazzano SHOULD trigger toll", () => {
        // Verrazzano toll IS collected on Staten Island-bound traffic
        const tolls = detectNYCTLCTolls(
          ["Verrazzano-Narrows Bridge"],
          false,
          "NY", "NY", "Brooklyn", "Staten Island"
        );
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(6.94);
      });

      it("Queens to Queens via Whitestone should NOT trigger toll", () => {
        const tolls = detectNYCTLCTolls(
          ["Whitestone Bridge"],
          false,
          "NY", "NY", "Queens", "Queens"
        );
        expect(tolls).toHaveLength(0);
      });

      it("NJ to Brooklyn via GW Bridge should trigger PANYNJ toll (bidirectional)", () => {
        const tolls = detectNYCTLCTolls(
          ["George Washington Bridge"],
          false,
          "NJ", "NY", undefined, "Brooklyn"
        );
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("george_washington_bridge");
        expect(tolls[0].amount).toBe(13.75);
        expect(tolls[0].direction).toBe("eastbound");
      });

      it("NJ to Queens via Lincoln Tunnel should trigger PANYNJ toll (bidirectional)", () => {
        const tolls = detectNYCTLCTolls(
          ["Lincoln Tunnel"],
          false,
          "NJ", "NY", undefined, "Queens"
        );
        expect(tolls).toHaveLength(1);
        expect(tolls[0].facility.id).toBe("lincoln_tunnel");
        expect(tolls[0].amount).toBe(13.75);
      });
    });

    describe("Common NYC Trip Patterns", () => {
      it("JFK (Queens) to Manhattan via Battery Tunnel (inbound, toll applies)", () => {
        const tolls = detectNYCTLCTolls(
          ["Battery Tunnel"],
          false,
          "NY", "NY", "Queens", "Manhattan"
        );
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(6.94);
      });

      it("Manhattan to JFK (Queens) via Battery Tunnel (outbound, no toll)", () => {
        const tolls = detectNYCTLCTolls(
          ["Battery Tunnel"],
          false,
          "NY", "NY", "Manhattan", "Queens"
        );
        expect(tolls).toHaveLength(0);
      });

      it("Newark (NJ) to Manhattan via Lincoln Tunnel (eastbound, toll applies)", () => {
        const tolls = detectNYCTLCTolls(
          ["Lincoln Tunnel"],
          false,
          "NJ", "NY", undefined, "Manhattan"
        );
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(13.75);
        expect(tolls[0].direction).toBe("eastbound");
      });

      it("Manhattan to Newark (NJ) via Lincoln Tunnel (westbound, toll applies)", () => {
        const tolls = detectNYCTLCTolls(
          ["Lincoln Tunnel"],
          false,
          "NY", "NJ", "Manhattan", undefined
        );
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(13.75);
        expect(tolls[0].direction).toBe("westbound");
      });

      it("Brooklyn to Staten Island via Verrazzano (outbound, no toll)", () => {
        const tolls = detectNYCTLCTolls(
          ["Verrazzano-Narrows Bridge"],
          false,
          "NY", "NY", "Brooklyn", "Staten Island"
        );
        expect(tolls).toHaveLength(0);
      });

      it("Staten Island to Brooklyn via Verrazzano (inbound-ish via Brooklyn)", () => {
        const tolls = detectNYCTLCTolls(
          ["Verrazzano-Narrows Bridge"],
          false,
          "NY", "NY", "Staten Island", "Brooklyn"
        );
        expect(tolls).toHaveLength(0);
      });

      it("Staten Island to Manhattan via Verrazzano (Manhattan-bound, no Verrazzano toll)", () => {
        // Verrazzano only charges Staten Island-bound, not Manhattan-bound
        const tolls = detectNYCTLCTolls(
          ["Verrazzano-Narrows Bridge"],
          false,
          "NY", "NY", "Staten Island", "Manhattan"
        );
        expect(tolls).toHaveLength(0);
      });
      
      it("Brooklyn to Staten Island via Verrazzano (Staten Island-bound, toll applies)", () => {
        // Verrazzano toll collected on Staten Island-bound traffic
        const tolls = detectNYCTLCTolls(
          ["Verrazzano-Narrows Bridge"],
          false,
          "NY", "NY", "Brooklyn", "Staten Island"
        );
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(6.94);
      });
    });

    describe("Cross-State Patterns", () => {
      it("NJ to Manhattan via GW Bridge (peak)", () => {
        const tolls = detectNYCTLCTolls(
          ["George Washington Bridge"],
          true,
          "NJ", "NY", undefined, "Manhattan"
        );
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(16.75);
        expect(tolls[0].direction).toBe("eastbound");
      });

      it("Manhattan to NJ via Holland Tunnel (off-peak)", () => {
        const tolls = detectNYCTLCTolls(
          ["Holland Tunnel"],
          false,
          "NY", "NJ", "Manhattan", undefined
        );
        expect(tolls).toHaveLength(1);
        expect(tolls[0].amount).toBe(13.75);
        expect(tolls[0].direction).toBe("westbound");
      });

      it("Staten Island to NJ via Goethals (westbound)", () => {
        const tolls = detectNYCTLCTolls(
          ["Goethals Bridge"],
          false,
          "NY", "NJ", "Staten Island", undefined
        );
        expect(tolls).toHaveLength(1);
        expect(tolls[0].direction).toBe("westbound");
      });

      it("NJ to Staten Island via Bayonne (eastbound)", () => {
        const tolls = detectNYCTLCTolls(
          ["Bayonne Bridge"],
          false,
          "NJ", "NY", undefined, "Staten Island"
        );
        expect(tolls).toHaveLength(1);
        expect(tolls[0].direction).toBe("eastbound");
      });
    });
  });

  describe("Regulatory Compliance", () => {
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

    it("should use EZ-Pass rates (not cash rates)", () => {
      const mtaFacility = NYC_TLC_TOLL_FACILITIES.find(f => f.operator === "MTA");
      expect(mtaFacility?.ezPassRate).toBe(6.94);
      expect(mtaFacility?.ezPassRatePeak).toBe(10.17);
      
      const panynjFacility = NYC_TLC_TOLL_FACILITIES.find(f => f.operator === "PANYNJ");
      expect(panynjFacility?.ezPassRate).toBe(13.75);
      expect(panynjFacility?.ezPassRatePeak).toBe(16.75);
    });

    it("should mark MTA facilities as inbound-only", () => {
      const mtaFacilities = NYC_TLC_TOLL_FACILITIES.filter(f => f.operator === "MTA");
      expect(mtaFacilities.length).toBe(6);
      mtaFacilities.forEach(f => {
        expect(f.inboundOnly).toBe(true);
      });
    });

    it("should mark PANYNJ facilities as bidirectional", () => {
      const panynjFacilities = NYC_TLC_TOLL_FACILITIES.filter(f => f.operator === "PANYNJ");
      expect(panynjFacilities.length).toBe(6);
      panynjFacilities.forEach(f => {
        expect(f.direction).toBe("both");
      });
    });
  });
});
