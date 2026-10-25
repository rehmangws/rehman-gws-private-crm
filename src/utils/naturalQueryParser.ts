export interface ParsedLeadQuery {
  raw: string;
  location: string;
  category: string;
  radiusKm?: number;
  confirmationLabel: string;
}

const COMMON_CATEGORIES = [
  'restaurant', 'restaurants', 'cafe', 'cafes', 'coffee', 'hotel', 'hotels',
  'real estate', 'realtor', 'property', 'cleaning', 'cleaners', 'warehouse', 'warehouses',
  'logistics', 'freight', 'construction', 'contractors', 'recruitment', 'staffing',
  'salon', 'salons', 'spa', 'clinic', 'clinics', 'medical', 'hospital', 'dentist',
  'gym', 'gyms', 'fitness', 'retail', 'supermarket', 'supermarkets', 'grocery',
  'it', 'software', 'tech', 'marketing', 'agency', 'security', 'law firm', 'lawyers',
  'accounting', 'accountants', 'car rental', 'car dealer', 'pharmacy', 'events',
  'catering', 'home services', 'maintenance'
];

/**
 * Parses a natural language user query into location, category, and radius.
 * e.g. "Restaurants in Dubai Marina" -> location: "Dubai Marina", category: "Restaurants"
 */
export function parseNaturalQuery(rawQuery: string): ParsedLeadQuery {
  const q = rawQuery.trim();
  if (!q) {
    return {
      raw: '',
      location: '',
      category: 'All Commercial Businesses',
      confirmationLabel: 'Current Map Area • All Businesses',
    };
  }

  let text = q;
  let radiusKm: number | undefined;

  // Extract radius if specified (e.g. "within 5km", "5 km", "radius 3km")
  const radiusMatch = text.match(/(?:within|around|radius)?\s*(\d+(?:\.\d+)?)\s*(?:km|kilometers|k)/i);
  if (radiusMatch) {
    radiusKm = parseFloat(radiusMatch[1]);
    text = text.replace(radiusMatch[0], ' ').trim();
  }

  // Detect category keywords
  let detectedCategory = '';
  const lowerText = text.toLowerCase();

  for (const cat of COMMON_CATEGORIES) {
    const regex = new RegExp(`\\b${cat}\\b`, 'i');
    if (regex.test(lowerText)) {
      detectedCategory = cat;
      // Capitalize first letter
      detectedCategory = detectedCategory.charAt(0).toUpperCase() + detectedCategory.slice(1);
      break;
    }
  }

  // Split on prepositions: "in", "around", "near", "at", "across"
  let location = '';
  const prepositionMatch = text.match(/\b(in|around|near|at|across)\b\s+(.+)$/i);

  if (prepositionMatch) {
    location = prepositionMatch[2].trim();
    if (!detectedCategory) {
      detectedCategory = text.slice(0, prepositionMatch.index).trim();
    }
  } else if (detectedCategory) {
    // If no preposition, remove the category from the text to get the location
    const stripped = text.replace(new RegExp(`\\b${detectedCategory}\\b`, 'i'), '').trim();
    location = stripped.replace(/^[, -]+|[, -]+$/g, '');
  } else {
    // If no clear preposition or known category, assume whole string is location or query
    location = text;
  }

  // Clean up
  location = location.trim();
  if (!detectedCategory) {
    detectedCategory = 'All Commercial Businesses';
  } else {
    // Pluralize or normalize common words
    if (detectedCategory.toLowerCase() === 'restaurant') detectedCategory = 'Restaurants';
    if (detectedCategory.toLowerCase() === 'hotel') detectedCategory = 'Hotels';
    if (detectedCategory.toLowerCase() === 'warehouse') detectedCategory = 'Warehouses';
    if (detectedCategory.toLowerCase() === 'clinic') detectedCategory = 'Clinics';
    if (detectedCategory.toLowerCase() === 'salon') detectedCategory = 'Salons';
  }

  const locDisplay = location || 'Current Map Area';
  const radiusDisplay = radiusKm ? ` (${radiusKm}km)` : '';
  const confirmationLabel = `${locDisplay} • ${detectedCategory}${radiusDisplay}`;

  return {
    raw: q,
    location,
    category: detectedCategory,
    radiusKm,
    confirmationLabel,
  };
}
