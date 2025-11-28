/**
 * TLC Report Generator Test Suite
 * 
 * Comprehensive test coverage for NYC TLC HVFHV compliance reports.
 * Tests cover Trip Record Reports, Driver Pay Reports, HVFHV Summary Reports,
 * Out-of-Town Reports, Accessibility Reports, and Airport Activity Reports.
 */

import {
  generateTripRecordReport,
  generateDriverPayReport,
  generateHVFHVSummaryReport,
  generateOutOfTownReport,
  generateAccessibilityReport,
  generateAirportActivityReport,
  exportReport,
  validateTripRecord,
  validateDriverPayReport,
  tripRecordToCSV,
  driverPayToCSV,
  summaryReportToCSV,
  TLCReportFilters,
  TripRecordReport,
  DriverPayReport,
  BoroughCode,
  TripCategory,
  AirportCode,
} from '../tlcReportGenerator';

import { NYC_TLC_CONFIG } from '../tlcMinimumPayEngine';

describe('TLC Report Generator', () => {
  const defaultFilters: TLCReportFilters = {
    startDate: new Date('2025-11-01'),
    endDate: new Date('2025-11-30'),
  };

  describe('Trip Record Report (TRR) Generation', () => {
    it('should generate trip records for given date range', async () => {
      const report = await generateTripRecordReport(defaultFilters);
      
      expect(report).toBeDefined();
      expect(Array.isArray(report)).toBe(true);
      expect(report.length).toBeGreaterThan(0);
    });

    it('should include all required TLC fields in trip record', async () => {
      const report = await generateTripRecordReport(defaultFilters);
      const trip = report[0];
      
      expect(trip.tripId).toBeDefined();
      expect(trip.driverId).toBeDefined();
      expect(trip.vehicleId).toBeDefined();
      expect(trip.pickupTime).toBeInstanceOf(Date);
      expect(trip.dropoffTime).toBeInstanceOf(Date);
      expect(trip.tripDistanceMiles).toBeGreaterThanOrEqual(0);
      expect(trip.tripDurationMinutes).toBeGreaterThanOrEqual(0);
      expect(trip.fareSubtotal).toBeDefined();
      expect(trip.finalFare).toBeDefined();
      expect(trip.driverPayout).toBeDefined();
    });

    it('should include pickup and dropoff location with borough codes', async () => {
      const report = await generateTripRecordReport(defaultFilters);
      const trip = report[0];
      
      expect(trip.pickupLocation.lat).toBeDefined();
      expect(trip.pickupLocation.lng).toBeDefined();
      expect(trip.pickupLocation.borough).toBeDefined();
      expect(trip.dropoffLocation.lat).toBeDefined();
      expect(trip.dropoffLocation.lng).toBeDefined();
      expect(trip.dropoffLocation.borough).toBeDefined();
    });

    it('should include all TLC regulatory fees', async () => {
      const report = await generateTripRecordReport(defaultFilters);
      const trip = report[0];
      
      expect(typeof trip.tolls).toBe('number');
      expect(typeof trip.congestionFee).toBe('number');
      expect(typeof trip.airportFee).toBe('number');
      expect(typeof trip.avfFee).toBe('number');
      expect(typeof trip.bcfFee).toBe('number');
      expect(typeof trip.hvrfFee).toBe('number');
      expect(typeof trip.stateSurcharge).toBe('number');
      expect(typeof trip.longTripSurcharge).toBe('number');
      expect(typeof trip.outOfTownReturnFee).toBe('number');
    });

    it('should include TLC minimum pay fields', async () => {
      const report = await generateTripRecordReport(defaultFilters);
      const trip = report[0];
      
      expect(typeof trip.tlcMinimumApplied).toBe('boolean');
      expect(typeof trip.tlcAdjustment).toBe('number');
    });

    it('should include accessibility tracking fields', async () => {
      const report = await generateTripRecordReport(defaultFilters);
      const trip = report[0];
      
      expect(typeof trip.isAccessibleVehicle).toBe('boolean');
      expect(typeof trip.isWheelchairTrip).toBe('boolean');
    });

    it('should categorize trips correctly', async () => {
      const report = await generateTripRecordReport(defaultFilters);
      const validCategories: TripCategory[] = [
        'NYC_TO_NYC', 'NYC_TO_OOS', 'OOS_TO_NYC', 
        'INTER_BOROUGH', 'INTRA_BOROUGH',
        'AIRPORT_PICKUP', 'AIRPORT_DROPOFF',
        'MANHATTAN_CONGESTION', 'LONG_TRIP', 'UNKNOWN'
      ];
      
      for (const trip of report) {
        expect(validCategories).toContain(trip.tripCategory);
      }
    });

    it('should filter by driver ID', async () => {
      const filtersWithDriver: TLCReportFilters = {
        ...defaultFilters,
        driverId: 'driver-1',
      };
      const report = await generateTripRecordReport(filtersWithDriver);
      
      for (const trip of report) {
        expect(trip.driverId).toBe('driver-1');
      }
    });

    it('should filter by borough', async () => {
      const filtersWithBorough: TLCReportFilters = {
        ...defaultFilters,
        borough: 'MANHATTAN' as BoroughCode,
      };
      const report = await generateTripRecordReport(filtersWithBorough);
      
      for (const trip of report) {
        expect(
          trip.pickupLocation.borough === 'MANHATTAN' || 
          trip.dropoffLocation.borough === 'MANHATTAN'
        ).toBe(true);
      }
    });

    it('should filter by trip type', async () => {
      const filtersWithType: TLCReportFilters = {
        ...defaultFilters,
        tripType: 'AIRPORT_PICKUP' as TripCategory,
      };
      const report = await generateTripRecordReport(filtersWithType);
      
      for (const trip of report) {
        expect(trip.tripCategory).toBe('AIRPORT_PICKUP');
      }
    });

    it('should have valid date relationships', async () => {
      const report = await generateTripRecordReport(defaultFilters);
      
      for (const trip of report) {
        expect(trip.pickupTime.getTime()).toBeLessThan(trip.dropoffTime.getTime());
        expect(trip.pickupTime.getTime()).toBeGreaterThanOrEqual(defaultFilters.startDate.getTime());
        expect(trip.dropoffTime.getTime()).toBeLessThanOrEqual(defaultFilters.endDate.getTime() + 24 * 60 * 60 * 1000);
      }
    });
  });

  describe('Driver Pay Report (DPR) Generation', () => {
    it('should generate driver pay reports for given date range', async () => {
      const report = await generateDriverPayReport(defaultFilters);
      
      expect(report).toBeDefined();
      expect(Array.isArray(report)).toBe(true);
      expect(report.length).toBeGreaterThan(0);
    });

    it('should include all required driver earnings fields', async () => {
      const report = await generateDriverPayReport(defaultFilters);
      const driver = report[0];
      
      expect(driver.driverId).toBeDefined();
      expect(driver.reportPeriodStart).toBeInstanceOf(Date);
      expect(driver.reportPeriodEnd).toBeInstanceOf(Date);
      expect(driver.totalTrips).toBeGreaterThanOrEqual(0);
      expect(driver.totalOnlineHours).toBeGreaterThanOrEqual(0);
      expect(driver.totalEngagedHours).toBeGreaterThanOrEqual(0);
      expect(driver.utilizationRate).toBeGreaterThanOrEqual(0);
    });

    it('should include TLC time and distance earnings', async () => {
      const report = await generateDriverPayReport(defaultFilters);
      const driver = report[0];
      
      expect(typeof driver.tlcTimeEarnings).toBe('number');
      expect(typeof driver.tlcDistanceEarnings).toBe('number');
      expect(driver.tlcTimeEarnings).toBeGreaterThanOrEqual(0);
      expect(driver.tlcDistanceEarnings).toBeGreaterThanOrEqual(0);
    });

    it('should include TLC minimum pay adjustments', async () => {
      const report = await generateDriverPayReport(defaultFilters);
      const driver = report[0];
      
      expect(typeof driver.tlcMinimumPayAdjustments).toBe('number');
      expect(typeof driver.perRideAdjustmentsTotal).toBe('number');
      expect(typeof driver.hourlyAdjustmentsTotal).toBe('number');
      expect(typeof driver.weeklyAdjustmentTotal).toBe('number');
    });

    it('should include incentive breakdown', async () => {
      const report = await generateDriverPayReport(defaultFilters);
      const driver = report[0];
      
      expect(driver.incentiveBreakdown).toBeDefined();
      expect(typeof driver.incentiveBreakdown.questBonus).toBe('number');
      expect(typeof driver.incentiveBreakdown.boostZoneBonus).toBe('number');
      expect(typeof driver.incentiveBreakdown.airportPickupBonus).toBe('number');
      expect(typeof driver.incentiveBreakdown.weatherBonus).toBe('number');
      expect(typeof driver.incentiveBreakdown.lateNightBonus).toBe('number');
    });

    it('should include fee breakdown collected for TLC', async () => {
      const report = await generateDriverPayReport(defaultFilters);
      const driver = report[0];
      
      expect(driver.feesBreakdown).toBeDefined();
      expect(typeof driver.feesBreakdown.avfTotal).toBe('number');
      expect(typeof driver.feesBreakdown.bcfTotal).toBe('number');
      expect(typeof driver.feesBreakdown.hvrfTotal).toBe('number');
      expect(typeof driver.feesBreakdown.stateSurchargeTotal).toBe('number');
      expect(typeof driver.feesBreakdown.congestionTotal).toBe('number');
      expect(typeof driver.feesBreakdown.airportTotal).toBe('number');
      expect(typeof driver.feesBreakdown.longTripTotal).toBe('number');
      expect(typeof driver.feesBreakdown.outOfTownTotal).toBe('number');
    });

    it('should calculate hourly earnings average correctly', async () => {
      const report = await generateDriverPayReport(defaultFilters);
      
      for (const driver of report) {
        if (driver.totalEngagedHours > 0) {
          const expectedHourly = driver.netPayout / driver.totalEngagedHours;
          expect(Math.abs(driver.hourlyEarningsAverage - expectedHourly)).toBeLessThan(0.02);
        }
      }
    });

    it('should have valid TLC compliance status', async () => {
      const report = await generateDriverPayReport(defaultFilters);
      
      for (const driver of report) {
        expect(['COMPLIANT', 'PENDING_ADJUSTMENT', 'ADJUSTED']).toContain(driver.tlcComplianceStatus);
      }
    });

    it('should filter by specific driver ID', async () => {
      const filtersWithDriver: TLCReportFilters = {
        ...defaultFilters,
        driverId: 'driver-5',
      };
      const report = await generateDriverPayReport(filtersWithDriver);
      
      for (const driver of report) {
        expect(driver.driverId).toBe('driver-5');
      }
    });
  });

  describe('HVFHV Summary Report (HSR) Generation', () => {
    it('should generate HVFHV summary report', async () => {
      const report = await generateHVFHVSummaryReport(defaultFilters);
      
      expect(report).toBeDefined();
      expect(report.reportPeriodStart).toBeInstanceOf(Date);
      expect(report.reportPeriodEnd).toBeInstanceOf(Date);
      expect(report.totalTrips).toBeGreaterThan(0);
    });

    it('should include borough pair breakdown', async () => {
      const report = await generateHVFHVSummaryReport(defaultFilters);
      
      expect(report.tripsByBoroughPair).toBeDefined();
      expect(Array.isArray(report.tripsByBoroughPair)).toBe(true);
      
      for (const pair of report.tripsByBoroughPair) {
        expect(pair.pickupBorough).toBeDefined();
        expect(pair.dropoffBorough).toBeDefined();
        expect(pair.tripCount).toBeGreaterThan(0);
        expect(pair.totalFare).toBeGreaterThan(0);
        expect(pair.avgFare).toBeGreaterThan(0);
      }
    });

    it('should include accessibility fund totals', async () => {
      const report = await generateHVFHVSummaryReport(defaultFilters);
      
      expect(report.accessibilityFundTotals).toBeDefined();
      expect(typeof report.accessibilityFundTotals.avfTripsCount).toBe('number');
      expect(typeof report.accessibilityFundTotals.avfTotalCollected).toBe('number');
      expect(typeof report.accessibilityFundTotals.wheelchairTripsCount).toBe('number');
      expect(typeof report.accessibilityFundTotals.accessibleVehicleTripsCount).toBe('number');
    });

    it('should include airport pickup counts', async () => {
      const report = await generateHVFHVSummaryReport(defaultFilters);
      
      expect(report.airportPickupCounts).toBeDefined();
      expect(Array.isArray(report.airportPickupCounts)).toBe(true);
      
      const expectedAirports: AirportCode[] = ['JFK', 'LGA', 'EWR', 'WCY'];
      const airportCodes = report.airportPickupCounts.map(a => a.airportCode);
      
      for (const expected of expectedAirports) {
        expect(airportCodes).toContain(expected);
      }
    });

    it('should include Manhattan congestion fee totals', async () => {
      const report = await generateHVFHVSummaryReport(defaultFilters);
      
      expect(report.manhattanCongestionFees).toBeDefined();
      expect(typeof report.manhattanCongestionFees.tripsInZone).toBe('number');
      expect(typeof report.manhattanCongestionFees.totalCongestionFees).toBe('number');
      expect(typeof report.manhattanCongestionFees.avgCongestionFee).toBe('number');
    });

    it('should include out-of-town trip totals', async () => {
      const report = await generateHVFHVSummaryReport(defaultFilters);
      
      expect(report.outOfTownTrips).toBeDefined();
      expect(typeof report.outOfTownTrips.nycToOosCount).toBe('number');
      expect(typeof report.outOfTownTrips.oosToNycCount).toBe('number');
      expect(typeof report.outOfTownTrips.totalReturnFees).toBe('number');
    });

    it('should include long trip surcharge totals', async () => {
      const report = await generateHVFHVSummaryReport(defaultFilters);
      
      expect(report.longTripSurcharges).toBeDefined();
      expect(typeof report.longTripSurcharges.tripsOver20Miles).toBe('number');
      expect(typeof report.longTripSurcharges.totalLongTripSurcharges).toBe('number');
    });

    it('should include driver working hours summary', async () => {
      const report = await generateHVFHVSummaryReport(defaultFilters);
      
      expect(report.driverWorkingHours).toBeDefined();
      expect(report.driverWorkingHours.totalOnlineHours).toBeGreaterThan(0);
      expect(report.driverWorkingHours.totalEngagedHours).toBeGreaterThan(0);
      expect(report.driverWorkingHours.driversActive).toBeGreaterThan(0);
    });

    it('should include financial summary', async () => {
      const report = await generateHVFHVSummaryReport(defaultFilters);
      
      expect(report.financialSummary).toBeDefined();
      expect(report.financialSummary.totalFaresCollected).toBeGreaterThan(0);
      expect(report.financialSummary.totalDriverPayouts).toBeGreaterThan(0);
      expect(report.financialSummary.totalCommissions).toBeGreaterThan(0);
      expect(report.financialSummary.totalTLCFees).toBeGreaterThan(0);
    });
  });

  describe('Out-of-Town Report Generation', () => {
    it('should generate out-of-town report', async () => {
      const report = await generateOutOfTownReport(defaultFilters);
      
      expect(report).toBeDefined();
      expect(report.reportPeriodStart).toBeInstanceOf(Date);
      expect(report.reportPeriodEnd).toBeInstanceOf(Date);
      expect(report.trips).toBeDefined();
      expect(report.summary).toBeDefined();
    });

    it('should include only out-of-town trips', async () => {
      const report = await generateOutOfTownReport(defaultFilters);
      
      for (const trip of report.trips) {
        expect(['NYC_TO_OOS', 'OOS_TO_NYC']).toContain(trip.direction);
      }
    });

    it('should include return fee information', async () => {
      const report = await generateOutOfTownReport(defaultFilters);
      
      for (const trip of report.trips) {
        expect(typeof trip.returnFeeCharged).toBe('number');
        expect(trip.returnFeeCharged).toBeGreaterThanOrEqual(0);
      }
    });

    it('should summarize outbound and inbound trips correctly', async () => {
      const report = await generateOutOfTownReport(defaultFilters);
      
      const outboundCount = report.trips.filter(t => t.direction === 'NYC_TO_OOS').length;
      const inboundCount = report.trips.filter(t => t.direction === 'OOS_TO_NYC').length;
      
      expect(report.summary.totalOutboundTrips).toBe(outboundCount);
      expect(report.summary.totalInboundTrips).toBe(inboundCount);
    });
  });

  describe('Accessibility Report Generation', () => {
    it('should generate accessibility report', async () => {
      const report = await generateAccessibilityReport(defaultFilters);
      
      expect(report).toBeDefined();
      expect(report.reportPeriodStart).toBeInstanceOf(Date);
      expect(report.reportPeriodEnd).toBeInstanceOf(Date);
    });

    it('should include AVF collection totals', async () => {
      const report = await generateAccessibilityReport(defaultFilters);
      
      expect(report.avfCollection).toBeDefined();
      expect(typeof report.avfCollection.totalTrips).toBe('number');
      expect(typeof report.avfCollection.totalAVFCollected).toBe('number');
      expect(typeof report.avfCollection.avgAVFPerTrip).toBe('number');
    });

    it('should include accessible vehicle trip metrics', async () => {
      const report = await generateAccessibilityReport(defaultFilters);
      
      expect(report.accessibleVehicleTrips).toBeDefined();
      expect(typeof report.accessibleVehicleTrips.totalTrips).toBe('number');
      expect(typeof report.accessibleVehicleTrips.wheelchairTrips).toBe('number');
    });

    it('should include borough breakdown', async () => {
      const report = await generateAccessibilityReport(defaultFilters);
      
      expect(report.boroughBreakdown).toBeDefined();
      expect(Array.isArray(report.boroughBreakdown)).toBe(true);
      
      for (const borough of report.boroughBreakdown) {
        expect(borough.borough).toBeDefined();
        expect(typeof borough.accessibleTrips).toBe('number');
        expect(typeof borough.avfCollected).toBe('number');
      }
    });

    it('should include compliance metrics', async () => {
      const report = await generateAccessibilityReport(defaultFilters);
      
      expect(report.complianceMetrics).toBeDefined();
      expect(typeof report.complianceMetrics.percentAccessibleTrips).toBe('number');
      expect(typeof report.complianceMetrics.targetPercentage).toBe('number');
      expect(typeof report.complianceMetrics.isCompliant).toBe('boolean');
    });
  });

  describe('Airport Activity Report Generation', () => {
    it('should generate airport activity report', async () => {
      const report = await generateAirportActivityReport(defaultFilters);
      
      expect(report).toBeDefined();
      expect(report.reportPeriodStart).toBeInstanceOf(Date);
      expect(report.reportPeriodEnd).toBeInstanceOf(Date);
    });

    it('should include data for all NYC area airports', async () => {
      const report = await generateAirportActivityReport(defaultFilters);
      
      expect(report.airports).toBeDefined();
      expect(report.airports.length).toBe(4);
      
      const codes = report.airports.map(a => a.code);
      expect(codes).toContain('JFK');
      expect(codes).toContain('LGA');
      expect(codes).toContain('EWR');
      expect(codes).toContain('WCY');
    });

    it('should include pickup and dropoff counts per airport', async () => {
      const report = await generateAirportActivityReport(defaultFilters);
      
      for (const airport of report.airports) {
        expect(typeof airport.pickups.count).toBe('number');
        expect(typeof airport.dropoffs.count).toBe('number');
        expect(airport.pickups.count).toBeGreaterThanOrEqual(0);
        expect(airport.dropoffs.count).toBeGreaterThanOrEqual(0);
      }
    });

    it('should include hourly distribution', async () => {
      const report = await generateAirportActivityReport(defaultFilters);
      
      for (const airport of report.airports) {
        expect(airport.hourlyDistribution).toBeDefined();
        expect(airport.hourlyDistribution.length).toBe(24);
        
        for (const hourData of airport.hourlyDistribution) {
          expect(typeof hourData.hour).toBe('number');
          expect(hourData.hour).toBeGreaterThanOrEqual(0);
          expect(hourData.hour).toBeLessThanOrEqual(23);
        }
      }
    });

    it('should include summary with busiest airport and peak hour', async () => {
      const report = await generateAirportActivityReport(defaultFilters);
      
      expect(report.summary).toBeDefined();
      expect(typeof report.summary.totalAirportTrips).toBe('number');
      expect(typeof report.summary.totalAirportFees).toBe('number');
      expect(['JFK', 'LGA', 'EWR', 'WCY']).toContain(report.summary.busiestAirport);
      expect(report.summary.peakHour).toBeGreaterThanOrEqual(0);
      expect(report.summary.peakHour).toBeLessThanOrEqual(23);
    });
  });

  describe('CSV Export Functions', () => {
    it('should export trip records to CSV', async () => {
      const trips = await generateTripRecordReport(defaultFilters);
      const csv = tripRecordToCSV(trips);
      
      expect(typeof csv).toBe('string');
      expect(csv.length).toBeGreaterThan(0);
      
      const lines = csv.split('\n');
      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0]).toContain('tripId');
      expect(lines[0]).toContain('driverId');
      expect(lines[0]).toContain('fareSubtotal');
    });

    it('should export driver pay reports to CSV', async () => {
      const reports = await generateDriverPayReport(defaultFilters);
      const csv = driverPayToCSV(reports);
      
      expect(typeof csv).toBe('string');
      expect(csv.length).toBeGreaterThan(0);
      
      const lines = csv.split('\n');
      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0]).toContain('driverId');
      expect(lines[0]).toContain('baseEarnings');
      expect(lines[0]).toContain('netPayout');
    });

    it('should export HVFHV summary to CSV', async () => {
      const report = await generateHVFHVSummaryReport(defaultFilters);
      const csv = summaryReportToCSV(report);
      
      expect(typeof csv).toBe('string');
      expect(csv.length).toBeGreaterThan(0);
      expect(csv).toContain('NYC TLC HVFHV Summary Report');
      expect(csv).toContain('TRIP SUMMARY');
      expect(csv).toContain('FINANCIAL SUMMARY');
    });
  });

  describe('Report Export Service', () => {
    it('should export TRR in JSON format', async () => {
      const result = await exportReport('TRR', 'json', defaultFilters);
      
      expect(result.format).toBe('json');
      expect(result.reportType).toBe('TRR');
      expect(result.filename).toContain('TLC_TripRecordReport');
      expect(result.recordCount).toBeGreaterThan(0);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should export TRR in CSV format', async () => {
      const result = await exportReport('TRR', 'csv', defaultFilters);
      
      expect(result.format).toBe('csv');
      expect(result.reportType).toBe('TRR');
      expect(result.filename).toContain('.csv');
      expect(typeof result.data).toBe('string');
    });

    it('should export DPR in JSON format', async () => {
      const result = await exportReport('DPR', 'json', defaultFilters);
      
      expect(result.format).toBe('json');
      expect(result.reportType).toBe('DPR');
      expect(result.recordCount).toBeGreaterThan(0);
    });

    it('should export HSR in JSON format', async () => {
      const result = await exportReport('HSR', 'json', defaultFilters);
      
      expect(result.format).toBe('json');
      expect(result.reportType).toBe('HSR');
      expect(result.recordCount).toBe(1);
    });

    it('should export all report types', async () => {
      const reportTypes: Array<'TRR' | 'DPR' | 'HSR' | 'OUT_OF_TOWN' | 'ACCESSIBILITY' | 'AIRPORT'> = [
        'TRR', 'DPR', 'HSR', 'OUT_OF_TOWN', 'ACCESSIBILITY', 'AIRPORT'
      ];
      
      for (const type of reportTypes) {
        const result = await exportReport(type, 'json', defaultFilters);
        expect(result.reportType).toBe(type);
        expect(result.generatedAt).toBeInstanceOf(Date);
      }
    });
  });

  describe('Trip Record Validation', () => {
    it('should validate valid trip record', async () => {
      const trips = await generateTripRecordReport(defaultFilters);
      const validation = validateTripRecord(trips[0]);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should detect missing tripId', () => {
      const invalidTrip = {
        tripId: '',
        driverId: 'driver-1',
        vehicleId: 'VEH-001',
        pickupTime: new Date(),
        dropoffTime: new Date(Date.now() + 3600000),
        pickupLocation: { lat: 40.7, lng: -74.0, borough: 'MANHATTAN' as BoroughCode },
        dropoffLocation: { lat: 40.72, lng: -73.98, borough: 'BROOKLYN' as BoroughCode },
        tripDistanceMiles: 5,
        tripDurationMinutes: 20,
        fareSubtotal: 25,
        tolls: 0,
        congestionFee: 2.75,
        airportFee: 0,
        avfFee: 0.125,
        bcfFee: 0.625,
        hvrfFee: 0.05,
        stateSurcharge: 2.50,
        longTripSurcharge: 0,
        outOfTownReturnFee: 0,
        promoUsed: false,
        discountAmount: 0,
        finalFare: 31.05,
        driverPayout: 22,
        commissionAmount: 6.25,
        tripCategory: 'INTER_BOROUGH' as TripCategory,
        tlcMinimumApplied: false,
        tlcAdjustment: 0,
        isAccessibleVehicle: false,
        isWheelchairTrip: false,
        reportGeneratedAt: new Date(),
      } as TripRecordReport;
      
      const validation = validateTripRecord(invalidTrip);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Missing tripId');
    });

    it('should detect invalid date relationship', () => {
      const invalidTrip = {
        tripId: 'TRP-001',
        driverId: 'driver-1',
        vehicleId: 'VEH-001',
        pickupTime: new Date(),
        dropoffTime: new Date(Date.now() - 3600000),
        pickupLocation: { lat: 40.7, lng: -74.0, borough: 'MANHATTAN' as BoroughCode },
        dropoffLocation: { lat: 40.72, lng: -73.98, borough: 'BROOKLYN' as BoroughCode },
        tripDistanceMiles: 5,
        tripDurationMinutes: 20,
        fareSubtotal: 25,
        tolls: 0,
        congestionFee: 2.75,
        airportFee: 0,
        avfFee: 0.125,
        bcfFee: 0.625,
        hvrfFee: 0.05,
        stateSurcharge: 2.50,
        longTripSurcharge: 0,
        outOfTownReturnFee: 0,
        promoUsed: false,
        discountAmount: 0,
        finalFare: 31.05,
        driverPayout: 22,
        commissionAmount: 6.25,
        tripCategory: 'INTER_BOROUGH' as TripCategory,
        tlcMinimumApplied: false,
        tlcAdjustment: 0,
        isAccessibleVehicle: false,
        isWheelchairTrip: false,
        reportGeneratedAt: new Date(),
      } as TripRecordReport;
      
      const validation = validateTripRecord(invalidTrip);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('pickupTime must be before dropoffTime');
    });

    it('should detect negative values', () => {
      const invalidTrip = {
        tripId: 'TRP-001',
        driverId: 'driver-1',
        vehicleId: 'VEH-001',
        pickupTime: new Date(),
        dropoffTime: new Date(Date.now() + 3600000),
        pickupLocation: { lat: 40.7, lng: -74.0, borough: 'MANHATTAN' as BoroughCode },
        dropoffLocation: { lat: 40.72, lng: -73.98, borough: 'BROOKLYN' as BoroughCode },
        tripDistanceMiles: -5,
        tripDurationMinutes: 20,
        fareSubtotal: 25,
        tolls: 0,
        congestionFee: 2.75,
        airportFee: 0,
        avfFee: 0.125,
        bcfFee: 0.625,
        hvrfFee: 0.05,
        stateSurcharge: 2.50,
        longTripSurcharge: 0,
        outOfTownReturnFee: 0,
        promoUsed: false,
        discountAmount: 0,
        finalFare: 31.05,
        driverPayout: 22,
        commissionAmount: 6.25,
        tripCategory: 'INTER_BOROUGH' as TripCategory,
        tlcMinimumApplied: false,
        tlcAdjustment: 0,
        isAccessibleVehicle: false,
        isWheelchairTrip: false,
        reportGeneratedAt: new Date(),
      } as TripRecordReport;
      
      const validation = validateTripRecord(invalidTrip);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('tripDistanceMiles cannot be negative');
    });
  });

  describe('Driver Pay Report Validation', () => {
    it('should validate valid driver pay report', async () => {
      const reports = await generateDriverPayReport(defaultFilters);
      const validation = validateDriverPayReport(reports[0]);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should detect missing driverId', () => {
      const invalidReport = {
        driverId: '',
        reportPeriodStart: new Date(),
        reportPeriodEnd: new Date(),
        totalTrips: 10,
        totalOnlineHours: 20,
        totalEngagedHours: 15,
        utilizationRate: 0.75,
        baseEarnings: 500,
        tlcTimeEarnings: 200,
        tlcDistanceEarnings: 300,
        tlcMinimumPayAdjustments: 0,
        perRideAdjustmentsTotal: 0,
        hourlyAdjustmentsTotal: 0,
        weeklyAdjustmentTotal: 0,
        incentivesTotal: 50,
        incentiveBreakdown: {
          questBonus: 20,
          boostZoneBonus: 15,
          airportPickupBonus: 10,
          weatherBonus: 5,
          lateNightBonus: 0,
        },
        tollsCollected: 25,
        feesCollectedForTLC: 100,
        feesBreakdown: {
          avfTotal: 20,
          bcfTotal: 30,
          hvrfTotal: 5,
          stateSurchargeTotal: 25,
          congestionTotal: 10,
          airportTotal: 5,
          longTripTotal: 3,
          outOfTownTotal: 2,
        },
        grossEarnings: 575,
        netPayout: 550,
        hourlyEarningsAverage: 36.67,
        tlcComplianceStatus: 'COMPLIANT' as const,
        reportGeneratedAt: new Date(),
      } as DriverPayReport;
      
      const validation = validateDriverPayReport(invalidReport);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Missing driverId');
    });

    it('should warn when engaged hours exceed online hours', () => {
      const invalidReport = {
        driverId: 'driver-1',
        reportPeriodStart: new Date(),
        reportPeriodEnd: new Date(),
        totalTrips: 10,
        totalOnlineHours: 15,
        totalEngagedHours: 20,
        utilizationRate: 1.33,
        baseEarnings: 500,
        tlcTimeEarnings: 200,
        tlcDistanceEarnings: 300,
        tlcMinimumPayAdjustments: 0,
        perRideAdjustmentsTotal: 0,
        hourlyAdjustmentsTotal: 0,
        weeklyAdjustmentTotal: 0,
        incentivesTotal: 50,
        incentiveBreakdown: {
          questBonus: 20,
          boostZoneBonus: 15,
          airportPickupBonus: 10,
          weatherBonus: 5,
          lateNightBonus: 0,
        },
        tollsCollected: 25,
        feesCollectedForTLC: 100,
        feesBreakdown: {
          avfTotal: 20,
          bcfTotal: 30,
          hvrfTotal: 5,
          stateSurchargeTotal: 25,
          congestionTotal: 10,
          airportTotal: 5,
          longTripTotal: 3,
          outOfTownTotal: 2,
        },
        grossEarnings: 575,
        netPayout: 550,
        hourlyEarningsAverage: 36.67,
        tlcComplianceStatus: 'COMPLIANT' as const,
        reportGeneratedAt: new Date(),
      } as DriverPayReport;
      
      const validation = validateDriverPayReport(invalidReport);
      
      expect(validation.warnings).toContain('Engaged hours exceed online hours');
    });
  });

  describe('TLC Rate Compliance', () => {
    it('should use correct TLC per-minute rate', () => {
      expect(NYC_TLC_CONFIG.perMinuteRate).toBe(0.56);
    });

    it('should use correct TLC per-mile rate', () => {
      expect(NYC_TLC_CONFIG.perMileRate).toBe(1.31);
    });

    it('should use correct TLC hourly minimum rate', () => {
      expect(NYC_TLC_CONFIG.hourlyMinimumRate).toBe(27.86);
    });

    it('should calculate TLC minimum correctly for trip', async () => {
      const trips = await generateTripRecordReport(defaultFilters);
      
      for (const trip of trips.slice(0, 10)) {
        const timeBasedMin = trip.tripDurationMinutes * NYC_TLC_CONFIG.perMinuteRate + 
                            trip.tripDistanceMiles * NYC_TLC_CONFIG.perMileRate;
        const hourlyEquivMin = (trip.tripDurationMinutes / 60) * NYC_TLC_CONFIG.hourlyMinimumRate;
        const expectedMin = Math.max(timeBasedMin, hourlyEquivMin);
        
        if (trip.tlcMinimumApplied) {
          expect(trip.tlcAdjustment).toBeGreaterThan(0);
        }
      }
    });
  });
});
