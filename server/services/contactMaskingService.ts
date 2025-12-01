import { prisma } from '../db';

export interface MaskedContact {
  maskedPhone: string;
  maskedEmail?: string;
  canViewFull: boolean;
}

export class ContactMaskingService {
  private static instance: ContactMaskingService;

  static getInstance(): ContactMaskingService {
    if (!this.instance) {
      this.instance = new ContactMaskingService();
    }
    return this.instance;
  }

  maskPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber || phoneNumber.length < 6) {
      return '***';
    }

    const cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.length <= 4) {
      return '***';
    }

    if (phoneNumber.startsWith('+880')) {
      const lastTwo = cleaned.slice(-2);
      return `+880******${lastTwo}`;
    }

    if (phoneNumber.startsWith('+1')) {
      const areaCode = cleaned.slice(1, 4);
      const lastTwo = cleaned.slice(-2);
      return `+1-${areaCode}-***-**${lastTwo}`;
    }

    const countryCode = cleaned.slice(0, Math.min(3, cleaned.length - 4));
    const lastTwo = cleaned.slice(-2);
    const maskedMiddle = '*'.repeat(Math.max(cleaned.length - countryCode.length - 2, 3));
    
    return `+${countryCode}${maskedMiddle}${lastTwo}`;
  }

  maskEmail(email: string): string {
    if (!email || !email.includes('@')) {
      return '***@***.***';
    }

    const [local, domain] = email.split('@');
    
    let maskedLocal: string;
    if (local.length <= 2) {
      maskedLocal = '*'.repeat(local.length);
    } else {
      maskedLocal = local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
    }

    const domainParts = domain.split('.');
    let maskedDomain: string;
    if (domainParts.length > 1) {
      const domainName = domainParts[0];
      const tld = domainParts.slice(1).join('.');
      maskedDomain = domainName[0] + '*'.repeat(Math.max(domainName.length - 1, 1)) + '.' + tld;
    } else {
      maskedDomain = domain[0] + '*'.repeat(domain.length - 1);
    }

    return `${maskedLocal}@${maskedDomain}`;
  }

  async getMaskedUserContact(
    userId: string,
    requesterId: string,
    requesterRole: string
  ): Promise<MaskedContact> {
    const canViewFull = this.canViewFullContact(requesterRole);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
      select: { phone: true }
    });

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId },
      select: { phone: true }
    });

    const phone = customerProfile?.phone || driverProfile?.phone || '';
    const email = user?.email || '';

    if (canViewFull) {
      return {
        maskedPhone: phone,
        maskedEmail: email,
        canViewFull: true
      };
    }

    return {
      maskedPhone: this.maskPhoneNumber(phone),
      maskedEmail: this.maskEmail(email),
      canViewFull: false
    };
  }

  canViewFullContact(role: string): boolean {
    const adminRoles = [
      'admin',
      'super_admin',
      'SUPER_ADMIN',
      'support_admin',
      'SUPPORT_ADMIN',
      'compliance_admin',
      'COMPLIANCE_ADMIN'
    ];
    return adminRoles.includes(role);
  }

  async getMaskedContactForRide(
    rideId: string,
    requesterId: string,
    requesterRole: string
  ): Promise<{ customer: MaskedContact; driver?: MaskedContact }> {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: {
        customerId: true,
        driverId: true,
        customer: {
          select: { userId: true }
        },
        driver: {
          select: { userId: true }
        }
      }
    });

    if (!ride) {
      throw new Error('Ride not found');
    }

    const customerContact = await this.getMaskedUserContact(
      ride.customer.userId,
      requesterId,
      requesterRole
    );

    let driverContact: MaskedContact | undefined;
    if (ride.driver) {
      driverContact = await this.getMaskedUserContact(
        ride.driver.userId,
        requesterId,
        requesterRole
      );
    }

    return {
      customer: customerContact,
      driver: driverContact
    };
  }

  async getMaskedContactForFoodOrder(
    orderId: string,
    requesterId: string,
    requesterRole: string
  ): Promise<{ customer: MaskedContact; driver?: MaskedContact; restaurant: MaskedContact }> {
    const order = await prisma.foodOrder.findUnique({
      where: { id: orderId },
      select: {
        customerId: true,
        driverId: true,
        restaurantId: true,
        customer: {
          select: { userId: true }
        },
        driver: {
          select: { userId: true }
        },
        restaurant: {
          select: { userId: true, contactPhone: true }
        }
      }
    });

    if (!order) {
      throw new Error('Food order not found');
    }

    const customerContact = await this.getMaskedUserContact(
      order.customer.userId,
      requesterId,
      requesterRole
    );

    let driverContact: MaskedContact | undefined;
    if (order.driver) {
      driverContact = await this.getMaskedUserContact(
        order.driver.userId,
        requesterId,
        requesterRole
      );
    }

    const canViewFull = this.canViewFullContact(requesterRole);
    const restaurantPhone = order.restaurant.contactPhone || '';
    const restaurantContact: MaskedContact = {
      maskedPhone: canViewFull ? restaurantPhone : this.maskPhoneNumber(restaurantPhone),
      canViewFull
    };

    return {
      customer: customerContact,
      driver: driverContact,
      restaurant: restaurantContact
    };
  }
}

export const contactMaskingService = ContactMaskingService.getInstance();
