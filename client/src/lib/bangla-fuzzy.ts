const BANGLA_CHAR_MAP: Record<string, string[]> = {
  "চ": ["চ", "ছ"],
  "ছ": ["চ", "ছ"],
  "জ": ["জ", "য"],
  "য": ["জ", "য"],
  "শ": ["শ", "স", "ষ"],
  "স": ["শ", "স", "ষ"],
  "ষ": ["শ", "স", "ষ"],
  "ন": ["ন", "ণ"],
  "ণ": ["ন", "ণ"],
  "র": ["র", "ড়"],
  "ড়": ["র", "ড়"],
  "ত": ["ত", "ৎ"],
  "ৎ": ["ত", "ৎ"],
  "ব": ["ব", "ভ"],
  "ভ": ["ব", "ভ"],
  "দ": ["দ", "ধ"],
  "ধ": ["দ", "ধ"],
  "ড": ["ড", "ঢ"],
  "ঢ": ["ড", "ঢ"],
  "ট": ["ট", "ঠ"],
  "ঠ": ["ট", "ঠ"],
  "প": ["প", "ফ"],
  "ফ": ["প", "ফ"],
  "ক": ["ক", "খ"],
  "খ": ["ক", "খ"],
  "গ": ["গ", "ঘ"],
  "ঘ": ["গ", "ঘ"],
};

const COMMON_TYPOS: Record<string, string> = {
  "চট্রগ্রাম": "চট্টগ্রাম",
  "চাট্টগ্রাম": "চট্টগ্রাম",
  "চটগ্রাম": "চট্টগ্রাম",
  "সিলট": "সিলেট",
  "সীলেট": "সিলেট",
  "সিলোট": "সিলেট",
  "রাজসাহী": "রাজশাহী",
  "রাজসাহি": "রাজশাহী",
  "রাযশাহী": "রাজশাহী",
  "খুলণা": "খুলনা",
  "বগুরা": "বগুড়া",
  "বগড়া": "বগুড়া",
  "কক্স বাজার": "কক্সবাজার",
  "কক্স্ বাজার": "কক্সবাজার",
  "কক্সবাযার": "কক্সবাজার",
  "সুন্দরবণ": "সুন্দরবন",
  "সুন্দর বন": "সুন্দরবন",
  "রাঙ্গামাটি": "রাঙামাটি",
  "রাংগামাটি": "রাঙামাটি",
  "বান্দরবন": "বান্দরবান",
  "বান্দরবান্": "বান্দরবান",
  "শ্রীমংগল": "শ্রীমঙ্গল",
  "শ্রীমঙ্গল্": "শ্রীমঙ্গল",
  "সীমঙ্গল": "শ্রীমঙ্গল",
  "কুয়াকাটা": "কুয়াকাটা",
  "ময়মনসিং": "ময়মনসিংহ",
  "জয়পুরহাত": "জয়পুরহাট",
  "জয়পূরহাট": "জয়পুরহাট",
  "ঠাকুরগাও": "ঠাকুরগাঁও",
  "পঞ্চগড": "পঞ্চগড়",
  "পঞ্চচগড়": "পঞ্চগড়",
  "দীনাজপুর": "দিনাজপুর",
  "দিনাযপুর": "দিনাজপুর",
  "লালমণিরহাট": "লালমনিরহাট",
  "লালমনীরহাট": "লালমনিরহাট",
  "নীলফামারি": "নীলফামারী",
  "নিলফামারী": "নীলফামারী",
  "কুরিগ্রাম": "কুড়িগ্রাম",
  "কুড়িগ্রম": "কুড়িগ্রাম",
  "গাঈবান্ধা": "গাইবান্ধা",
  "যশর": "যশোর",
  "কুষ্টীয়া": "কুষ্টিয়া",
  "কুস্টিয়া": "কুষ্টিয়া",
  "সাতখীরা": "সাতক্ষীরা",
  "সাতখিরা": "সাতক্ষীরা",
  "ঝিনাইদা": "ঝিনাইদহ",
  "ঝিনাইদাহ": "ঝিনাইদহ",
  "মেহেরপূর": "মেহেরপুর",
  "মেহেরপুর্": "মেহেরপুর",
  "চুয়াডাংগা": "চুয়াডাঙ্গা",
  "চুয়াডাঙা": "চুয়াডাঙ্গা",
  "ফরিদপুর": "ফরিদপুর",
  "ফরীদপুর": "ফরিদপুর",
  "গোপালগঞ্জ্": "গোপালগঞ্জ",
  "গোপালগজ্ঞ": "গোপালগঞ্জ",
  "মাদারিপুর": "মাদারীপুর",
  "মাদারিপূর": "মাদারীপুর",
  "শরিয়তপুর": "শরীয়তপুর",
  "শরিয়াতপুর": "শরীয়তপুর",
  "রাজবাড়ি": "রাজবাড়ী",
  "রাজবারী": "রাজবাড়ী",
  "নারায়নগঞ্জ": "নারায়ণগঞ্জ",
  "নারায়ংগঞ্জ": "নারায়ণগঞ্জ",
  "গাযীপুর": "গাজীপুর",
  "গাজিপুর": "গাজীপুর",
  "টাংগাইল": "টাঙ্গাইল",
  "টাঙ্গাইল্": "টাঙ্গাইল",
  "মানিকগঞ্জ্": "মানিকগঞ্জ",
  "মানিকগাঞ্জ": "মানিকগঞ্জ",
  "মুন্সিগঞ্জ": "মুন্সীগঞ্জ",
  "মুন্শীগঞ্জ": "মুন্সীগঞ্জ",
  "নরসিংদি": "নরসিংদী",
  "নরসিংদী": "নরসিংদী",
  "কিশোরগঞ্জ্": "কিশোরগঞ্জ",
  "কিশোরগাঞ্জ": "কিশোরগঞ্জ",
  "জামালপুর্": "জামালপুর",
  "যামালপুর": "জামালপুর",
  "শেরপুর্": "শেরপুর",
  "সেরপুর": "শেরপুর",
  "নেত্রকোনা": "নেত্রকোণা",
  "নেত্রকণা": "নেত্রকোণা",
  "কুমিল্লা": "কুমিল্লা",
  "কমিল্লা": "কুমিল্লা",
  "ব্রাম্মণবাড়িয়া": "ব্রাহ্মণবাড়িয়া",
  "ব্রাহ্মনবাড়িয়া": "ব্রাহ্মণবাড়িয়া",
  "চান্দপুর": "চাঁদপুর",
  "চাদপুর": "চাঁদপুর",
  "নোয়াখালি": "নোয়াখালী",
  "নোয়াখালী": "নোয়াখালী",
  "লক্ষিপুর": "লক্ষ্মীপুর",
  "লক্ষীপুর": "লক্ষ্মীপুর",
  "ফেনি": "ফেনী",
  "ফেণী": "ফেনী",
  "হবিগজ্ঞ": "হবিগঞ্জ",
  "হবীগঞ্জ": "হবিগঞ্জ",
  "মৌলভিবাজার": "মৌলভীবাজার",
  "মোলভীবাজার": "মৌলভীবাজার",
  "সুনামগজ্ঞ": "সুনামগঞ্জ",
  "সুনামগঞ্জ্": "সুনামগঞ্জ",
  "জাফলং": "জাফলং",
  "জাফ্লং": "জাফলং",
  "নাটোর্": "নাটোর",
  "নাতর": "নাটোর",
  "পাবণা": "পাবনা",
  "পবনা": "পাবনা",
  "সিরাজগজ্ঞ": "সিরাজগঞ্জ",
  "সীরাজগঞ্জ": "সিরাজগঞ্জ",
  "নওগা": "নওগাঁ",
  "নওগাঁ": "নওগাঁ",
  "নাওগাঁ": "নওগাঁ",
  "চাপাইনবাবগঞ্জ্": "চাঁপাইনবাবগঞ্জ",
  "চাপাইনবাবগাঞ্জ": "চাঁপাইনবাবগঞ্জ",
  "বাগেরহাত": "বাগেরহাট",
  "বাগের হাট": "বাগেরহাট",
  "পটুয়াখালী": "পটুয়াখালী",
  "পটুয়াখালি": "পটুয়াখালী",
  "ভলা": "ভোলা",
  "ভোলা": "ভোলা",
  "বরগুণা": "বরগুনা",
  "বড়গুনা": "বরগুনা",
  "ঝালকাঠী": "ঝালকাঠি",
  "ঝালকাথী": "ঝালকাঠি",
  "পিরোযপুর": "পিরোজপুর",
  "পীরোজপুর": "পিরোজপুর",
  "খাগড়াছড়ী": "খাগড়াছড়ি",
  "খাগরাছড়ি": "খাগড়াছড়ি",
};

export function normalizeBangla(text: string): string {
  let normalized = text.trim();
  
  if (COMMON_TYPOS[normalized]) {
    return COMMON_TYPOS[normalized];
  }
  
  return normalized;
}

export function calculateBanglaDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 0;
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const char1 = s1[i - 1];
      const char2 = s2[j - 1];
      
      let cost = char1 === char2 ? 0 : 1;
      
      const similarChars = BANGLA_CHAR_MAP[char1];
      if (similarChars && similarChars.includes(char2)) {
        cost = 0.5;
      }
      
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  return matrix[len1][len2];
}

export function banglaFuzzyMatch(query: string, target: string, threshold: number = 0.6): boolean {
  const normalizedQuery = normalizeBangla(query);
  const normalizedTarget = normalizeBangla(target);
  
  if (normalizedTarget.includes(normalizedQuery)) {
    return true;
  }
  
  if (normalizedQuery.includes(normalizedTarget)) {
    return true;
  }
  
  const distance = calculateBanglaDistance(normalizedQuery, normalizedTarget);
  const maxLen = Math.max(normalizedQuery.length, normalizedTarget.length);
  const similarity = 1 - distance / maxLen;
  
  return similarity >= threshold;
}

export function searchBanglaWithFuzzy<T>(
  items: T[],
  query: string,
  getSearchableText: (item: T) => string[],
  threshold: number = 0.5
): T[] {
  if (!query.trim()) {
    return items;
  }
  
  const normalizedQuery = normalizeBangla(query.trim());
  const lowerQuery = normalizedQuery.toLowerCase();
  
  const results = items.map((item) => {
    const texts = getSearchableText(item);
    let bestScore = 0;
    
    for (const text of texts) {
      const normalizedText = normalizeBangla(text);
      const lowerText = normalizedText.toLowerCase();
      
      if (lowerText === lowerQuery) {
        bestScore = 1;
        break;
      }
      
      if (lowerText.includes(lowerQuery)) {
        bestScore = Math.max(bestScore, 0.98);
        continue;
      }
      
      if (lowerText.startsWith(lowerQuery)) {
        bestScore = Math.max(bestScore, 0.95);
        continue;
      }
      
      if (lowerQuery.length >= 2) {
        const distance = calculateBanglaDistance(normalizedQuery, normalizedText);
        const maxLen = Math.max(normalizedQuery.length, normalizedText.length);
        const similarity = 1 - distance / maxLen;
        bestScore = Math.max(bestScore, similarity);
      }
    }
    
    return { item, score: bestScore };
  });
  
  return results
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}

export function suggestBanglaCorrection(input: string): string | null {
  const normalized = normalizeBangla(input);
  if (normalized !== input) {
    return normalized;
  }
  return null;
}
