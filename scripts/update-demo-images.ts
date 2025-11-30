import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASE_PATH = "/attached_assets/stock_images";

const restaurantImages = {
  "pizza-nyc@demo.com": {
    logo: `${BASE_PATH}/pizza_restaurant_log_4ebe32ac.jpg`,
    cover: `${BASE_PATH}/italian_pizzeria_res_da132bc0.jpg`,
  },
  "sushi-nyc@demo.com": {
    logo: `${BASE_PATH}/sushi_restaurant_log_d0725ee0.jpg`,
    cover: `${BASE_PATH}/japanese_sushi_resta_be630904.jpg`,
  },
  "burger-sf@demo.com": {
    logo: `${BASE_PATH}/burger_restaurant_lo_b31136ce.jpg`,
    cover: `${BASE_PATH}/american_burger_rest_1ff44af7.jpg`,
  },
  "mexican-sf@demo.com": {
    logo: `${BASE_PATH}/taco_mexican_food_lo_8670bc01.jpg`,
    cover: `${BASE_PATH}/mexican_taco_restaur_c0d5fb39.jpg`,
  },
  "biryani-dhk@demo.com": {
    logo: `${BASE_PATH}/indian_restaurant_lo_e339b808.jpg`,
    cover: `${BASE_PATH}/indian_biryani_resta_ff5f6183.jpg`,
  },
  "curry-dhk@demo.com": {
    logo: `${BASE_PATH}/indian_restaurant_lo_e339b808.jpg`,
    cover: `${BASE_PATH}/indian_curry_restaur_90b44af3.jpg`,
  },
};

const menuItemImages: Record<string, string> = {
  "Margherita Pizza": `${BASE_PATH}/pizza_food_photograp_b436669a.jpg`,
  "Pepperoni Pizza": `${BASE_PATH}/pepperoni_pizza,_del_462f04f4.jpg`,
  "Veggie Supreme": `${BASE_PATH}/vegetable_pizza,_veg_019653ae.jpg`,
  "Garlic Bread": `${BASE_PATH}/garlic_bread_appetiz_fbc7ae18.jpg`,
  "Mozzarella Sticks": `${BASE_PATH}/mozzarella_sticks_fr_729134e7.jpg`,
  "Coke": `${BASE_PATH}/coca_cola_glass_with_be00ba76.jpg`,
  "Lemonade": `${BASE_PATH}/fresh_lemonade_glass_6ec577ab.jpg`,
  "California Roll": `${BASE_PATH}/california_roll_sush_60df4ec4.jpg`,
  "Spicy Tuna Roll": `${BASE_PATH}/spicy_tuna_sushi_rol_e95ac690.jpg`,
  "Dragon Roll": `${BASE_PATH}/dragon_roll_sushi,_e_fbe64816.jpg`,
  "Edamame": `${BASE_PATH}/edamame_soybeans_jap_3bdbddcd.jpg`,
  "Gyoza": `${BASE_PATH}/gyoza_dumplings_japa_7ea77fb7.jpg`,
  "Classic Cheeseburger": `${BASE_PATH}/gourmet_cheeseburger_861671d8.jpg`,
  "Bacon BBQ Burger": `${BASE_PATH}/bacon_bbq_burger_wit_2bce26e3.jpg`,
  "Veggie Burger": `${BASE_PATH}/veggie_burger_with_a_35b5d796.jpg`,
  "French Fries": `${BASE_PATH}/french_fries_golden__76716ec2.jpg`,
  "Onion Rings": `${BASE_PATH}/onion_rings_appetize_cf6ef8c1.jpg`,
  "Carne Asada Taco": `${BASE_PATH}/carne_asada_taco_mex_e0a435a3.jpg`,
  "Chicken Taco": `${BASE_PATH}/chicken_taco_with_ch_78f6b654.jpg`,
  "Fish Taco": `${BASE_PATH}/fish_taco_with_cabba_6ce01151.jpg`,
  "Super Burrito": `${BASE_PATH}/burrito_mexican_food_36dcf3b7.jpg`,
  "Vegetarian Burrito": `${BASE_PATH}/vegetarian_burrito_b_c89f8ed4.jpg`,
  "Chicken Biryani": `${BASE_PATH}/chicken_biryani_indi_0d4711a5.jpg`,
  "Mutton Biryani": `${BASE_PATH}/mutton_biryani_aroma_7bb37d8c.jpg`,
  "Vegetable Biryani": `${BASE_PATH}/vegetable_biryani_co_57484799.jpg`,
  "Chicken Tikka": `${BASE_PATH}/chicken_tikka_grille_4c36fa15.jpg`,
  "Seekh Kebab": `${BASE_PATH}/seekh_kebab_grilled__8990f7ef.jpg`,
  "Lassi": `${BASE_PATH}/mango_lassi_yogurt_d_f50fe23e.jpg`,
  "Masala Chai": `${BASE_PATH}/masala_chai_spiced_t_c0dbed93.jpg`,
  "Butter Chicken": `${BASE_PATH}/butter_chicken_cream_4571bd1c.jpg`,
  "Lamb Rogan Josh": `${BASE_PATH}/lamb_rogan_josh_curr_ecc818d0.jpg`,
  "Paneer Tikka Masala": `${BASE_PATH}/paneer_tikka_masala__416ba763.jpg`,
  "Naan": `${BASE_PATH}/naan_bread_indian_fl_2f568f1c.jpg`,
  "Garlic Naan": `${BASE_PATH}/garlic_naan_butter_b_456c0760.jpg`,
  "Roti": `${BASE_PATH}/roti_whole_wheat_ind_9235a964.jpg`,
};

async function updateDemoImages() {
  console.log("\n🖼️  Updating demo restaurant images...\n");

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
        console.log(`  ✓ Updated branding for: ${restaurant.restaurantName}`);
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

  console.log("\n🍔 Updating demo menu item images...\n");

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
        console.log(`  ✓ Updated image for: ${itemName} (${result.count} items)`);
      } else {
        console.log(`  ⚠️  No items found for: ${itemName}`);
      }
    } catch (error: any) {
      console.error(`  ✗ Error updating ${itemName}: ${error.message}`);
    }
  }

  console.log("\n✅ Demo images updated successfully!\n");
}

updateDemoImages()
  .catch((error) => {
    console.error("Update failed:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
