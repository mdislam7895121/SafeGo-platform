/**
 * Category Auto-Suggest Engine
 * Suggests categories and subcategories based on menu item title and description
 */

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface SubCategory {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
}

export interface CategorySuggestion {
  category: Category | null;
  subcategories: SubCategory[];
  confidence: 'high' | 'medium' | 'low' | 'none';
}

/**
 * Keyword mappings for food categories
 * Maps keywords/synonyms to category slugs
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // Burgers
  'burgers': ['burger', 'cheeseburger', 'hamburger', 'patty', 'patty melt', 'slider'],
  
  // Pizza
  'pizza': ['pizza', 'margherita', 'pepperoni', 'cheese pizza', 'thin crust', 'deep dish', 'flatbread'],
  
  // Pasta
  'pasta': ['pasta', 'spaghetti', 'penne', 'fettuccine', 'linguine', 'ravioli', 'lasagna', 'mac and cheese', 'macaroni'],
  
  // Rice dishes
  'rice-dishes': ['biryani', 'biriyani', 'pulao', 'pilaf', 'fried rice', 'risotto', 'rice bowl'],
  
  // Chicken
  'chicken': ['chicken', 'grilled chicken', 'fried chicken', 'chicken wings', 'chicken breast', 'roast chicken', 'poultry'],
  
  // Seafood
  'seafood': ['fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'crab', 'lobster', 'seafood', 'shellfish'],
  
  // Sandwiches
  'sandwiches': ['sandwich', 'sub', 'hoagie', 'wrap', 'panini', 'club sandwich', 'blt'],
  
  // Salads
  'salads': ['salad', 'caesar salad', 'greek salad', 'garden salad', 'cobb salad', 'greens'],
  
  // Soups
  'soups': ['soup', 'broth', 'chowder', 'bisque', 'stew', 'minestrone', 'tomato soup'],
  
  // Desserts
  'desserts': ['cake', 'ice cream', 'pie', 'cookie', 'brownie', 'cheesecake', 'pudding', 'tiramisu', 'mousse', 'sweet'],
  
  // Beverages
  'beverages': ['drink', 'juice', 'smoothie', 'shake', 'coffee', 'tea', 'latte', 'cappuccino', 'soda', 'cola'],
  
  // Breakfast
  'breakfast': ['pancake', 'waffle', 'omelette', 'eggs', 'bacon', 'sausage', 'french toast', 'bagel', 'muffin', 'cereal'],
  
  // Appetizers
  'appetizers': ['appetizer', 'starter', 'finger food', 'nachos', 'wings', 'mozzarella sticks', 'spring roll', 'samosa'],
  
  // Tacos
  'tacos': ['taco', 'burrito', 'quesadilla', 'enchilada', 'fajita', 'tortilla'],
  
  // Curry
  'curries': ['curry', 'masala', 'tikka', 'vindaloo', 'korma', 'dal', 'dhal'],
  
  // Noodles
  'noodles': ['noodles', 'ramen', 'lo mein', 'chow mein', 'pad thai', 'udon', 'soba'],
  
  // Steaks
  'steaks-grills': ['steak', 'ribeye', 'sirloin', 't-bone', 'filet', 'grilled', 'barbecue', 'bbq'],
  
  // Vegetarian
  'vegetarian': ['vegan', 'vegetarian', 'tofu', 'tempeh', 'plant-based', 'veggie'],
  
  // Sides
  'sides': ['fries', 'french fries', 'onion rings', 'coleslaw', 'mashed potatoes', 'side dish'],
};

/**
 * Tokenizes text into searchable keywords
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

/**
 * Scores how well keywords match a category
 */
function scoreCategoryMatch(tokens: string[], categorySlug: string): number {
  const keywords = CATEGORY_KEYWORDS[categorySlug] || [];
  let score = 0;

  for (const token of tokens) {
    for (const keyword of keywords) {
      if (keyword.includes(token) || token.includes(keyword)) {
        score += keyword === token ? 2 : 1;
      }
    }
  }

  return score;
}

/**
 * Scores how well keywords match a subcategory
 */
function scoreSubcategoryMatch(tokens: string[], subcategory: SubCategory): number {
  let score = 0;
  const subcatTokens = tokenize(subcategory.name);

  for (const token of tokens) {
    for (const subcatToken of subcatTokens) {
      if (subcatToken.includes(token) || token.includes(subcatToken)) {
        score += subcatToken === token ? 2 : 1;
      }
    }
  }

  return score;
}

/**
 * Suggests category and subcategories based on item title and description
 * @param title - Menu item title
 * @param description - Menu item description (optional)
 * @param categories - Available categories
 * @param subcategories - Available subcategories
 * @returns Suggestion with confidence level
 */
export function suggestCategory(
  title: string,
  description: string,
  categories: Category[],
  subcategories: SubCategory[]
): CategorySuggestion {
  const text = `${title} ${description || ''}`.trim();
  if (!text || text.length < 3) {
    return { category: null, subcategories: [], confidence: 'none' };
  }

  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return { category: null, subcategories: [], confidence: 'none' };
  }

  // Score all categories
  const categoryScores = categories.map(category => ({
    category,
    score: scoreCategoryMatch(tokens, category.slug),
  }));

  // Find best matching category
  categoryScores.sort((a, b) => b.score - a.score);
  const bestCategory = categoryScores[0];

  if (bestCategory.score === 0) {
    return { category: null, subcategories: [], confidence: 'none' };
  }

  // Score subcategories for the best matching category
  const categorySubcategories = subcategories.filter(
    sub => sub.categoryId === bestCategory.category.id
  );

  const subcategoryScores = categorySubcategories.map(subcategory => ({
    subcategory,
    score: scoreSubcategoryMatch(tokens, subcategory),
  }));

  subcategoryScores.sort((a, b) => b.score - a.score);

  // Take top 3 subcategories with non-zero scores
  const suggestedSubcategories = subcategoryScores
    .filter(s => s.score > 0)
    .slice(0, 3)
    .map(s => s.subcategory);

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';
  if (bestCategory.score >= 4) {
    confidence = 'high';
  } else if (bestCategory.score >= 2) {
    confidence = 'medium';
  } else if (bestCategory.score > 0) {
    confidence = 'low';
  }

  return {
    category: confidence !== 'none' ? bestCategory.category : null,
    subcategories: suggestedSubcategories,
    confidence,
  };
}
