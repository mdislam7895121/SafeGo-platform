export interface CategoryConfig {
  [mainCategory: string]: string[];
}

export const MENU_CATEGORIES: CategoryConfig = {
  "Burgers": [
    "Beef Burger",
    "Chicken Burger",
    "Veggie Burger",
    "Cheeseburger",
    "Double Patty",
    "Sliders"
  ],
  "Pizza": [
    "Margherita",
    "Pepperoni",
    "Meat Lovers",
    "Veggie Pizza",
    "Cheese Lovers",
    "Thin Crust",
    "Deep Dish"
  ],
  "Fried Chicken": [
    "Chicken Wings",
    "Chicken Strips",
    "Spicy Fried Chicken",
    "Family Bucket"
  ],
  "Rice & Curry": [
    "Plain Rice",
    "Fried Rice",
    "Chicken Curry",
    "Beef Curry",
    "Vegetable Curry"
  ],
  "Biryani & Polao": [
    "Chicken Biryani",
    "Mutton Biryani",
    "Beef Biryani",
    "Kacchi Biryani",
    "Polao Set"
  ],
  "Noodles & Pasta": [
    "Chow Mein",
    "Hakka Noodles",
    "Stir-fry Noodles",
    "White Sauce Pasta",
    "Red Sauce Pasta"
  ],
  "Breakfast": [
    "Paratha Set",
    "Bread & Omelette",
    "Pancakes",
    "Sandwich Breakfast"
  ],
  "Snacks & Appetizers": [
    "French Fries",
    "Wedges",
    "Nuggets",
    "Spring Rolls",
    "Samosa"
  ],
  "Beverages": [
    "Soft Drinks (Can/Bottle)",
    "Bottled Water",
    "Energy Drink",
    "Iced Tea"
  ],
  "Hot Drinks": [
    "Milk Tea",
    "Black Tea",
    "Coffee",
    "Hot Chocolate"
  ],
  "Cold Drinks & Juice": [
    "Fresh Juice",
    "Lassi",
    "Smoothies",
    "Milkshake"
  ],
  "Desserts & Ice Cream": [
    "Ice Cream Scoop",
    "Sundae",
    "Cake Slice",
    "Brownie",
    "Custard / Pudding"
  ],
  "Combos & Meal Deals": [
    "Burger Combo",
    "Rice Combo",
    "Family Meal",
    "Kids Combo"
  ],
  "Kids Menu": [
    "Kids Burger",
    "Kids Nuggets Meal",
    "Kids Pasta"
  ],
  "Vegetarian": [
    "Veg Burger",
    "Veg Pizza",
    "Veg Rice Bowl",
    "Veg Curry"
  ],
  "Vegan": [
    "Vegan Burger",
    "Vegan Salad",
    "Vegan Bowl"
  ],
  "Halal Specials": [
    "Halal Chicken Menu",
    "Halal Beef Menu",
    "Halal Combo"
  ]
};

// Helper function to get all main categories
export const getMainCategories = (): string[] => {
  return Object.keys(MENU_CATEGORIES);
};

// Helper function to get subcategories for a main category
export const getSubCategories = (mainCategory: string): string[] => {
  return MENU_CATEGORIES[mainCategory] || [];
};
