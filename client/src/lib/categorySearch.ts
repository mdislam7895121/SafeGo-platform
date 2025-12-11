/**
 * Category Search Utility
 * Provides client-side filtering for menu categories and subcategories
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

export interface FilteredCategory {
  category: Category;
  subcategories: SubCategory[];
  matchedCategory: boolean;
  matchedSubcategories: Set<string>;
}

/**
 * Filters categories and subcategories based on search query
 * @param query - Search string
 * @param categories - Array of main categories
 * @param subcategories - Array of all subcategories
 * @returns Filtered results with match information
 */
export function filterCategories(
  query: string,
  categories: Category[],
  subcategories: SubCategory[]
): FilteredCategory[] {
  if (!query || query.trim().length === 0) {
    return categories.map(cat => ({
      category: cat,
      subcategories: subcategories.filter(sub => sub.categoryId === cat.id),
      matchedCategory: false,
      matchedSubcategories: new Set(),
    }));
  }

  const searchTerm = query.trim().toLowerCase();
  const results: FilteredCategory[] = [];

  for (const category of categories) {
    const categoryMatches = category.name.toLowerCase().includes(searchTerm);
    const categorySubcategories = subcategories.filter(
      sub => sub.categoryId === category.id
    );

    const matchedSubcategoryIds = new Set<string>();
    const filteredSubcategories: SubCategory[] = [];

    for (const subcategory of categorySubcategories) {
      const subcategoryMatches = subcategory.name.toLowerCase().includes(searchTerm);
      
      if (categoryMatches || subcategoryMatches) {
        filteredSubcategories.push(subcategory);
        if (subcategoryMatches) {
          matchedSubcategoryIds.add(subcategory.id);
        }
      }
    }

    if (categoryMatches || filteredSubcategories.length > 0) {
      results.push({
        category,
        subcategories: filteredSubcategories,
        matchedCategory: categoryMatches,
        matchedSubcategories: matchedSubcategoryIds,
      });
    }
  }

  return results;
}

/**
 * Highlights matching text in a string
 * @param text - Original text
 * @param query - Search query to highlight
 * @returns Object with parts array for rendering
 */
export function highlightMatch(text: string, query: string): { parts: Array<{ text: string; highlight: boolean }> } {
  if (!query || query.trim().length === 0) {
    return { parts: [{ text, highlight: false }] };
  }

  const searchTerm = query.trim().toLowerCase();
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(searchTerm);

  if (index === -1) {
    return { parts: [{ text, highlight: false }] };
  }

  const parts = [];
  if (index > 0) {
    parts.push({ text: text.substring(0, index), highlight: false });
  }
  parts.push({ text: text.substring(index, index + searchTerm.length), highlight: true });
  if (index + searchTerm.length < text.length) {
    parts.push({ text: text.substring(index + searchTerm.length), highlight: false });
  }

  return { parts };
}
