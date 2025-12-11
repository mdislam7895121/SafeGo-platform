/**
 * SafeGo AI Recommendation Engine
 * Personalized suggestions for rides, food, shop items, rentals, tickets
 */

import { prisma } from '../../db';

export interface RecommendationContext {
  customerId: string;
  countryCode?: string;
  cityCode?: string;
  currentLat?: number;
  currentLng?: number;
  timeOfDay?: number;
  dayOfWeek?: number;
}

export interface Recommendation {
  id: string;
  type: 'ride' | 'food' | 'restaurant' | 'shop_item' | 'shop' | 'rental' | 'ticket';
  entityId: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  score: number;
  reason: string;
  metadata?: Record<string, any>;
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  generatedAt: Date;
  contextUsed: Record<string, any>;
  modelVersion: string;
}

interface CustomerHistory {
  recentRides: any[];
  recentFoodOrders: any[];
  recentShopOrders: any[];
  favoriteRestaurants: string[];
  frequentLocations: { lat: number; lng: number; count: number }[];
  averageOrderValue: number;
  preferredCuisines: string[];
  orderTimePatterns: { hour: number; count: number }[];
}

export class RecommendationEngine {
  private static instance: RecommendationEngine;
  private modelVersion: string = 'v1.0.0';

  private constructor() {}

  public static getInstance(): RecommendationEngine {
    if (!RecommendationEngine.instance) {
      RecommendationEngine.instance = new RecommendationEngine();
    }
    return RecommendationEngine.instance;
  }

  async getRecommendations(
    context: RecommendationContext,
    types: Recommendation['type'][] = ['ride', 'food', 'restaurant'],
    limit: number = 10
  ): Promise<RecommendationResult> {
    const history = await this.getCustomerHistory(context.customerId);
    const recommendations: Recommendation[] = [];

    for (const type of types) {
      const typeRecommendations = await this.getRecommendationsByType(
        type,
        context,
        history,
        Math.ceil(limit / types.length)
      );
      recommendations.push(...typeRecommendations);
    }

    recommendations.sort((a, b) => b.score - a.score);

    const result: RecommendationResult = {
      recommendations: recommendations.slice(0, limit),
      generatedAt: new Date(),
      contextUsed: {
        customerId: context.customerId,
        timeOfDay: context.timeOfDay || new Date().getHours(),
        historyDepth: history.recentRides.length + history.recentFoodOrders.length,
      },
      modelVersion: this.modelVersion,
    };

    await this.logRecommendations(context.customerId, result);

    return result;
  }

  private async getCustomerHistory(customerId: string): Promise<CustomerHistory> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [recentRides, recentFoodOrders, recentShopOrders, favorites] = await Promise.all([
      prisma.ride.findMany({
        where: {
          customerId,
          createdAt: { gte: thirtyDaysAgo },
          status: 'completed',
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.foodOrder.findMany({
        where: {
          customerId,
          createdAt: { gte: thirtyDaysAgo },
          status: 'delivered',
        },
        include: { restaurant: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.productOrder.findMany({
        where: {
          customerId,
          createdAt: { gte: thirtyDaysAgo },
          status: 'delivered',
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.foodRestaurantFavorite.findMany({
        where: { customerProfileId: customerId },
      }),
    ]);

    const cuisineCounts: Record<string, number> = {};
    recentFoodOrders.forEach(order => {
      const cuisine = order.restaurant?.cuisineType || 'other';
      cuisineCounts[cuisine] = (cuisineCounts[cuisine] || 0) + 1;
    });

    const preferredCuisines = Object.entries(cuisineCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cuisine]) => cuisine);

    const locationCounts: Map<string, { lat: number; lng: number; count: number }> = new Map();
    recentRides.forEach(ride => {
      if (ride.dropoffLat && ride.dropoffLng) {
        const key = `${Math.round(ride.dropoffLat * 100)},${Math.round(ride.dropoffLng * 100)}`;
        const existing = locationCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          locationCounts.set(key, {
            lat: ride.dropoffLat,
            lng: ride.dropoffLng,
            count: 1,
          });
        }
      }
    });

    const frequentLocations = Array.from(locationCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const allOrders = [...recentFoodOrders, ...recentShopOrders];
    const averageOrderValue = allOrders.length > 0
      ? allOrders.reduce((sum, order) => sum + Number(order.serviceFare || 0), 0) / allOrders.length
      : 0;

    const hourCounts: Record<number, number> = {};
    recentFoodOrders.forEach(order => {
      const hour = new Date(order.createdAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const orderTimePatterns = Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count);

    return {
      recentRides,
      recentFoodOrders,
      recentShopOrders,
      favoriteRestaurants: favorites.map(f => f.restaurantId),
      frequentLocations,
      averageOrderValue,
      preferredCuisines,
      orderTimePatterns,
    };
  }

  private async getRecommendationsByType(
    type: Recommendation['type'],
    context: RecommendationContext,
    history: CustomerHistory,
    limit: number
  ): Promise<Recommendation[]> {
    switch (type) {
      case 'ride':
        return this.getRideRecommendations(context, history, limit);
      case 'food':
      case 'restaurant':
        return this.getFoodRecommendations(context, history, limit);
      case 'shop_item':
      case 'shop':
        return this.getShopRecommendations(context, history, limit);
      case 'rental':
        return this.getRentalRecommendations(context, history, limit);
      case 'ticket':
        return this.getTicketRecommendations(context, history, limit);
      default:
        return [];
    }
  }

  private async getRideRecommendations(
    context: RecommendationContext,
    history: CustomerHistory,
    limit: number
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    for (const location of history.frequentLocations.slice(0, limit)) {
      recommendations.push({
        id: `ride-${location.lat}-${location.lng}`,
        type: 'ride',
        entityId: '',
        title: 'Frequent Destination',
        subtitle: `Visited ${location.count} times recently`,
        score: 0.7 + (location.count * 0.05),
        reason: 'Based on your frequent destinations',
        metadata: { lat: location.lat, lng: location.lng },
      });
    }

    return recommendations;
  }

  private async getFoodRecommendations(
    context: RecommendationContext,
    history: CustomerHistory,
    limit: number
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const currentHour = context.timeOfDay ?? new Date().getHours();

    const restaurants = await prisma.restaurantProfile.findMany({
      where: {
        isVerified: true,
        isActive: true,
        ...(context.countryCode ? { countryCode: context.countryCode } : {}),
        ...(history.preferredCuisines.length > 0 ? {
          cuisineType: { in: history.preferredCuisines },
        } : {}),
      },
      orderBy: { averageRating: 'desc' },
      take: limit * 2,
    });

    for (const restaurant of restaurants) {
      let score = 0.5;

      if (history.favoriteRestaurants.includes(restaurant.id)) {
        score += 0.3;
      }

      if (history.preferredCuisines.includes(restaurant.cuisineType || '')) {
        score += 0.2;
      }

      score += (restaurant.averageRating || 0) * 0.1;

      if (currentHour >= 11 && currentHour <= 14) {
        score += 0.1;
      } else if (currentHour >= 18 && currentHour <= 21) {
        score += 0.15;
      }

      recommendations.push({
        id: `restaurant-${restaurant.id}`,
        type: 'restaurant',
        entityId: restaurant.id,
        title: restaurant.restaurantName,
        subtitle: restaurant.cuisineType || 'Various cuisines',
        score: Math.min(score, 1.0),
        reason: this.generateFoodReason(history, restaurant),
        metadata: {
          rating: restaurant.averageRating,
          cuisineType: restaurant.cuisineType,
        },
      });
    }

    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private generateFoodReason(history: CustomerHistory, restaurant: any): string {
    if (history.favoriteRestaurants.includes(restaurant.id)) {
      return 'One of your favorite restaurants';
    }
    if (history.preferredCuisines.includes(restaurant.cuisineType)) {
      return `Based on your love for ${restaurant.cuisineType}`;
    }
    if (restaurant.averageRating >= 4.5) {
      return 'Highly rated in your area';
    }
    return 'Popular choice nearby';
  }

  private async getShopRecommendations(
    context: RecommendationContext,
    history: CustomerHistory,
    limit: number
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    const shops = await prisma.shopPartnerProfile.findMany({
      where: {
        isVerified: true,
        isSuspended: false,
      },
      take: limit,
    });

    for (const shop of shops) {
      recommendations.push({
        id: `shop-${shop.id}`,
        type: 'shop',
        entityId: shop.id,
        title: shop.shopName,
        subtitle: shop.shopType || 'General Store',
        score: 0.6,
        reason: 'Shop available in your area',
        metadata: { shopType: shop.shopType },
      });
    }

    return recommendations;
  }

  private async getRentalRecommendations(
    context: RecommendationContext,
    history: CustomerHistory,
    limit: number
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    const rentals = await prisma.rentalListing.findMany({
      where: {
        isActive: true,
        isAvailable: true,
      },
      take: limit,
    });

    for (const rental of rentals) {
      recommendations.push({
        id: `rental-${rental.id}`,
        type: 'rental',
        entityId: rental.id,
        title: rental.vehicleName,
        subtitle: `${rental.vehicleType} - ${rental.dailyRate}/day`,
        score: 0.5,
        reason: 'Available rental in your area',
        metadata: {
          vehicleType: rental.vehicleType,
          dailyRate: rental.dailyRate,
        },
      });
    }

    return recommendations;
  }

  private async getTicketRecommendations(
    context: RecommendationContext,
    history: CustomerHistory,
    limit: number
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    const tickets = await prisma.ticketListing.findMany({
      where: {
        isActive: true,
        departureTime: { gte: new Date() },
      },
      orderBy: { departureTime: 'asc' },
      take: limit,
    });

    for (const ticket of tickets) {
      recommendations.push({
        id: `ticket-${ticket.id}`,
        type: 'ticket',
        entityId: ticket.id,
        title: `${ticket.fromLocation} → ${ticket.toLocation}`,
        subtitle: `${ticket.transportType} - ${ticket.price}`,
        score: 0.5,
        reason: 'Upcoming departure',
        metadata: {
          transportType: ticket.transportType,
          departureTime: ticket.departureTime,
        },
      });
    }

    return recommendations;
  }

  private async logRecommendations(
    customerId: string,
    result: RecommendationResult
  ): Promise<void> {
    try {
      await prisma.automationLog.create({
        data: {
          automationType: 'recommendation',
          entityType: 'customer',
          entityId: customerId,
          status: 'generated',
          metadata: {
            count: result.recommendations.length,
            types: [...new Set(result.recommendations.map(r => r.type))],
            modelVersion: result.modelVersion,
          },
        },
      });
    } catch (error) {
      console.error('[RecommendationEngine] Failed to log recommendations:', error);
    }
  }

  async trackRecommendationClick(
    customerId: string,
    recommendationId: string,
    type: string
  ): Promise<void> {
    try {
      await prisma.automationLog.create({
        data: {
          automationType: 'recommendation',
          entityType: 'click',
          entityId: recommendationId,
          status: 'clicked',
          metadata: { customerId, type },
        },
      });
    } catch (error) {
      console.error('[RecommendationEngine] Failed to track click:', error);
    }
  }

  async trackRecommendationConversion(
    customerId: string,
    recommendationId: string,
    orderId: string
  ): Promise<void> {
    try {
      await prisma.automationLog.create({
        data: {
          automationType: 'recommendation',
          entityType: 'conversion',
          entityId: recommendationId,
          status: 'converted',
          metadata: { customerId, orderId },
        },
      });
    } catch (error) {
      console.error('[RecommendationEngine] Failed to track conversion:', error);
    }
  }
}

export const recommendationEngine = RecommendationEngine.getInstance();
