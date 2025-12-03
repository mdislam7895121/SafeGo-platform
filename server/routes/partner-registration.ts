import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

const baseDriverSchema = z.object({
  driverType: z.enum(['ride', 'delivery']),
  countryCode: z.enum(['BD', 'US']),
  phone: z.string().min(10, 'Phone number required'),
  dateOfBirth: z.string().min(1, 'Date of birth required'),
  emergencyContactName: z.string().min(2, 'Emergency contact required'),
  emergencyContactPhone: z.string().min(10, 'Emergency phone required'),
  vehicleType: z.string().min(1, 'Vehicle type required'),
  vehicleModel: z.string().min(1, 'Vehicle model required'),
  vehiclePlate: z.string().min(1, 'Vehicle plate required'),
  vehicleYear: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleColor: z.string().optional(),
  payoutMethod: z.string().min(1, 'Payout method required'),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  mfsProvider: z.string().optional(),
  mfsNumber: z.string().optional(),
  fatherName: z.string().optional(),
  presentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  homeAddress: z.string().optional(),
  nidNumber: z.string().optional(),
  driverLicenseNumber: z.string().optional(),
  driverLicenseExpiry: z.string().optional(),
  governmentIdType: z.string().optional(),
  governmentIdLast4: z.string().optional(),
  ssnLast4: z.string().optional(),
});

function validateDriverKYC(data: z.infer<typeof baseDriverSchema>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (data.countryCode === 'BD') {
    if (!data.nidNumber || data.nidNumber.length < 10) {
      errors.push('NID number is required for Bangladesh drivers (minimum 10 digits)');
    }
    if (!data.fatherName || data.fatherName.length < 2) {
      errors.push('Father\'s name is required for Bangladesh drivers');
    }
    if (!data.presentAddress || data.presentAddress.length < 5) {
      errors.push('Present address is required for Bangladesh drivers');
    }
    if (data.payoutMethod === 'mfs' && (!data.mfsProvider || !data.mfsNumber)) {
      errors.push('MFS provider and number required for mobile money payout');
    }
  } else if (data.countryCode === 'US') {
    if (!data.driverLicenseNumber || data.driverLicenseNumber.length < 5) {
      errors.push('Driver license number is required for US drivers');
    }
    if (data.driverType === 'ride' && !data.driverLicenseExpiry) {
      errors.push('Driver license expiry is required for US ride drivers');
    }
    if (data.payoutMethod === 'bank' && (!data.bankName || !data.accountNumber || !data.routingNumber)) {
      errors.push('Bank details required for bank transfer payout');
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

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        verificationStatus: true,
        isVerified: true,
        createdAt: true,
      },
    });

    return res.json({ profile: driverProfile });
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

    const existingProfile = await prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      return res.status(400).json({ 
        error: 'Driver profile already exists',
        code: 'PROFILE_EXISTS',
      });
    }

    const validatedData = baseDriverSchema.parse(req.body);
    
    const kycValidation = validateDriverKYC(validatedData);
    if (!kycValidation.valid) {
      return res.status(400).json({
        error: 'KYC validation failed',
        code: 'KYC_INCOMPLETE',
        details: kycValidation.errors,
      });
    }

    const driverProfile = await prisma.driverProfile.create({
      data: {
        userId,
        fatherName: validatedData.fatherName,
        presentAddress: validatedData.presentAddress,
        permanentAddress: validatedData.permanentAddress,
        homeAddress: validatedData.homeAddress,
        nidNumber: validatedData.nidNumber,
        driverLicenseNumber: validatedData.driverLicenseNumber,
        driverLicenseExpiry: validatedData.driverLicenseExpiry ? new Date(validatedData.driverLicenseExpiry) : undefined,
        governmentIdType: validatedData.governmentIdType,
        governmentIdLast4: validatedData.governmentIdLast4,
        ssnLast4: validatedData.ssnLast4,
        dateOfBirth: new Date(validatedData.dateOfBirth),
        emergencyContactName: validatedData.emergencyContactName,
        emergencyContactPhone: validatedData.emergencyContactPhone,
        verificationStatus: 'pending',
        isVerified: false,
      },
    });

    await prisma.vehicle.create({
      data: {
        driverId: driverProfile.id,
        vehicleType: validatedData.vehicleType,
        vehicleModel: `${validatedData.vehicleMake || ''} ${validatedData.vehicleModel}`.trim(),
        vehiclePlate: validatedData.vehiclePlate,
        isPrimary: true,
        status: 'PENDING',
      },
    });

    await prisma.driverWallet.create({
      data: {
        driverId: driverProfile.id,
        balance: 0,
        negativeBalance: 0,
      },
    });

    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        actorId: userId,
        actorEmail: req.user?.email || 'unknown',
        actorRole: 'customer',
        actionType: 'DRIVER_REGISTRATION_SUBMITTED',
        entityType: 'driver_profile',
        entityId: driverProfile.id,
        description: `Driver registration submitted for ${validatedData.driverType} driver`,
        metadata: {
          driverType: validatedData.driverType,
          countryCode: validatedData.countryCode,
        },
      },
    });

    return res.json({ 
      success: true, 
      profileId: driverProfile.id,
      message: 'Driver application submitted successfully',
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
        actorEmail: req.user?.email || 'unknown',
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
