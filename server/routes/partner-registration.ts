import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

const nestedDriverRegistrationSchema = z.object({
  driverType: z.enum(['ride', 'delivery']).default('ride'),
  personalInfo: z.object({
    phone: z.string().min(10, 'Phone number is required'),
    dateOfBirth: z.string().min(1, 'Date of birth is required'),
    emergencyContactName: z.string().min(2, 'Emergency contact name required'),
    emergencyContactPhone: z.string().min(10, 'Emergency contact phone required'),
    fatherName: z.string().optional(),
    presentAddress: z.string().optional(),
    permanentAddress: z.string().optional(),
    homeAddress: z.string().optional(),
  }),
  vehicleInfo: z.object({
    vehicleType: z.string().min(1, 'Vehicle type required'),
    vehicleModel: z.string().min(1, 'Vehicle model required'),
    vehiclePlate: z.string().min(1, 'Vehicle plate required'),
    vehicleYear: z.string().optional(),
    vehicleMake: z.string().optional(),
    vehicleColor: z.string().optional(),
  }),
  documents: z.object({
    nidNumber: z.string().optional(),
    driverLicenseNumber: z.string().optional(),
    driverLicenseExpiry: z.string().optional(),
    governmentIdType: z.string().optional(),
    governmentIdLast4: z.string().optional(),
    ssnLast4: z.string().optional(),
    nidFrontImageUrl: z.string().optional(),
    nidBackImageUrl: z.string().optional(),
    licenseImageUrl: z.string().optional(),
  }),
});

function validateNestedDriverKYC(data: z.infer<typeof nestedDriverRegistrationSchema>, countryCode: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { personalInfo, documents } = data;
  
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
    if (!documents.driverLicenseNumber || documents.driverLicenseNumber.length < 5) {
      errors.push('Driver license number is required for US drivers');
    }
    if (data.driverType === 'ride' && !documents.driverLicenseExpiry) {
      errors.push('Driver license expiry is required for US ride drivers');
    }
  }
  
  return { valid: errors.length === 0, errors };
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

router.get('/driver/registration/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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

    return res.json({
      profile: {
        id: profile.id,
        driverType,
        verificationStatus: profile.verificationStatus,
        isVerified: profile.isVerified,
        personalInfo: {
          phone: profile.phoneNumber,
          dateOfBirth: profile.dateOfBirth,
          fatherName: profile.fatherName,
          presentAddress: profile.presentAddress,
          permanentAddress: profile.permanentAddress,
          homeAddress: profile.homeAddress,
          emergencyContactName: profile.emergencyContactName,
          emergencyContactPhone: profile.emergencyContactPhone,
        },
        documents: {
          nidNumber: profile.nidNumber,
          driverLicenseNumber: profile.driverLicenseNumber,
          driverLicenseExpiry: profile.driverLicenseExpiry,
        },
        vehicleInfo: vehicle ? {
          id: vehicle.id,
          vehicleType: vehicle.vehicleType,
          vehicleMake: vehicle.make,
          vehicleModel: vehicle.vehicleModel,
          vehiclePlate: vehicle.vehiclePlate,
          vehicleColor: vehicle.color,
          vehicleYear: vehicle.year?.toString(),
        } : null,
        createdAt: profile.createdAt,
      },
    });
  } catch (error) {
    console.error('[Partner Registration] Error fetching driver status:', error);
    return res.status(500).json({ error: 'Failed to fetch registration status' });
  }
});

router.post('/driver/registration/submit', authenticateToken, async (req: AuthRequest, res: Response) => {
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

    const { personalInfo, vehicleInfo, documents, driverType } = validatedData;

    const result = await prisma.$transaction(async (tx) => {
      let driverProfile = user.driverProfile;

      if (driverProfile) {
        driverProfile = await tx.driverProfile.update({
          where: { id: driverProfile.id },
          data: {
            driverType,
            phoneNumber: personalInfo.phone,
            dateOfBirth: new Date(personalInfo.dateOfBirth),
            emergencyContactName: personalInfo.emergencyContactName,
            emergencyContactPhone: personalInfo.emergencyContactPhone,
            fatherName: personalInfo.fatherName || null,
            presentAddress: personalInfo.presentAddress || null,
            permanentAddress: personalInfo.permanentAddress || null,
            homeAddress: personalInfo.homeAddress || null,
            nidNumber: documents.nidNumber || null,
            driverLicenseNumber: documents.driverLicenseNumber || null,
            driverLicenseExpiry: documents.driverLicenseExpiry ? new Date(documents.driverLicenseExpiry) : null,
            ssnLast4: documents.ssnLast4 || null,
            governmentIdType: documents.governmentIdType || null,
            governmentIdLast4: documents.governmentIdLast4 || null,
            verificationStatus: 'pending',
          },
        });
      } else {
        driverProfile = await tx.driverProfile.create({
          data: {
            id: crypto.randomUUID(),
            userId,
            driverType,
            phoneNumber: personalInfo.phone,
            dateOfBirth: new Date(personalInfo.dateOfBirth),
            emergencyContactName: personalInfo.emergencyContactName,
            emergencyContactPhone: personalInfo.emergencyContactPhone,
            fatherName: personalInfo.fatherName || null,
            presentAddress: personalInfo.presentAddress || null,
            permanentAddress: personalInfo.permanentAddress || null,
            homeAddress: personalInfo.homeAddress || null,
            nidNumber: documents.nidNumber || null,
            driverLicenseNumber: documents.driverLicenseNumber || null,
            driverLicenseExpiry: documents.driverLicenseExpiry ? new Date(documents.driverLicenseExpiry) : null,
            ssnLast4: documents.ssnLast4 || null,
            governmentIdType: documents.governmentIdType || null,
            governmentIdLast4: documents.governmentIdLast4 || null,
            verificationStatus: 'pending',
            isVerified: false,
          },
        });
      }

      const existingVehicle = await tx.vehicle.findFirst({
        where: { driverId: driverProfile.id, isPrimary: true },
      });

      if (existingVehicle) {
        await tx.vehicle.update({
          where: { id: existingVehicle.id },
          data: {
            vehicleType: vehicleInfo.vehicleType,
            vehicleModel: vehicleInfo.vehicleModel,
            vehiclePlate: vehicleInfo.vehiclePlate,
            make: vehicleInfo.vehicleMake || null,
            color: vehicleInfo.vehicleColor || null,
            year: vehicleInfo.vehicleYear ? parseInt(vehicleInfo.vehicleYear) : null,
          },
        });
      } else {
        await tx.vehicle.create({
          data: {
            id: crypto.randomUUID(),
            driverId: driverProfile.id,
            vehicleType: vehicleInfo.vehicleType,
            vehicleModel: vehicleInfo.vehicleModel,
            vehiclePlate: vehicleInfo.vehiclePlate,
            make: vehicleInfo.vehicleMake || null,
            color: vehicleInfo.vehicleColor || null,
            year: vehicleInfo.vehicleYear ? parseInt(vehicleInfo.vehicleYear) : null,
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

router.post('/driver/registration/save-step', authenticateToken, async (req: AuthRequest, res: Response) => {
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

export default router;
