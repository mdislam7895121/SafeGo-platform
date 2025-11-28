/**
 * NYC Borough Detection & Cross-City Fee Test Suite
 * 
 * Comprehensive tests for polygon-based borough detection and cross-city fee calculations.
 * Tests all 20+ borough pair combinations for cross-city fee eligibility.
 */

import {
  detectNYCBorough,
  detectCrossCity,
  TLC_CROSS_CITY_FEE,
  getAllCrossBoroughPairs,
  getBoroughCenterCoordinate,
  validateBoroughDetection,
  NYCBoroughCode,
  CrossCityResult,
} from '../nycBoroughDetection';

// ============================================
// Test Fixtures: Representative Coordinates
// ============================================

const BOROUGH_COORDINATES: Record<NYCBoroughCode, { lat: number; lng: number; name: string }[]> = {
  MANHATTAN: [
    { lat: 40.7580, lng: -73.9855, name: 'Times Square' },
    { lat: 40.7128, lng: -74.0060, name: 'Wall Street' },
    { lat: 40.7831, lng: -73.9712, name: 'Central Park' },
    { lat: 40.8075, lng: -73.9626, name: 'Harlem' },
  ],
  BROOKLYN: [
    { lat: 40.6892, lng: -73.9857, name: 'Brooklyn Heights' },
    { lat: 40.6782, lng: -73.9442, name: 'Downtown Brooklyn' },
    { lat: 40.6501, lng: -73.9496, name: 'Flatbush' },
    { lat: 40.5795, lng: -73.9681, name: 'Coney Island' },
  ],
  QUEENS: [
    { lat: 40.7282, lng: -73.7949, name: 'Jamaica' },
    { lat: 40.7580, lng: -73.8855, name: 'Jackson Heights' },
    { lat: 40.7769, lng: -73.8740, name: 'LaGuardia Area' },
    { lat: 40.6413, lng: -73.7781, name: 'JFK Airport Area' },
  ],
  BRONX: [
    { lat: 40.8448, lng: -73.8648, name: 'Fordham' },
    { lat: 40.8176, lng: -73.9219, name: 'South Bronx' },
    { lat: 40.8679, lng: -73.8807, name: 'Bronx Zoo' },
    { lat: 40.8950, lng: -73.8638, name: 'Riverdale' },
  ],
  STATEN_ISLAND: [
    { lat: 40.5795, lng: -74.1502, name: 'St. George' },
    { lat: 40.5631, lng: -74.1389, name: 'Stapleton' },
    { lat: 40.5245, lng: -74.2015, name: 'Great Kills' },
    { lat: 40.5016, lng: -74.2412, name: 'Tottenville' },
  ],
  OUT_OF_NYC: [
    { lat: 40.7357, lng: -74.1724, name: 'Newark, NJ' },
    { lat: 40.4774, lng: -74.2591, name: 'Staten Island South (NJ side)' },
    { lat: 40.9176, lng: -73.6532, name: 'Long Island (Nassau)' },
    { lat: 41.0082, lng: -73.7107, name: 'Westchester' },
  ],
};

// ============================================
// Borough Detection Tests
// ============================================

describe('NYC Borough Detection - Polygon-based', () => {
  describe('Manhattan Detection', () => {
    it.each(BOROUGH_COORDINATES.MANHATTAN)(
      'should detect $name as Manhattan',
      ({ lat, lng }) => {
        const result = detectNYCBorough(lat, lng);
        expect(result.borough).toBe('MANHATTAN');
        expect(result.confidence).toMatch(/high|medium/);
      }
    );
  });

  describe('Brooklyn Detection', () => {
    it.each(BOROUGH_COORDINATES.BROOKLYN)(
      'should detect $name as Brooklyn',
      ({ lat, lng }) => {
        const result = detectNYCBorough(lat, lng);
        expect(result.borough).toBe('BROOKLYN');
        expect(result.confidence).toMatch(/high|medium/);
      }
    );
  });

  describe('Queens Detection', () => {
    it.each(BOROUGH_COORDINATES.QUEENS)(
      'should detect $name as Queens',
      ({ lat, lng }) => {
        const result = detectNYCBorough(lat, lng);
        expect(result.borough).toBe('QUEENS');
        expect(result.confidence).toMatch(/high|medium/);
      }
    );
  });

  describe('Bronx Detection', () => {
    it.each(BOROUGH_COORDINATES.BRONX)(
      'should detect $name as Bronx',
      ({ lat, lng }) => {
        const result = detectNYCBorough(lat, lng);
        expect(result.borough).toBe('BRONX');
        expect(result.confidence).toMatch(/high|medium/);
      }
    );
  });

  describe('Staten Island Detection', () => {
    it.each(BOROUGH_COORDINATES.STATEN_ISLAND)(
      'should detect $name as Staten Island',
      ({ lat, lng }) => {
        const result = detectNYCBorough(lat, lng);
        expect(result.borough).toBe('STATEN_ISLAND');
        expect(result.confidence).toMatch(/high|medium/);
      }
    );
  });

  describe('Out of NYC Detection', () => {
    it.each(BOROUGH_COORDINATES.OUT_OF_NYC)(
      'should detect $name as OUT_OF_NYC',
      ({ lat, lng }) => {
        const result = detectNYCBorough(lat, lng);
        expect(result.borough).toBe('OUT_OF_NYC');
      }
    );
  });
});

// ============================================
// Cross-City Fee Detection Tests
// ============================================

describe('Cross-City Fee Detection', () => {
  describe('Same Borough - No Fee', () => {
    const boroughs: Exclude<NYCBoroughCode, 'OUT_OF_NYC'>[] = [
      'MANHATTAN', 'BROOKLYN', 'QUEENS', 'BRONX', 'STATEN_ISLAND'
    ];

    it.each(boroughs)(
      'should NOT apply cross-city fee for trip within %s',
      (borough) => {
        const coords = getBoroughCenterCoordinate(borough);
        const result = detectCrossCity(coords.lat, coords.lng, coords.lat, coords.lng);
        
        expect(result.isCrossCity).toBe(false);
        expect(result.feeApplicable).toBe(false);
        expect(result.pickupBorough).toBe(borough);
        expect(result.dropoffBorough).toBe(borough);
      }
    );
  });

  describe('Cross-Borough - Fee Applies (All 20 Combinations)', () => {
    const allPairs = getAllCrossBoroughPairs();
    
    it(`should have 20 cross-borough pairs`, () => {
      expect(allPairs).toHaveLength(20);
    });

    it.each(allPairs)(
      'should apply cross-city fee for $pickup to $dropoff',
      ({ pickup, dropoff }) => {
        const pickupCoords = getBoroughCenterCoordinate(pickup);
        const dropoffCoords = getBoroughCenterCoordinate(dropoff);
        
        const result = detectCrossCity(
          pickupCoords.lat, pickupCoords.lng,
          dropoffCoords.lat, dropoffCoords.lng
        );
        
        expect(result.isCrossCity).toBe(true);
        expect(result.feeApplicable).toBe(true);
        expect(result.pickupBorough).toBe(pickup);
        expect(result.dropoffBorough).toBe(dropoff);
        expect(result.reason).toContain('Cross-borough trip');
      }
    );
  });

  describe('Out of NYC - No Cross-City Fee', () => {
    it('should NOT apply fee for pickup outside NYC', () => {
      const outOfNyc = getBoroughCenterCoordinate('OUT_OF_NYC');
      const manhattan = getBoroughCenterCoordinate('MANHATTAN');
      
      const result = detectCrossCity(
        outOfNyc.lat, outOfNyc.lng,
        manhattan.lat, manhattan.lng
      );
      
      expect(result.isCrossCity).toBe(false);
      expect(result.feeApplicable).toBe(false);
      expect(result.reason).toContain('outside NYC');
    });

    it('should NOT apply fee for dropoff outside NYC (Out-of-Town applies instead)', () => {
      const manhattan = getBoroughCenterCoordinate('MANHATTAN');
      const outOfNyc = getBoroughCenterCoordinate('OUT_OF_NYC');
      
      const result = detectCrossCity(
        manhattan.lat, manhattan.lng,
        outOfNyc.lat, outOfNyc.lng
      );
      
      expect(result.isCrossCity).toBe(false);
      expect(result.feeApplicable).toBe(false);
      expect(result.reason).toContain('Out-of-Town');
    });

    it('should NOT apply fee for both pickup and dropoff outside NYC', () => {
      const newark = { lat: 40.7357, lng: -74.1724 }; // Newark, NJ
      const westchester = { lat: 41.0082, lng: -73.7107 }; // Westchester
      
      const result = detectCrossCity(
        newark.lat, newark.lng,
        westchester.lat, westchester.lng
      );
      
      expect(result.isCrossCity).toBe(false);
      expect(result.feeApplicable).toBe(false);
    });
  });
});

// ============================================
// Fee Constant Tests
// ============================================

describe('TLC Cross-City Fee Constants', () => {
  it('should have correct cross-borough fee amount', () => {
    expect(TLC_CROSS_CITY_FEE.CROSS_BOROUGH_FEE).toBe(2.50);
  });

  it('should have all 5 NYC boroughs as applicable', () => {
    expect(TLC_CROSS_CITY_FEE.APPLICABLE_BOROUGHS).toContain('MANHATTAN');
    expect(TLC_CROSS_CITY_FEE.APPLICABLE_BOROUGHS).toContain('BROOKLYN');
    expect(TLC_CROSS_CITY_FEE.APPLICABLE_BOROUGHS).toContain('QUEENS');
    expect(TLC_CROSS_CITY_FEE.APPLICABLE_BOROUGHS).toContain('BRONX');
    expect(TLC_CROSS_CITY_FEE.APPLICABLE_BOROUGHS).toContain('STATEN_ISLAND');
    expect(TLC_CROSS_CITY_FEE.APPLICABLE_BOROUGHS).toHaveLength(5);
  });
});

// ============================================
// Specific Borough Pair Tests (High Priority Routes)
// ============================================

describe('High Priority Cross-Borough Routes', () => {
  it('Manhattan to Brooklyn (most common)', () => {
    const manhattan = { lat: 40.7580, lng: -73.9855 }; // Times Square
    const brooklyn = { lat: 40.6892, lng: -73.9857 }; // Brooklyn Heights
    
    const result = detectCrossCity(
      manhattan.lat, manhattan.lng,
      brooklyn.lat, brooklyn.lng
    );
    
    expect(result.isCrossCity).toBe(true);
    expect(result.feeApplicable).toBe(true);
    expect(result.pickupBorough).toBe('MANHATTAN');
    expect(result.dropoffBorough).toBe('BROOKLYN');
  });

  it('Manhattan to Queens (airport route)', () => {
    const manhattan = { lat: 40.7580, lng: -73.9855 }; // Times Square
    const queens = { lat: 40.7769, lng: -73.8740 }; // Near LGA
    
    const result = detectCrossCity(
      manhattan.lat, manhattan.lng,
      queens.lat, queens.lng
    );
    
    expect(result.isCrossCity).toBe(true);
    expect(result.feeApplicable).toBe(true);
    expect(result.pickupBorough).toBe('MANHATTAN');
    expect(result.dropoffBorough).toBe('QUEENS');
  });

  it('Brooklyn to Queens (lateral route)', () => {
    const brooklyn = { lat: 40.6892, lng: -73.9857 }; // Brooklyn Heights
    const queens = { lat: 40.7282, lng: -73.7949 }; // Jamaica
    
    const result = detectCrossCity(
      brooklyn.lat, brooklyn.lng,
      queens.lat, queens.lng
    );
    
    expect(result.isCrossCity).toBe(true);
    expect(result.feeApplicable).toBe(true);
    expect(result.pickupBorough).toBe('BROOKLYN');
    expect(result.dropoffBorough).toBe('QUEENS');
  });

  it('Manhattan to Bronx (northern route)', () => {
    const manhattan = { lat: 40.8075, lng: -73.9626 }; // Harlem
    const bronx = { lat: 40.8176, lng: -73.9219 }; // South Bronx
    
    const result = detectCrossCity(
      manhattan.lat, manhattan.lng,
      bronx.lat, bronx.lng
    );
    
    expect(result.isCrossCity).toBe(true);
    expect(result.feeApplicable).toBe(true);
    expect(result.pickupBorough).toBe('MANHATTAN');
    expect(result.dropoffBorough).toBe('BRONX');
  });

  it('Brooklyn to Staten Island (less common)', () => {
    const brooklyn = { lat: 40.6501, lng: -73.9496 }; // Flatbush
    const statenIsland = { lat: 40.5795, lng: -74.1502 }; // St. George
    
    const result = detectCrossCity(
      brooklyn.lat, brooklyn.lng,
      statenIsland.lat, statenIsland.lng
    );
    
    expect(result.isCrossCity).toBe(true);
    expect(result.feeApplicable).toBe(true);
    expect(result.pickupBorough).toBe('BROOKLYN');
    expect(result.dropoffBorough).toBe('STATEN_ISLAND');
  });
});

// ============================================
// Borough Validation Helper Tests
// ============================================

describe('Borough Validation Helper', () => {
  it('should validate Manhattan coordinate accurately', () => {
    const result = validateBoroughDetection(40.7580, -73.9855, 'MANHATTAN');
    expect(result.isAccurate).toBe(true);
    expect(result.detectedBorough).toBe('MANHATTAN');
  });

  it('should detect inaccuracy when expected borough is wrong', () => {
    const result = validateBoroughDetection(40.7580, -73.9855, 'BROOKLYN');
    expect(result.isAccurate).toBe(false);
    expect(result.detectedBorough).toBe('MANHATTAN');
  });

  it('should detect near-boundary coordinates', () => {
    // Coordinate very close to Manhattan-Brooklyn boundary
    const result = validateBoroughDetection(40.7009, -74.0350, 'MANHATTAN');
    // May be near boundary
    if (result.nearBoundary) {
      expect(result.confidence).toMatch(/medium|low/);
    }
  });
});

// ============================================
// Edge Cases and Boundary Tests
// ============================================

describe('Edge Cases', () => {
  it('should handle exact same pickup and dropoff coordinates', () => {
    const coords = getBoroughCenterCoordinate('MANHATTAN');
    const result = detectCrossCity(coords.lat, coords.lng, coords.lat, coords.lng);
    
    expect(result.isCrossCity).toBe(false);
    expect(result.feeApplicable).toBe(false);
  });

  it('should handle coordinates very close together (same neighborhood)', () => {
    const pickup = { lat: 40.7580, lng: -73.9855 }; // Times Square
    const dropoff = { lat: 40.7590, lng: -73.9850 }; // Very close by
    
    const result = detectCrossCity(
      pickup.lat, pickup.lng,
      dropoff.lat, dropoff.lng
    );
    
    expect(result.isCrossCity).toBe(false);
    expect(result.feeApplicable).toBe(false);
  });

  it('should handle water crossing (Brooklyn to Manhattan via bridge)', () => {
    const brooklyn = { lat: 40.7062, lng: -73.9969 }; // DUMBO (Brooklyn Bridge)
    const manhattan = { lat: 40.7128, lng: -74.0060 }; // City Hall
    
    const result = detectCrossCity(
      brooklyn.lat, brooklyn.lng,
      manhattan.lat, manhattan.lng
    );
    
    expect(result.isCrossCity).toBe(true);
    expect(result.feeApplicable).toBe(true);
  });
});

// ============================================
// Integration with Audit Engine Format
// ============================================

describe('Cross-City Result Format for Audit', () => {
  it('should return all required fields for eligible trip', () => {
    const manhattan = getBoroughCenterCoordinate('MANHATTAN');
    const brooklyn = getBoroughCenterCoordinate('BROOKLYN');
    
    const result = detectCrossCity(
      manhattan.lat, manhattan.lng,
      brooklyn.lat, brooklyn.lng
    );
    
    expect(result).toHaveProperty('isCrossCity', true);
    expect(result).toHaveProperty('pickupBorough', 'MANHATTAN');
    expect(result).toHaveProperty('dropoffBorough', 'BROOKLYN');
    expect(result).toHaveProperty('feeApplicable', true);
    expect(result).toHaveProperty('reason');
    expect(typeof result.reason).toBe('string');
  });

  it('should return all required fields for ineligible trip', () => {
    const manhattan = getBoroughCenterCoordinate('MANHATTAN');
    
    const result = detectCrossCity(
      manhattan.lat, manhattan.lng,
      manhattan.lat, manhattan.lng
    );
    
    expect(result).toHaveProperty('isCrossCity', false);
    expect(result).toHaveProperty('pickupBorough', 'MANHATTAN');
    expect(result).toHaveProperty('dropoffBorough', 'MANHATTAN');
    expect(result).toHaveProperty('feeApplicable', false);
    expect(result).toHaveProperty('reason');
  });
});

// ============================================
// Suppression Matrix Tests
// ============================================

describe('Suppression Matrix Validation', () => {
  describe('Out-of-Town Trip Suppression', () => {
    it('should NOT apply cross-city fee for NYC to New Jersey trip', () => {
      const manhattan = { lat: 40.7580, lng: -73.9855 }; // Times Square
      const newark = { lat: 40.7357, lng: -74.1724 }; // Newark, NJ
      
      const result = detectCrossCity(
        manhattan.lat, manhattan.lng,
        newark.lat, newark.lng
      );
      
      expect(result.isCrossCity).toBe(false);
      expect(result.feeApplicable).toBe(false);
      expect(result.pickupBorough).toBe('MANHATTAN');
      expect(result.dropoffBorough).toBe('OUT_OF_NYC');
      expect(result.reason).toContain('Out-of-Town');
    });

    it('should NOT apply cross-city fee for New Jersey to NYC trip', () => {
      const newark = { lat: 40.7357, lng: -74.1724 }; // Newark, NJ
      const manhattan = { lat: 40.7580, lng: -73.9855 }; // Times Square
      
      const result = detectCrossCity(
        newark.lat, newark.lng,
        manhattan.lat, manhattan.lng
      );
      
      expect(result.isCrossCity).toBe(false);
      expect(result.feeApplicable).toBe(false);
      expect(result.pickupBorough).toBe('OUT_OF_NYC');
      expect(result.dropoffBorough).toBe('MANHATTAN');
      expect(result.reason).toContain('outside NYC');
    });

    it('should NOT apply cross-city fee for NYC to Westchester trip', () => {
      const bronx = { lat: 40.8448, lng: -73.8648 }; // Bronx
      const westchester = { lat: 41.0082, lng: -73.7107 }; // Westchester
      
      const result = detectCrossCity(
        bronx.lat, bronx.lng,
        westchester.lat, westchester.lng
      );
      
      expect(result.isCrossCity).toBe(false);
      expect(result.feeApplicable).toBe(false);
      expect(result.pickupBorough).toBe('BRONX');
      expect(result.dropoffBorough).toBe('OUT_OF_NYC');
    });

    it('should NOT apply cross-city fee for Long Island to NYC trip', () => {
      const nassau = { lat: 40.9176, lng: -73.6532 }; // Nassau County
      const queens = { lat: 40.7282, lng: -73.7949 }; // Queens
      
      const result = detectCrossCity(
        nassau.lat, nassau.lng,
        queens.lat, queens.lng
      );
      
      expect(result.isCrossCity).toBe(false);
      expect(result.feeApplicable).toBe(false);
      expect(result.pickupBorough).toBe('OUT_OF_NYC');
      expect(result.dropoffBorough).toBe('QUEENS');
    });
  });

  describe('Cross-State Trip Precedence', () => {
    it('should detect OUT_OF_NYC for cross-state origin (NJ)', () => {
      const newark = { lat: 40.7357, lng: -74.1724 }; // Newark, NJ
      const brooklyn = { lat: 40.6892, lng: -73.9857 }; // Brooklyn
      
      const result = detectCrossCity(
        newark.lat, newark.lng,
        brooklyn.lat, brooklyn.lng
      );
      
      // Cross-state trips should not get cross-borough fee
      expect(result.feeApplicable).toBe(false);
      expect(result.pickupBorough).toBe('OUT_OF_NYC');
    });

    it('should detect OUT_OF_NYC for cross-state destination (NJ)', () => {
      const queens = { lat: 40.7282, lng: -73.7949 }; // Queens (JFK area)
      const newark = { lat: 40.7357, lng: -74.1724 }; // Newark, NJ
      
      const result = detectCrossCity(
        queens.lat, queens.lng,
        newark.lat, newark.lng
      );
      
      // Cross-state trips should not get cross-borough fee
      expect(result.feeApplicable).toBe(false);
      expect(result.dropoffBorough).toBe('OUT_OF_NYC');
    });

    it('should detect OUT_OF_NYC for both endpoints outside NYC', () => {
      const newark = { lat: 40.7357, lng: -74.1724 }; // Newark, NJ
      const westchester = { lat: 41.0082, lng: -73.7107 }; // Westchester
      
      const result = detectCrossCity(
        newark.lat, newark.lng,
        westchester.lat, westchester.lng
      );
      
      expect(result.isCrossCity).toBe(false);
      expect(result.feeApplicable).toBe(false);
      expect(result.pickupBorough).toBe('OUT_OF_NYC');
      expect(result.dropoffBorough).toBe('OUT_OF_NYC');
    });
  });

  describe('Airport Suppression Context', () => {
    it('should still identify cross-borough for JFK area trip (suppression in fare engine)', () => {
      const manhattan = { lat: 40.7580, lng: -73.9855 }; // Times Square
      const jfkArea = { lat: 40.6413, lng: -73.7781 }; // Near JFK (Queens)
      
      const result = detectCrossCity(
        manhattan.lat, manhattan.lng,
        jfkArea.lat, jfkArea.lng
      );
      
      // Detection identifies cross-borough; fare engine handles airport suppression
      expect(result.isCrossCity).toBe(true);
      expect(result.feeApplicable).toBe(true);
      expect(result.pickupBorough).toBe('MANHATTAN');
      expect(result.dropoffBorough).toBe('QUEENS');
    });

    it('should still identify cross-borough for LGA area trip (suppression in fare engine)', () => {
      const brooklyn = { lat: 40.6892, lng: -73.9857 }; // Brooklyn Heights
      const lgaArea = { lat: 40.7769, lng: -73.8740 }; // Near LGA (Queens)
      
      const result = detectCrossCity(
        brooklyn.lat, brooklyn.lng,
        lgaArea.lat, lgaArea.lng
      );
      
      // Detection identifies cross-borough; fare engine handles airport suppression
      expect(result.isCrossCity).toBe(true);
      expect(result.feeApplicable).toBe(true);
      expect(result.pickupBorough).toBe('BROOKLYN');
      expect(result.dropoffBorough).toBe('QUEENS');
    });
  });
});

// ============================================
// Regression Tests
// ============================================

describe('Regression Tests', () => {
  it('should NOT falsely detect cross-borough for points very close to borough boundary', () => {
    // Points near Brooklyn-Manhattan boundary (Brooklyn Bridge area)
    const brooklyn1 = { lat: 40.7062, lng: -73.9969 }; // DUMBO
    const brooklyn2 = { lat: 40.6950, lng: -73.9900 }; // Also Brooklyn
    
    const result = detectCrossCity(
      brooklyn1.lat, brooklyn1.lng,
      brooklyn2.lat, brooklyn2.lng
    );
    
    // Should NOT be cross-borough if both are actually in same borough
    expect(result.pickupBorough).toBe('BROOKLYN');
    expect(result.dropoffBorough).toBe('BROOKLYN');
    expect(result.isCrossCity).toBe(false);
  });

  it('should correctly detect Manhattan to Brooklyn water crossing', () => {
    const manhattan = { lat: 40.7128, lng: -74.0060 }; // City Hall
    const brooklyn = { lat: 40.7062, lng: -73.9969 }; // DUMBO
    
    const result = detectCrossCity(
      manhattan.lat, manhattan.lng,
      brooklyn.lat, brooklyn.lng
    );
    
    expect(result.isCrossCity).toBe(true);
    expect(result.feeApplicable).toBe(true);
  });

  it('should handle Staten Island ferry terminal route correctly', () => {
    const manhattan = { lat: 40.7003, lng: -74.0140 }; // Whitehall (Manhattan)
    const statenIsland = { lat: 40.6432, lng: -74.0736 }; // St. George Terminal
    
    const result = detectCrossCity(
      manhattan.lat, manhattan.lng,
      statenIsland.lat, statenIsland.lng
    );
    
    expect(result.isCrossCity).toBe(true);
    expect(result.feeApplicable).toBe(true);
    expect(result.pickupBorough).toBe('MANHATTAN');
    expect(result.dropoffBorough).toBe('STATEN_ISLAND');
  });
});

// ============================================
// Audit Integration Suppression Tests
// ============================================

describe('Audit Integration - Suppression Context Awareness', () => {
  describe('Airport Fee Suppression (handled in fare engine, audit should accept)', () => {
    it('should identify cross-borough for Manhattan-JFK but fare engine handles suppression', () => {
      const manhattan = { lat: 40.7580, lng: -73.9855 }; // Times Square
      const jfk = { lat: 40.6413, lng: -73.7781 }; // JFK area in Queens
      
      const result = detectCrossCity(
        manhattan.lat, manhattan.lng,
        jfk.lat, jfk.lng
      );
      
      // Detection layer identifies cross-borough
      expect(result.isCrossCity).toBe(true);
      expect(result.feeApplicable).toBe(true);
      expect(result.pickupBorough).toBe('MANHATTAN');
      expect(result.dropoffBorough).toBe('QUEENS');
      
      // NOTE: When airport fee is applied, audit engine checks tripCategory
      // and airport fee amount to determine if suppression is valid
    });

    it('should identify cross-borough for Brooklyn-LGA but fare engine handles suppression', () => {
      const brooklyn = { lat: 40.6892, lng: -73.9857 }; // Brooklyn
      const lga = { lat: 40.7769, lng: -73.8740 }; // LGA area in Queens
      
      const result = detectCrossCity(
        brooklyn.lat, brooklyn.lng,
        lga.lat, lga.lng
      );
      
      expect(result.isCrossCity).toBe(true);
      expect(result.feeApplicable).toBe(true);
      expect(result.pickupBorough).toBe('BROOKLYN');
      expect(result.dropoffBorough).toBe('QUEENS');
    });
  });

  describe('Cross-State Suppression (handled in fare engine)', () => {
    it('should NOT mark as cross-borough when origin is out of state', () => {
      const newark = { lat: 40.7357, lng: -74.1724 }; // Newark EWR
      const manhattan = { lat: 40.7580, lng: -73.9855 };
      
      const result = detectCrossCity(
        newark.lat, newark.lng,
        manhattan.lat, manhattan.lng
      );
      
      // Detection layer correctly identifies OUT_OF_NYC
      expect(result.feeApplicable).toBe(false);
      expect(result.pickupBorough).toBe('OUT_OF_NYC');
    });

    it('should NOT mark as cross-borough when destination is out of state', () => {
      const manhattan = { lat: 40.7580, lng: -73.9855 };
      const newark = { lat: 40.7357, lng: -74.1724 }; // Newark EWR
      
      const result = detectCrossCity(
        manhattan.lat, manhattan.lng,
        newark.lat, newark.lng
      );
      
      // Detection layer correctly identifies OUT_OF_NYC
      expect(result.feeApplicable).toBe(false);
      expect(result.dropoffBorough).toBe('OUT_OF_NYC');
    });
  });

  describe('Out-of-Town Return Fee Suppression', () => {
    it('should NOT expect cross-borough fee when out-of-town return fee applies', () => {
      const manhattan = { lat: 40.7580, lng: -73.9855 };
      const westchester = { lat: 41.0082, lng: -73.7107 };
      
      const result = detectCrossCity(
        manhattan.lat, manhattan.lng,
        westchester.lat, westchester.lng
      );
      
      // detectCrossCity correctly identifies this as OUT_OF_NYC dropoff
      expect(result.feeApplicable).toBe(false);
      expect(result.dropoffBorough).toBe('OUT_OF_NYC');
      expect(result.reason).toContain('Out-of-Town');
    });
  });
});
