import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { uploadOnboardingDocument, getFileUrl } from '../middleware/upload';

const router = Router();

const NYC_BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

function isNycBorough(city: string | undefined): boolean {
  if (!city) return false;
  const normalizedCity = city.trim().toLowerCase();
  return NYC_BOROUGHS.some(borough => normalizedCity.includes(borough.toLowerCase()));
}

const nestedDriverRegistrationSchema = z.object({
  driverType: z.enum(['ride', 'delivery']).default('ride'),
  countryCode: z.string().default('US'),
  personalInfo: z.object({
    phone: z.string().min(10, 'Phone number is required'),
    dateOfBirth: z.string().min(1, 'Date of birth is required'),
    emergencyContactName: z.string().min(2, 'Emergency contact name required'),
    emergencyContactPhone: z.string().min(10, 'Emergency contact phone required'),
    emergencyContactRelationship: z.string().optional(),
    fatherName: z.string().optional(),
    presentAddress: z.string().optional(),
    permanentAddress: z.string().optional(),
    homeAddress: z.string().optional(),
    usaFullLegalName: z.string().optional(),
    usaStreet: z.string().optional(),
    usaAptUnit: z.string().optional(),
    usaCity: z.string().optional(),
    usaState: z.string().optional(),
    usaZipCode: z.string().optional(),
    ssnLast4: z.string().max(4).optional(),
  }),
  vehicleInfo: z.object({
    vehicleType: z.string().min(1, 'Vehicle type required'),
    vehicleModel: z.string().min(1, 'Vehicle model required'),
    vehiclePlate: z.string().min(1, 'Vehicle plate required'),
    vehicleYear: z.string().optional(),
    vehicleMake: z.string().optional(),
    vehicleColor: z.string().optional(),
    registrationDocumentUrl: z.string().optional(),
    insuranceDocumentUrl: z.string().optional(),
    insurancePolicyNumber: z.string().optional(),
  }),
  documents: z.object({
    nidNumber: z.string().optional(),
    driverLicenseNumber: z.string().optional(),
    driverLicenseExpiry: z.string().optional(),
    driverLicenseState: z.string().optional(),
    driverLicenseFrontUrl: z.string().optional(),
    driverLicenseBackUrl: z.string().optional(),
    governmentIdType: z.string().optional(),
    governmentIdLast4: z.string().optional(),
    ssnLast4: z.string().max(4).optional(),
    nidFrontImageUrl: z.string().optional(),
    nidBackImageUrl: z.string().optional(),
    licenseImageUrl: z.string().optional(),
  }),
  nycCompliance: z.object({
    tlcLicenseNumber: z.string().optional(),
    tlcLicenseFrontUrl: z.string().optional(),
    tlcLicenseBackUrl: z.string().optional(),
    tlcLicenseExpiry: z.string().optional(),
    fhvLicenseNumber: z.string().optional(),
    fhvDocumentUrl: z.string().optional(),
    dmvInspectionDate: z.string().optional(),
    dmvInspectionExpiry: z.string().optional(),
    dmvInspectionImageUrl: z.string().optional(),
  }).optional(),
  backgroundCheckConsent: z.boolean().optional(),
});

function validateNestedDriverKYC(data: z.infer<typeof nestedDriverRegistrationSchema>, countryCode: string): { valid: boolean; errors: string[]; requiresNycCompliance: boolean } {
  const errors: string[] = [];
  const { personalInfo, documents, vehicleInfo, nycCompliance } = data;
  
  const operatingCity = personalInfo.usaCity;
  const operatingState = personalInfo.usaState;
  const requiresNycCompliance = countryCode === 'US' && 
    operatingState === 'NY' && 
    isNycBorough(operatingCity);
  
  if (countryCode === 'BD') {
    if (!documents.nidNumber || documents.nidNumber.length < 10) {
      errors.push('NID number is required for Bangladesh drivers (minimum 10 digits)');
    }
    if (!personalInfo.fatherName || personalInfo.fatherName.length < 2) {
      errors.push('Father\'s name is required for Bangladesh drivers');
    }
    if (!personalInfo.presentAddress || personalInfo.presentAddress.length < 5) {
      errors.push('Present address is required for Bangladesh drivers');
    }
  } else if (countryCode === 'US') {
    if (!personalInfo.usaFullLegalName || personalInfo.usaFullLegalName.length < 2) {
      errors.push('Full legal name is required for US drivers');
    }
    if (!personalInfo.usaStreet || personalInfo.usaStreet.length < 5) {
      errors.push('Street address is required for US drivers');
    }
    if (!personalInfo.usaCity || personalInfo.usaCity.length < 2) {
      errors.push('City is required for US drivers');
    }
    if (!personalInfo.usaState || !US_STATES.includes(personalInfo.usaState)) {
      errors.push('Valid US state is required');
    }
    if (!personalInfo.usaZipCode || !/^\d{5}(-\d{4})?$/.test(personalInfo.usaZipCode)) {
      errors.push('Valid ZIP code is required for US drivers (format: 12345 or 12345-6789)');
    }
    if (personalInfo.ssnLast4 && !/^\d{4}$/.test(personalInfo.ssnLast4)) {
      errors.push('SSN last 4 digits must be exactly 4 digits');
    }
    if (!documents.driverLicenseNumber || documents.driverLicenseNumber.length < 5) {
      errors.push('Driver license number is required for US drivers');
    }
    if (!documents.driverLicenseState || !US_STATES.includes(documents.driverLicenseState)) {
      errors.push('Driver license state is required');
    }
    if (data.driverType === 'ride' && !documents.driverLicenseExpiry) {
      errors.push('Driver license expiry is required for US ride drivers');
    }
    if (!vehicleInfo.registrationDocumentUrl) {
      errors.push('Vehicle registration document is required for US drivers');
    }
    if (!vehicleInfo.insuranceDocumentUrl) {
      errors.push('Vehicle insurance document is required for US drivers');
    }
    
    if (requiresNycCompliance) {
      if (!nycCompliance?.tlcLicenseNumber || nycCompliance.tlcLicenseNumber.length < 5) {
        errors.push('TLC license number is required for NYC drivers');
      }
      if (!nycCompliance?.tlcLicenseFrontUrl) {
        errors.push('TLC license front image is required for NYC drivers');
      }
      if (!nycCompliance?.tlcLicenseBackUrl) {
        errors.push('TLC license back image is required for NYC drivers');
      }
      // FHV Number is OPTIONAL during driver submission - admin can fill it from document later
      // However, FHV Document image IS REQUIRED for NYC drivers
      if (!nycCompliance?.fhvDocumentUrl) {
        errors.push('FHV document image is required for NYC drivers');
      }
      if (!nycCompliance?.dmvInspectionDate) {
        errors.push('DMV inspection date is required for NYC drivers');
      }
      if (!nycCompliance?.dmvInspectionExpiry) {
        errors.push('DMV inspection expiry date is required for NYC drivers');
      }
      if (!nycCompliance?.dmvInspectionImageUrl) {
        errors.push('DMV inspection document is required for NYC drivers');
      }
    }
    
    if (data.backgroundCheckConsent !== true) {
      errors.push('Background check consent is required for US drivers');
    }
  }
  
  return { valid: errors.length === 0, errors, requiresNycCompliance };
}

const restaurantRegistrationSchema = z.object({
  countryCode: z.enum(['BD', 'US']),
  restaurantName: z.string().min(2, 'Restaurant name required'),
  cuisineType: z.string().min(1, 'Cuisine type required'),
  address: z.string().min(5, 'Address required'),
  cityCode: z.string().min(1, 'City required'),
  description: z.string().optional(),
  phone: z.string().min(10, 'Phone required'),
  hasExistingMenu: z.string().optional(),
  estimatedItems: z.string().optional(),
  primaryCategory: z.string().optional(),
  hasPhotos: z.string().optional(),
  businessLicenseNumber: z.string().optional(),
  nidNumber: z.string().optional(),
  governmentIdType: z.string().optional(),
  governmentIdLast4: z.string().optional(),
  taxIdLast4: z.string().optional(),
  payoutMethod: z.string().min(1, 'Payout method required'),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  mfsProvider: z.string().optional(),
  mfsNumber: z.string().optional(),
  ownerName: z.string().min(2, 'Owner name required'),
  dateOfBirth: z.string().min(1, 'Date of birth required'),
  emergencyContactName: z.string().min(2, 'Emergency contact required'),
  emergencyContactPhone: z.string().min(10, 'Emergency phone required'),
  fatherName: z.string().optional(),
  presentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  homeAddress: z.string().optional(),
});

function validateRestaurantKYC(data: z.infer<typeof restaurantRegistrationSchema>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (data.countryCode === 'BD') {
    if (!data.nidNumber || data.nidNumber.length < 10) {
      errors.push('NID number is required for Bangladesh restaurant owners (minimum 10 digits)');
    }
    if (!data.fatherName || data.fatherName.length < 2) {
      errors.push('Father\'s name is required for Bangladesh restaurant owners');
    }
    if (!data.presentAddress || data.presentAddress.length < 5) {
      errors.push('Present address is required for Bangladesh restaurant owners');
    }
    if (data.payoutMethod === 'mfs' && (!data.mfsProvider || !data.mfsNumber)) {
      errors.push('MFS provider and number required for mobile money payout');
    }
  } else if (data.countryCode === 'US') {
    if (!data.governmentIdType || !data.governmentIdLast4) {
      errors.push('Government ID information is required for US restaurant owners');
    }
    if (data.payoutMethod === 'bank' && (!data.bankName || !data.accountNumber || !data.routingNumber)) {
      errors.push('Bank details required for bank transfer payout');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

router.get('/partner-driver/registration/status/:driverType?', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const requestedDriverType = req.params.driverType || 'ride';

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        driverProfile: {
          include: {
            vehicles: {
              where: { isActive: true, isPrimary: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.driverProfile) {
      return res.json({
        profile: null,
        driverType: null,
        message: 'No driver registration found',
      });
    }

    const profile = user.driverProfile;
    const vehicle = profile.vehicles?.[0] || null;

    const driverType = (profile as any).driverType || 'ride';

    const isNycDriver = (profile as any).hasNycCompliance || false;
    
    return res.json({
      profile: {
        id: profile.id,
        driverType,
        verificationStatus: profile.verificationStatus,
        isVerified: profile.isVerified,
        hasNycCompliance: isNycDriver,
        personalInfo: {
          phone: profile.phoneNumber,
          dateOfBirth: profile.dateOfBirth,
          fatherName: profile.fatherName,
          presentAddress: profile.presentAddress,
          permanentAddress: profile.permanentAddress,
          homeAddress: profile.homeAddress,
          emergencyContactName: profile.emergencyContactName,
          emergencyContactPhone: profile.emergencyContactPhone,
          emergencyContactRelationship: profile.emergencyContactRelationship,
          usaFullLegalName: (profile as any).usaFullLegalName,
          usaStreet: (profile as any).usaStreet,
          usaAptUnit: (profile as any).usaAptUnit,
          usaCity: (profile as any).usaCity,
          usaState: (profile as any).usaState,
          usaZipCode: (profile as any).usaZipCode,
          ssnLast4: profile.ssnLast4,
        },
        documents: {
          nidNumber: profile.nidNumber,
          driverLicenseNumber: profile.driverLicenseNumber,
          driverLicenseExpiry: profile.driverLicenseExpiry,
          driverLicenseState: (profile as any).driverLicenseState,
          driverLicenseFrontUrl: (profile as any).driverLicenseFrontUrl,
          driverLicenseBackUrl: (profile as any).driverLicenseBackUrl,
        },
        nycCompliance: isNycDriver ? {
          tlcLicenseNumber: profile.tlcLicenseNumber,
          tlcLicenseFrontUrl: profile.tlcLicenseFrontUrl,
          tlcLicenseBackUrl: profile.tlcLicenseBackUrl,
          tlcLicenseExpiry: profile.tlcLicenseExpiry,
          fhvLicenseNumber: (profile as any).fhvLicenseNumber,
          fhvDocumentUrl: (profile as any).fhvDocumentUrl,
          dmvInspectionDate: vehicle?.dmvInspectionDate,
          dmvInspectionExpiry: vehicle?.dmvInspectionExpiry,
          dmvInspectionImageUrl: vehicle?.dmvInspectionImageUrl,
        } : null,
        vehicleInfo: vehicle ? {
          id: vehicle.id,
          vehicleType: vehicle.vehicleType,
          vehicleMake: vehicle.make,
          vehicleModel: vehicle.vehicleModel,
          vehiclePlate: vehicle.vehiclePlate,
          vehicleColor: vehicle.color,
          vehicleYear: vehicle.year?.toString(),
          registrationDocumentUrl: vehicle.registrationDocumentUrl,
          insuranceDocumentUrl: vehicle.insuranceDocumentUrl,
          insurancePolicyNumber: vehicle.insurancePolicyNumber,
        } : null,
        createdAt: profile.createdAt,
      },
    });
  } catch (error) {
    console.error('[Partner Registration] Error fetching driver status:', error);
    return res.status(500).json({ error: 'Failed to fetch registration status' });
  }
});

router.post('/partner-driver/registration/submit', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { driverProfile: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validatedData = nestedDriverRegistrationSchema.parse(req.body);
    const countryCode = user.countryCode || 'US';
    const isBD = countryCode === 'BD';
    
    const kycValidation = validateNestedDriverKYC(validatedData, countryCode);
    if (!kycValidation.valid) {
      return res.status(400).json({
        error: 'KYC validation failed',
        code: 'KYC_INCOMPLETE',
        details: kycValidation.errors,
      });
    }

    const { personalInfo, vehicleInfo, documents, driverType, nycCompliance } = validatedData;
    const { requiresNycCompliance } = kycValidation;

    const result = await prisma.$transaction(async (tx) => {
      let driverProfile = user.driverProfile;

      const profileData = {
        driverType,
        phoneNumber: personalInfo.phone,
        dateOfBirth: new Date(personalInfo.dateOfBirth),
        emergencyContactName: personalInfo.emergencyContactName,
        emergencyContactPhone: personalInfo.emergencyContactPhone,
        emergencyContactRelationship: personalInfo.emergencyContactRelationship || null,
        fatherName: personalInfo.fatherName || null,
        presentAddress: personalInfo.presentAddress || null,
        permanentAddress: personalInfo.permanentAddress || null,
        homeAddress: personalInfo.homeAddress || null,
        usaFullLegalName: personalInfo.usaFullLegalName || null,
        usaStreet: personalInfo.usaStreet || null,
        usaAptUnit: personalInfo.usaAptUnit || null,
        usaCity: personalInfo.usaCity || null,
        usaState: personalInfo.usaState || null,
        usaZipCode: personalInfo.usaZipCode || null,
        operatingCity: personalInfo.usaCity || null,
        ssnLast4: personalInfo.ssnLast4 || documents.ssnLast4 || null,
        nidNumber: documents.nidNumber || null,
        driverLicenseNumber: documents.driverLicenseNumber || null,
        driverLicenseExpiry: documents.driverLicenseExpiry ? new Date(documents.driverLicenseExpiry) : null,
        driverLicenseState: documents.driverLicenseState || null,
        driverLicenseFrontUrl: documents.driverLicenseFrontUrl || null,
        driverLicenseBackUrl: documents.driverLicenseBackUrl || null,
        governmentIdType: documents.governmentIdType || null,
        governmentIdLast4: documents.governmentIdLast4 || null,
        hasNycCompliance: requiresNycCompliance,
        tlcLicenseNumber: nycCompliance?.tlcLicenseNumber || null,
        tlcLicenseFrontUrl: nycCompliance?.tlcLicenseFrontUrl || null,
        tlcLicenseBackUrl: nycCompliance?.tlcLicenseBackUrl || null,
        tlcLicenseExpiry: nycCompliance?.tlcLicenseExpiry ? new Date(nycCompliance.tlcLicenseExpiry) : null,
        fhvLicenseNumber: nycCompliance?.fhvLicenseNumber || null,
        fhvDocumentUrl: nycCompliance?.fhvDocumentUrl || null,
        verificationStatus: 'pending',
      };

      if (driverProfile) {
        driverProfile = await tx.driverProfile.update({
          where: { id: driverProfile.id },
          data: profileData,
        });
      } else {
        driverProfile = await tx.driverProfile.create({
          data: {
            id: crypto.randomUUID(),
            userId,
            ...profileData,
            isVerified: false,
          },
        });
      }

      const existingVehicle = await tx.vehicle.findFirst({
        where: { driverId: driverProfile.id, isPrimary: true },
      });

      const vehicleData = {
        vehicleType: vehicleInfo.vehicleType,
        vehicleModel: vehicleInfo.vehicleModel,
        vehiclePlate: vehicleInfo.vehiclePlate,
        make: vehicleInfo.vehicleMake || null,
        color: vehicleInfo.vehicleColor || null,
        year: vehicleInfo.vehicleYear ? parseInt(vehicleInfo.vehicleYear) : null,
        registrationDocumentUrl: vehicleInfo.registrationDocumentUrl || null,
        insuranceDocumentUrl: vehicleInfo.insuranceDocumentUrl || null,
        insurancePolicyNumber: vehicleInfo.insurancePolicyNumber || null,
        dmvInspectionDate: nycCompliance?.dmvInspectionDate ? new Date(nycCompliance.dmvInspectionDate) : null,
        dmvInspectionExpiry: nycCompliance?.dmvInspectionExpiry ? new Date(nycCompliance.dmvInspectionExpiry) : null,
        dmvInspectionImageUrl: nycCompliance?.dmvInspectionImageUrl || null,
      };

      if (existingVehicle) {
        await tx.vehicle.update({
          where: { id: existingVehicle.id },
          data: vehicleData,
        });
      } else {
        await tx.vehicle.create({
          data: {
            id: crypto.randomUUID(),
            driverId: driverProfile.id,
            ...vehicleData,
            isPrimary: true,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      }

      const existingWallet = await tx.driverWallet.findUnique({
        where: { driverId: driverProfile.id },
      });
      if (!existingWallet) {
        await tx.driverWallet.create({
          data: {
            driverId: driverProfile.id,
            balance: 0,
            negativeBalance: 0,
          },
        });
      }

      const pendingRole = driverType === 'delivery' ? 'pending_delivery_driver' : 'pending_driver';
      await tx.user.update({
        where: { id: userId },
        data: { role: pendingRole },
      });

      return { driverProfile, driverType };
    });

    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        actorId: userId,
        actorEmail: user.email || 'unknown',
        actorRole: 'customer',
        actionType: 'DRIVER_REGISTRATION_SUBMITTED',
        entityType: 'driver_profile',
        entityId: result.driverProfile.id,
        description: `Driver registration submitted for ${driverType} driver`,
        metadata: {
          driverType,
          countryCode,
        },
      },
    });

    return res.json({ 
      success: true, 
      profileId: result.driverProfile.id,
      message: isBD 
        ? 'ড্রাইভার আবেদন জমা হয়েছে। অনুমোদনের জন্য অপেক্ষা করুন।'
        : 'Driver application submitted successfully. Please wait for approval.',
      profile: {
        id: result.driverProfile.id,
        driverType: result.driverType,
        verificationStatus: result.driverProfile.verificationStatus,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors,
      });
    }
    console.error('[Partner Registration] Error submitting driver registration:', error);
    return res.status(500).json({ error: 'Failed to submit registration' });
  }
});

router.post('/partner-driver/registration/save-step', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { step, data, driverType } = req.body;
    if (typeof step !== 'number' || !data) {
      return res.status(400).json({ error: 'Invalid step or data' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        driverProfile: {
          include: {
            vehicles: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let profileUpdateData: any = {};
    let vehicleData: any = {};

    if (driverType) {
      profileUpdateData.driverType = driverType;
    }

    if (data.personalInfo) {
      const pi = data.personalInfo;
      if (pi.phone) profileUpdateData.phoneNumber = pi.phone;
      if (pi.dateOfBirth) profileUpdateData.dateOfBirth = new Date(pi.dateOfBirth);
      if (pi.emergencyContactName) profileUpdateData.emergencyContactName = pi.emergencyContactName;
      if (pi.emergencyContactPhone) profileUpdateData.emergencyContactPhone = pi.emergencyContactPhone;
      if (pi.fatherName) profileUpdateData.fatherName = pi.fatherName;
      if (pi.presentAddress) profileUpdateData.presentAddress = pi.presentAddress;
      if (pi.permanentAddress) profileUpdateData.permanentAddress = pi.permanentAddress;
      if (pi.homeAddress) profileUpdateData.homeAddress = pi.homeAddress;
    }

    if (data.documents) {
      const docs = data.documents;
      if (docs.nidNumber) profileUpdateData.nidNumber = docs.nidNumber;
      if (docs.driverLicenseNumber) profileUpdateData.driverLicenseNumber = docs.driverLicenseNumber;
      if (docs.driverLicenseExpiry) profileUpdateData.driverLicenseExpiry = new Date(docs.driverLicenseExpiry);
      if (docs.governmentIdType) profileUpdateData.governmentIdType = docs.governmentIdType;
      if (docs.governmentIdLast4) profileUpdateData.governmentIdLast4 = docs.governmentIdLast4;
      if (docs.ssnLast4) profileUpdateData.ssnLast4 = docs.ssnLast4;
    }

    if (data.vehicleInfo) {
      const vi = data.vehicleInfo;
      if (vi.vehicleType) vehicleData.vehicleType = vi.vehicleType;
      if (vi.vehicleModel) vehicleData.vehicleModel = vi.vehicleModel;
      if (vi.vehiclePlate) vehicleData.vehiclePlate = vi.vehiclePlate;
      if (vi.vehicleMake) vehicleData.make = vi.vehicleMake;
      if (vi.vehicleColor) vehicleData.color = vi.vehicleColor;
      if (vi.vehicleYear) vehicleData.year = parseInt(vi.vehicleYear);
    }

    await prisma.$transaction(async (tx) => {
      let driverProfile = user.driverProfile;

      if (Object.keys(profileUpdateData).length > 0 || !driverProfile) {
        if (driverProfile) {
          await tx.driverProfile.update({
            where: { id: driverProfile.id },
            data: profileUpdateData,
          });
        } else {
          driverProfile = await tx.driverProfile.create({
            data: {
              id: crypto.randomUUID(),
              userId,
              verificationStatus: 'draft',
              ...profileUpdateData,
            },
          });
        }
      }

      if (driverProfile && Object.keys(vehicleData).length > 0) {
        const existingVehicle = user.driverProfile?.vehicles?.[0];
        if (existingVehicle) {
          await tx.vehicle.update({
            where: { id: existingVehicle.id },
            data: vehicleData,
          });
        } else {
          await tx.vehicle.create({
            data: {
              id: crypto.randomUUID(),
              driverId: driverProfile.id,
              isPrimary: true,
              isActive: true,
              updatedAt: new Date(),
              ...vehicleData,
            },
          });
        }
      }
    });

    return res.json({
      success: true,
      message: 'Progress saved',
      step,
    });
  } catch (error) {
    console.error('[Partner Registration] Driver registration save-step error:', error);
    return res.status(500).json({ error: 'Failed to save progress' });
  }
});

router.get('/restaurant/registration/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const restaurantProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        restaurantName: true,
        verificationStatus: true,
        isVerified: true,
        createdAt: true,
      },
    });

    return res.json({ profile: restaurantProfile });
  } catch (error) {
    console.error('[Partner Registration] Error fetching restaurant status:', error);
    return res.status(500).json({ error: 'Failed to fetch registration status' });
  }
});

router.post('/restaurant/registration/submit', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const existingProfile = await prisma.restaurantProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      return res.status(400).json({ 
        error: 'Restaurant profile already exists',
        code: 'PROFILE_EXISTS',
      });
    }

    const validatedData = restaurantRegistrationSchema.parse(req.body);
    
    const kycValidation = validateRestaurantKYC(validatedData);
    if (!kycValidation.valid) {
      return res.status(400).json({
        error: 'KYC validation failed',
        code: 'KYC_INCOMPLETE',
        details: kycValidation.errors,
      });
    }

    const restaurantProfile = await prisma.restaurantProfile.create({
      data: {
        userId,
        restaurantName: validatedData.restaurantName,
        cuisineType: validatedData.cuisineType,
        address: validatedData.address,
        cityCode: validatedData.cityCode,
        countryCode: validatedData.countryCode,
        description: validatedData.description,
        fatherName: validatedData.fatherName,
        presentAddress: validatedData.presentAddress,
        permanentAddress: validatedData.permanentAddress,
        homeAddress: validatedData.homeAddress,
        nidNumber: validatedData.nidNumber,
        governmentIdType: validatedData.governmentIdType,
        governmentIdLast4: validatedData.governmentIdLast4,
        dateOfBirth: new Date(validatedData.dateOfBirth),
        emergencyContactName: validatedData.emergencyContactName,
        emergencyContactPhone: validatedData.emergencyContactPhone,
        businessLicenseNumber: validatedData.businessLicenseNumber,
        verificationStatus: 'pending',
        isVerified: false,
        isActive: false,
      },
    });

    await prisma.restaurantWallet.create({
      data: {
        restaurantId: restaurantProfile.id,
        balance: 0,
        negativeBalance: 0,
      },
    });

    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        actorId: userId,
        actorEmail: user?.email || 'unknown',
        actorRole: 'customer',
        actionType: 'RESTAURANT_REGISTRATION_SUBMITTED',
        entityType: 'restaurant_profile',
        entityId: restaurantProfile.id,
        description: `Restaurant registration submitted: ${validatedData.restaurantName}`,
        metadata: {
          restaurantName: validatedData.restaurantName,
          cuisineType: validatedData.cuisineType,
          countryCode: validatedData.countryCode,
        },
      },
    });

    return res.json({ 
      success: true, 
      profileId: restaurantProfile.id,
      message: 'Restaurant application submitted successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors,
      });
    }
    console.error('[Partner Registration] Error submitting restaurant registration:', error);
    return res.status(500).json({ error: 'Failed to submit registration' });
  }
});

const deliveryDriverInitSchema = z.object({
  vehicleType: z.enum(['bicycle', 'motorbike', 'car', 'walking']),
  services: z.array(z.string()).optional(),
  canRide: z.boolean().optional(),
  canFoodDelivery: z.boolean().optional(),
  canParcelDelivery: z.boolean().optional(),
});

router.post('/partner/delivery-driver/init', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = deliveryDriverInitSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, countryCode: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (driverProfile) {
      await prisma.driverProfile.update({
        where: { userId },
        data: {
          vehicleType: validatedData.vehicleType,
          canRide: validatedData.canRide ?? false,
          canFoodDelivery: validatedData.canFoodDelivery ?? true,
          canParcelDelivery: validatedData.canParcelDelivery ?? true,
          services: validatedData.services ?? ['food_delivery', 'parcel_delivery'],
        },
      });
    } else {
      driverProfile = await prisma.driverProfile.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          country: user.countryCode || 'US',
          vehicleType: validatedData.vehicleType,
          vehicleMake: '',
          vehicleModel: '',
          vehiclePlate: '',
          partnerStatus: 'onboarding',
          canRide: validatedData.canRide ?? false,
          canFoodDelivery: validatedData.canFoodDelivery ?? true,
          canParcelDelivery: validatedData.canParcelDelivery ?? true,
          services: validatedData.services ?? ['food_delivery', 'parcel_delivery'],
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        actorId: userId,
        actorEmail: user.email || 'unknown',
        actorRole: 'customer',
        actionType: 'DELIVERY_DRIVER_INIT',
        entityType: 'driver_profile',
        entityId: driverProfile.id,
        description: `Delivery driver onboarding initiated with vehicle type: ${validatedData.vehicleType}`,
        metadata: {
          vehicleType: validatedData.vehicleType,
          services: validatedData.services,
          canFoodDelivery: validatedData.canFoodDelivery,
          canParcelDelivery: validatedData.canParcelDelivery,
        },
      },
    });

    const nextUrl = `/partner/driver/register?type=delivery&vehicle=${validatedData.vehicleType}`;

    return res.json({
      success: true,
      profileId: driverProfile.id,
      vehicleType: validatedData.vehicleType,
      nextUrl,
      message: 'Delivery driver profile initialized',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors,
      });
    }
    console.error('[Partner Registration] Error initializing delivery driver:', error);
    return res.status(500).json({ error: 'Failed to initialize delivery driver' });
  }
});

// ============================================================
// 7-STEP DELIVERY DRIVER ONBOARDING WIZARD API ROUTES
// ============================================================

// Step 1: Initialize delivery driver onboarding with country selection
const deliveryOnboardingInitSchema = z.object({
  countryCode: z.enum(['BD', 'US']),
});

router.post('/partner/delivery-driver/onboarding/init', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = deliveryOnboardingInitSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let draft = await prisma.deliveryDriverOnboardingDraft.findUnique({
      where: { userId },
    });

    if (draft) {
      draft = await prisma.deliveryDriverOnboardingDraft.update({
        where: { userId },
        data: {
          countryCode: validatedData.countryCode,
          currentStep: 2,
        },
      });
    } else {
      draft = await prisma.deliveryDriverOnboardingDraft.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          countryCode: validatedData.countryCode,
          currentStep: 2,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        actorId: userId,
        actorEmail: user.email || 'unknown',
        actorRole: 'customer',
        actionType: 'DELIVERY_ONBOARDING_INIT',
        entityType: 'delivery_driver_onboarding_draft',
        entityId: draft.id,
        description: `Delivery driver 7-step onboarding initiated for country: ${validatedData.countryCode}`,
        metadata: { countryCode: validatedData.countryCode },
      },
    });

    return res.json({
      success: true,
      draftId: draft.id,
      currentStep: draft.currentStep,
      countryCode: draft.countryCode,
      message: 'Onboarding initialized successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[Delivery Onboarding] Error initializing:', error);
    return res.status(500).json({ error: 'Failed to initialize onboarding' });
  }
});

// Get current draft state
router.get('/partner/delivery-driver/onboarding/draft', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const draft = await prisma.deliveryDriverOnboardingDraft.findUnique({
      where: { userId },
    });

    if (!draft) {
      return res.json({ exists: false, draft: null });
    }

    return res.json({ exists: true, draft });
  } catch (error) {
    console.error('[Delivery Onboarding] Error fetching draft:', error);
    return res.status(500).json({ error: 'Failed to fetch draft' });
  }
});

// Step 2: Personal Info (country-specific)
const personalInfoSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  middleName: z.string().optional(),
  fatherName: z.string().optional(),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  phoneNumber: z.string().min(10, 'Valid phone number required'),
});

router.put('/partner/delivery-driver/onboarding/step/2', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = personalInfoSchema.parse(req.body);

    const draft = await prisma.deliveryDriverOnboardingDraft.update({
      where: { userId },
      data: {
        fullName: validatedData.fullName,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        middleName: validatedData.middleName,
        fatherName: validatedData.fatherName,
        dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : undefined,
        phoneNumber: validatedData.phoneNumber,
        currentStep: 3,
      },
    });

    return res.json({ success: true, currentStep: draft.currentStep });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[Delivery Onboarding] Error saving personal info:', error);
    return res.status(500).json({ error: 'Failed to save personal info' });
  }
});

// Step 3: Address Info (country-specific)
const addressInfoSchema = z.object({
  presentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  homeAddress: z.string().optional(),
  usaStreet: z.string().optional(),
  usaCity: z.string().optional(),
  usaState: z.string().optional(),
  usaZipCode: z.string().optional(),
  usaAptUnit: z.string().optional(),
});

router.put('/partner/delivery-driver/onboarding/step/3', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = addressInfoSchema.parse(req.body);

    const draft = await prisma.deliveryDriverOnboardingDraft.update({
      where: { userId },
      data: {
        presentAddress: validatedData.presentAddress,
        permanentAddress: validatedData.permanentAddress,
        homeAddress: validatedData.homeAddress,
        usaStreet: validatedData.usaStreet,
        usaCity: validatedData.usaCity,
        usaState: validatedData.usaState,
        usaZipCode: validatedData.usaZipCode,
        usaAptUnit: validatedData.usaAptUnit,
        currentStep: 4,
      },
    });

    return res.json({ success: true, currentStep: draft.currentStep });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[Delivery Onboarding] Error saving address info:', error);
    return res.status(500).json({ error: 'Failed to save address info' });
  }
});

// Step 4: Government ID Upload
const governmentIdSchema = z.object({
  nidNumber: z.string().optional(),
  nidFrontImageUrl: z.string().optional(),
  nidBackImageUrl: z.string().optional(),
  governmentIdType: z.string().optional(),
  governmentIdLast4: z.string().max(4).optional(),
  governmentIdFrontUrl: z.string().optional(),
  governmentIdBackUrl: z.string().optional(),
  ssnLast4: z.string().max(4).optional(),
  backgroundCheckConsent: z.boolean().optional(),
});

router.put('/partner/delivery-driver/onboarding/step/4', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = governmentIdSchema.parse(req.body);

    const currentDraft = await prisma.deliveryDriverOnboardingDraft.findUnique({
      where: { userId },
      select: { countryCode: true },
    });

    const nextStep = currentDraft?.countryCode === 'US' ? 5 : 6;

    const draft = await prisma.deliveryDriverOnboardingDraft.update({
      where: { userId },
      data: {
        nidNumber: validatedData.nidNumber,
        nidFrontImageUrl: validatedData.nidFrontImageUrl,
        nidBackImageUrl: validatedData.nidBackImageUrl,
        governmentIdType: validatedData.governmentIdType,
        governmentIdLast4: validatedData.governmentIdLast4,
        governmentIdFrontUrl: validatedData.governmentIdFrontUrl,
        governmentIdBackUrl: validatedData.governmentIdBackUrl,
        ssnLast4: validatedData.ssnLast4,
        backgroundCheckConsent: validatedData.backgroundCheckConsent ?? false,
        currentStep: nextStep,
      },
    });

    return res.json({ success: true, currentStep: draft.currentStep });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[Delivery Onboarding] Error saving government ID:', error);
    return res.status(500).json({ error: 'Failed to save government ID' });
  }
});

// Step 5: Delivery Method (US only)
const deliveryMethodSchema = z.object({
  deliveryMethod: z.enum(['car', 'bike', 'walking']),
});

router.put('/partner/delivery-driver/onboarding/step/5', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = deliveryMethodSchema.parse(req.body);
    const nextStep = validatedData.deliveryMethod === 'car' ? 6 : 7;

    const draft = await prisma.deliveryDriverOnboardingDraft.update({
      where: { userId },
      data: {
        deliveryMethod: validatedData.deliveryMethod,
        currentStep: nextStep,
      },
    });

    return res.json({ success: true, currentStep: draft.currentStep, skipVehicleDocs: validatedData.deliveryMethod !== 'car' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[Delivery Onboarding] Error saving delivery method:', error);
    return res.status(500).json({ error: 'Failed to save delivery method' });
  }
});

// Step 6: Vehicle Documents (car only, or BD drivers)
const vehicleDocsSchema = z.object({
  drivingLicenseNumber: z.string().optional(),
  drivingLicenseFrontUrl: z.string().optional(),
  drivingLicenseBackUrl: z.string().optional(),
  drivingLicenseExpiry: z.string().optional(),
  vehicleRegistrationUrl: z.string().optional(),
  insuranceCardUrl: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleYear: z.number().optional(),
  vehiclePlate: z.string().optional(),
  vehicleColor: z.string().optional(),
});

router.put('/partner/delivery-driver/onboarding/step/6', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = vehicleDocsSchema.parse(req.body);

    const draft = await prisma.deliveryDriverOnboardingDraft.update({
      where: { userId },
      data: {
        drivingLicenseNumber: validatedData.drivingLicenseNumber,
        drivingLicenseFrontUrl: validatedData.drivingLicenseFrontUrl,
        drivingLicenseBackUrl: validatedData.drivingLicenseBackUrl,
        drivingLicenseExpiry: validatedData.drivingLicenseExpiry ? new Date(validatedData.drivingLicenseExpiry) : undefined,
        vehicleRegistrationUrl: validatedData.vehicleRegistrationUrl,
        insuranceCardUrl: validatedData.insuranceCardUrl,
        vehicleMake: validatedData.vehicleMake,
        vehicleModel: validatedData.vehicleModel,
        vehicleYear: validatedData.vehicleYear,
        vehiclePlate: validatedData.vehiclePlate,
        vehicleColor: validatedData.vehicleColor,
        currentStep: 7,
      },
    });

    return res.json({ success: true, currentStep: draft.currentStep });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[Delivery Onboarding] Error saving vehicle docs:', error);
    return res.status(500).json({ error: 'Failed to save vehicle documents' });
  }
});

// Step 7: Final Review and Submit
const finalReviewSchema = z.object({
  profilePhotoUrl: z.string().min(1, 'Profile photo is required'),
  emergencyContactName: z.string().min(2, 'Emergency contact name required'),
  emergencyContactPhone: z.string().min(7, 'Emergency contact phone required'),
  emergencyContactRelationship: z.string().optional(),
});

router.post('/partner/delivery-driver/onboarding/submit', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = finalReviewSchema.parse(req.body);

    const draft = await prisma.deliveryDriverOnboardingDraft.findUnique({
      where: { userId },
    });

    if (!draft) {
      return res.status(404).json({ error: 'Onboarding draft not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    let driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    const profileData = {
      driverType: 'delivery',
      country: draft.countryCode,
      fullName: draft.fullName,
      firstName: draft.firstName,
      lastName: draft.lastName,
      middleName: draft.middleName,
      fatherName: draft.fatherName,
      dateOfBirth: draft.dateOfBirth,
      phoneNumber: draft.phoneNumber,
      presentAddress: draft.presentAddress,
      permanentAddress: draft.permanentAddress,
      homeAddress: draft.homeAddress,
      usaStreet: draft.usaStreet,
      usaCity: draft.usaCity,
      usaState: draft.usaState,
      usaZipCode: draft.usaZipCode,
      usaAptUnit: draft.usaAptUnit,
      nidNumber: draft.nidNumber,
      nidFrontImageUrl: draft.nidFrontImageUrl,
      nidBackImageUrl: draft.nidBackImageUrl,
      governmentIdType: draft.governmentIdType,
      governmentIdLast4: draft.governmentIdLast4,
      governmentIdFrontImageUrl: draft.governmentIdFrontUrl,
      governmentIdBackImageUrl: draft.governmentIdBackUrl,
      ssnLast4: draft.ssnLast4,
      backgroundCheckConsent: draft.backgroundCheckConsent,
      deliveryDriverMethod: draft.deliveryMethod,
      driverLicenseNumber: draft.drivingLicenseNumber,
      driverLicenseFrontUrl: draft.drivingLicenseFrontUrl,
      driverLicenseBackUrl: draft.drivingLicenseBackUrl,
      driverLicenseExpiry: draft.drivingLicenseExpiry,
      vehicleRegistrationUrl: draft.vehicleRegistrationUrl,
      insuranceCardUrl: draft.insuranceCardUrl,
      vehicleMake: draft.vehicleMake,
      vehicleModel: draft.vehicleModel,
      vehiclePlate: draft.vehiclePlate,
      vehicleType: draft.deliveryMethod || 'bicycle',
      profilePhotoUrl: validatedData.profilePhotoUrl,
      emergencyContactName: validatedData.emergencyContactName,
      emergencyContactPhone: validatedData.emergencyContactPhone,
      emergencyContactRelationship: validatedData.emergencyContactRelationship,
      verificationStatus: 'pending',
      isVerified: false,
      partnerStatus: 'pending_verification',
      canRide: false,
      canFoodDelivery: true,
      canParcelDelivery: true,
      services: ['food_delivery', 'parcel_delivery'],
      onboardingStep: 7,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
    };

    if (driverProfile) {
      driverProfile = await prisma.driverProfile.update({
        where: { userId },
        data: profileData,
      });
    } else {
      driverProfile = await prisma.driverProfile.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          ...profileData,
        },
      });
    }

    await prisma.deliveryDriverOnboardingDraft.update({
      where: { userId },
      data: {
        isSubmitted: true,
        submittedAt: new Date(),
        profilePhotoUrl: validatedData.profilePhotoUrl,
        emergencyContactName: validatedData.emergencyContactName,
        emergencyContactPhone: validatedData.emergencyContactPhone,
        emergencyContactRelationship: validatedData.emergencyContactRelationship,
      },
    });

    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        actorId: userId,
        actorEmail: user?.email || 'unknown',
        actorRole: 'customer',
        actionType: 'DELIVERY_DRIVER_SUBMIT',
        entityType: 'driver_profile',
        entityId: driverProfile.id,
        description: `Delivery driver 7-step onboarding completed - pending verification`,
        metadata: {
          countryCode: draft.countryCode,
          deliveryMethod: draft.deliveryMethod,
          verificationStatus: 'pending',
        },
      },
    });

    return res.json({
      success: true,
      profileId: driverProfile.id,
      verificationStatus: 'pending',
      message: 'Application submitted successfully. Pending admin verification.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[Delivery Onboarding] Error submitting application:', error);
    return res.status(500).json({ error: 'Failed to submit application' });
  }
});

// =====================================
// ADMIN: Delivery Driver Management
// =====================================

router.get('/admin/delivery-drivers', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.userId },
      select: { role: true },
    });

    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const status = req.query.status as string || 'pending';
    const countryFilter = req.query.countryFilter as string;

    let whereCondition: any = {
      driverType: 'delivery',
    };

    switch (status) {
      case 'pending':
        whereCondition.verificationStatus = 'pending';
        whereCondition.isBlocked = false;
        break;
      case 'verified':
        whereCondition.isVerified = true;
        whereCondition.isBlocked = false;
        break;
      case 'rejected':
        whereCondition.verificationStatus = 'rejected';
        whereCondition.isBlocked = false;
        break;
      case 'blocked':
        whereCondition.isBlocked = true;
        break;
    }

    if (countryFilter && countryFilter !== 'all') {
      whereCondition.country = countryFilter;
    }

    const drivers = await prisma.driverProfile.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            countryCode: true,
            isBlocked: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedDrivers = drivers.map((d) => ({
      id: d.id,
      userId: d.userId,
      email: d.user?.email || '',
      countryCode: d.country || d.user?.countryCode || 'US',
      verificationStatus: d.verificationStatus,
      isVerified: d.isVerified,
      isSuspended: d.isSuspended,
      isBlocked: d.isBlocked || d.user?.isBlocked,
      fullName: d.fullName,
      fatherName: d.fatherName,
      phoneNumber: d.phoneNumber,
      dateOfBirth: d.dateOfBirth,
      presentAddress: d.presentAddress,
      permanentAddress: d.permanentAddress,
      usaStreet: d.usaStreet,
      usaCity: d.usaCity,
      usaState: d.usaState,
      usaZipCode: d.usaZipCode,
      nidNumber: d.nidNumber,
      nidFrontImageUrl: d.nidFrontImageUrl,
      nidBackImageUrl: d.nidBackImageUrl,
      governmentIdType: d.governmentIdType,
      governmentIdLast4: d.governmentIdLast4,
      governmentIdFrontImageUrl: d.governmentIdFrontImageUrl,
      governmentIdBackImageUrl: d.governmentIdBackImageUrl,
      ssnLast4: d.ssnLast4,
      backgroundCheckConsent: d.backgroundCheckConsent,
      deliveryDriverMethod: d.deliveryDriverMethod || d.vehicleType,
      driverLicenseNumber: d.driverLicenseNumber,
      driverLicenseFrontUrl: d.driverLicenseFrontUrl,
      driverLicenseBackUrl: d.driverLicenseBackUrl,
      driverLicenseExpiry: d.driverLicenseExpiry,
      vehicleRegistrationUrl: d.vehicleRegistrationUrl,
      insuranceCardUrl: d.insuranceCardUrl,
      vehicleMake: d.vehicleMake,
      vehicleModel: d.vehicleModel,
      vehiclePlate: d.vehiclePlate,
      profilePhotoUrl: d.profilePhotoUrl,
      emergencyContactName: d.emergencyContactName,
      emergencyContactPhone: d.emergencyContactPhone,
      emergencyContactRelationship: d.emergencyContactRelationship,
      rejectionReason: d.rejectionReason,
      onboardingCompletedAt: d.onboardingCompletedAt,
      walletBalance: '0.00',
      negativeBalance: '0.00',
    }));

    return res.json({ drivers: formattedDrivers });
  } catch (error) {
    console.error('[Admin] Error fetching delivery drivers:', error);
    return res.status(500).json({ error: 'Failed to fetch delivery drivers' });
  }
});

router.post('/admin/delivery-drivers/:id/approve', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const adminUser = await prisma.user.findUnique({
      where: { id: req.user?.userId },
      select: { id: true, email: true, role: true },
    });

    if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const driverId = req.params.id;

    const driver = await prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        verificationStatus: 'approved',
        isVerified: true,
        partnerStatus: 'active',
        verifiedAt: new Date(),
        verifiedBy: adminUser.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorRole: adminUser.role,
        actionType: 'DELIVERY_DRIVER_APPROVED',
        entityType: 'driver_profile',
        entityId: driverId,
        description: `Delivery driver ${driver.fullName} approved by admin`,
        metadata: {
          driverName: driver.fullName,
          countryCode: driver.country,
          deliveryMethod: driver.deliveryDriverMethod,
        },
      },
    });

    return res.json({ success: true, message: 'Driver approved successfully' });
  } catch (error) {
    console.error('[Admin] Error approving driver:', error);
    return res.status(500).json({ error: 'Failed to approve driver' });
  }
});

router.post('/admin/delivery-drivers/:id/reject', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const adminUser = await prisma.user.findUnique({
      where: { id: req.user?.userId },
      select: { id: true, email: true, role: true },
    });

    if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const driverId = req.params.id;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const driver = await prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        verificationStatus: 'rejected',
        isVerified: false,
        partnerStatus: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date(),
        rejectedBy: adminUser.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorRole: adminUser.role,
        actionType: 'DELIVERY_DRIVER_REJECTED',
        entityType: 'driver_profile',
        entityId: driverId,
        description: `Delivery driver ${driver.fullName} rejected: ${reason}`,
        metadata: {
          driverName: driver.fullName,
          countryCode: driver.country,
          rejectionReason: reason,
        },
      },
    });

    return res.json({ success: true, message: 'Driver rejected' });
  } catch (error) {
    console.error('[Admin] Error rejecting driver:', error);
    return res.status(500).json({ error: 'Failed to reject driver' });
  }
});

router.post('/admin/delivery-drivers/:id/block', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const adminUser = await prisma.user.findUnique({
      where: { id: req.user?.userId },
      select: { id: true, email: true, role: true },
    });

    if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const driverId = req.params.id;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Block reason is required' });
    }

    const driver = await prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        isBlocked: true,
        blockedReason: reason,
        blockedAt: new Date(),
        blockedBy: adminUser.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorRole: adminUser.role,
        actionType: 'DELIVERY_DRIVER_BLOCKED',
        entityType: 'driver_profile',
        entityId: driverId,
        description: `Delivery driver ${driver.fullName} blocked: ${reason}`,
        metadata: {
          driverName: driver.fullName,
          countryCode: driver.country,
          blockReason: reason,
        },
      },
    });

    return res.json({ success: true, message: 'Driver blocked' });
  } catch (error) {
    console.error('[Admin] Error blocking driver:', error);
    return res.status(500).json({ error: 'Failed to block driver' });
  }
});

router.post('/admin/delivery-drivers/:id/unblock', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const adminUser = await prisma.user.findUnique({
      where: { id: req.user?.userId },
      select: { id: true, email: true, role: true },
    });

    if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const driverId = req.params.id;

    const driver = await prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        isBlocked: false,
        blockedReason: null,
        blockedAt: null,
        blockedBy: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorRole: adminUser.role,
        actionType: 'DELIVERY_DRIVER_UNBLOCKED',
        entityType: 'driver_profile',
        entityId: driverId,
        description: `Delivery driver ${driver.fullName} unblocked`,
        metadata: {
          driverName: driver.fullName,
          countryCode: driver.country,
        },
      },
    });

    return res.json({ success: true, message: 'Driver unblocked' });
  } catch (error) {
    console.error('[Admin] Error unblocking driver:', error);
    return res.status(500).json({ error: 'Failed to unblock driver' });
  }
});

router.post('/delivery-driver/onboarding/upload', authenticateToken, (req: AuthRequest, res: Response) => {
  uploadOnboardingDocument(req, res, async (err) => {
    if (err) {
      console.error('[Onboarding Upload] Error:', err.message);
      if (err.message.includes('File too large')) {
        return res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
      }
      if (err.message.includes('Invalid file type')) {
        return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, WebP, and PDF files are allowed.' });
      }
      return res.status(500).json({ error: 'Failed to upload file' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const fileUrl = getFileUrl(req.file.filename);
      const documentType = req.body.documentType || 'general';

      console.log(`[Onboarding Upload] User ${userId} uploaded ${documentType}: ${fileUrl}`);

      return res.json({
        success: true,
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        documentType,
      });
    } catch (error) {
      console.error('[Onboarding Upload] Processing error:', error);
      return res.status(500).json({ error: 'Failed to process upload' });
    }
  });
});

export default router;
