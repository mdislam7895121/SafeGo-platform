import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Real HTTPS URLs for restaurants (high-quality food photography)
const restaurantImages = {
  "pizza-nyc@demo.com": {
    logo: "https://images.unsplash.com/photo-1605521209259-cd751b6b6d6d?w=200&h=200&fit=crop",
    cover: "https://images.unsplash.com/photo-1566407982369-f6951ff1ff23?w=600&h=300&fit=crop",
  },
  "sushi-nyc@demo.com": {
    logo: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=200&h=200&fit=crop",
    cover: "https://images.unsplash.com/photo-1553621042-f6e147245ba1?w=600&h=300&fit=crop",
  },
  "burger-sf@demo.com": {
    logo: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=200&fit=crop",
    cover: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=300&fit=crop",
  },
  "mexican-sf@demo.com": {
    logo: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=200&h=200&fit=crop",
    cover: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&h=300&fit=crop",
  },
  "biryani-dhk@demo.com": {
    logo: "https://images.unsplash.com/photo-1585937421612-e0aa8b93fdd0?w=200&h=200&fit=crop",
    cover: "https://images.unsplash.com/photo-1585937421612-e0aa8b93fdd0?w=600&h=300&fit=crop",
  },
  "curry-dhk@demo.com": {
    logo: "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=200&h=200&fit=crop",
    cover: "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=600&h=300&fit=crop",
  },
};

// Real HTTPS URLs for menu items
const menuItemImages: Record<string, string> = {
  "Margherita Pizza": "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=300&h=300&fit=crop",
  "Pepperoni Pizza": "https://images.unsplash.com/photo-1628840042765-356cda07f757?w=300&h=300&fit=crop",
  "Veggie Supreme": "https://images.unsplash.com/photo-1511949860663-2c3ee58b3999?w=300&h=300&fit=crop",
  "Garlic Bread": "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=300&h=300&fit=crop",
  "Mozzarella Sticks": "https://images.unsplash.com/photo-1585937421612-e0aa8b93fdd0?w=300&h=300&fit=crop",
  "Coke": "https://images.unsplash.com/photo-1554866585-c4db21afc23a?w=300&h=300&fit=crop",
  "Lemonade": "https://images.unsplash.com/photo-1510812431401-41d2cab2707d?w=300&h=300&fit=crop",
  "California Roll": "https://images.unsplash.com/photo-1553621042-f6e147245ba1?w=300&h=300&fit=crop",
  "Spicy Tuna Roll": "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300&h=300&fit=crop",
  "Dragon Roll": "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300&h=300&fit=crop",
  "Edamame": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=300&fit=crop",
  "Gyoza": "https://images.unsplash.com/photo-1496785871519-3135dbba9e27?w=300&h=300&fit=crop",
  "Classic Cheeseburger": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=300&fit=crop",
  "Bacon BBQ Burger": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=300&fit=crop",
  "Veggie Burger": "https://images.unsplash.com/photo-1585238341710-4dd0de130125?w=300&h=300&fit=crop",
  "French Fries": "https://images.unsplash.com/photo-1573080496104-febf75cf11e1?w=300&h=300&fit=crop",
  "Onion Rings": "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=300&h=300&fit=crop",
  "Carne Asada Taco": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=300&h=300&fit=crop",
  "Chicken Taco": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=300&h=300&fit=crop",
  "Fish Taco": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=300&h=300&fit=crop",
  "Super Burrito": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=300&h=300&fit=crop",
  "Vegetarian Burrito": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=300&h=300&fit=crop",
  "Chicken Biryani": "https://images.unsplash.com/photo-1585937421612-e0aa8b93fdd0?w=300&h=300&fit=crop",
  "Mutton Biryani": "https://images.unsplash.com/photo-1585937421612-e0aa8b93fdd0?w=300&h=300&fit=crop",
  "Vegetable Biryani": "https://images.unsplash.com/photo-1585937421612-e0aa8b93fdd0?w=300&h=300&fit=crop",
  "Chicken Tikka": "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=300&h=300&fit=crop",
  "Seekh Kebab": "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=300&h=300&fit=crop",
  "Lassi": "https://images.unsplash.com/photo-1488477181946-6428a0291840?w=300&h=300&fit=crop",
  "Masala Chai": "https://images.unsplash.com/photo-1597318045949-76a45c1e2e15?w=300&h=300&fit=crop",
  "Butter Chicken": "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=300&h=300&fit=crop",
  "Lamb Rogan Josh": "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=300&h=300&fit=crop",
  "Paneer Tikka Masala": "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=300&h=300&fit=crop",
  "Naan": "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=300&h=300&fit=crop",
  "Garlic Naan": "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=300&h=300&fit=crop",
  "Roti": "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=300&h=300&fit=crop",
};

async function fixDemoImages() {
  console.log("\n🖼️  Fixing demo restaurant images with real HTTPS URLs...\n");

  for (const [email, images] of Object.entries(restaurantImages)) {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        console.log(`  ⚠️  User not found: ${email}`);
        continue;
      }

      const restaurant = await prisma.restaurantProfile.findUnique({
        where: { userId: user.id },
      });
      if (!restaurant) {
        console.log(`  ⚠️  Restaurant not found for: ${email}`);
        continue;
      }

      const existingBranding = await prisma.restaurantBranding.findUnique({
        where: { restaurantId: restaurant.id },
      });

      if (existingBranding) {
        await prisma.restaurantBranding.update({
          where: { restaurantId: restaurant.id },
          data: {
            logoUrl: images.logo,
            coverPhotoUrl: images.cover,
          },
        });
        console.log(`  ✓ Fixed branding for: ${restaurant.restaurantName}`);
      } else {
        await prisma.restaurantBranding.create({
          data: {
            restaurantId: restaurant.id,
            logoUrl: images.logo,
            coverPhotoUrl: images.cover,
          },
        });
        console.log(`  ✓ Created branding for: ${restaurant.restaurantName}`);
      }
    } catch (error: any) {
      console.error(`  ✗ Error updating ${email}: ${error.message}`);
    }
  }

  console.log("\n🍔 Fixing demo menu item images with real HTTPS URLs...\n");

  for (const [itemName, imageUrl] of Object.entries(menuItemImages)) {
    try {
      const result = await prisma.menuItem.updateMany({
        where: {
          name: itemName,
          isDemo: true,
        },
        data: {
          itemImageUrl: imageUrl,
        },
      });

      if (result.count > 0) {
        console.log(`  ✓ Fixed image for: ${itemName} (${result.count} items)`);
      } else {
        console.log(`  ⚠️  No demo items found for: ${itemName}`);
      }
    } catch (error: any) {
      console.error(`  ✗ Error updating ${itemName}: ${error.message}`);
    }
  }

  console.log("\n✅ Demo images fixed with real HTTPS URLs!\n");
}

fixDemoImages()
  .catch((error) => {
    console.error("Fix failed:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
