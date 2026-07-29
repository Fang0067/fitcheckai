import { WeatherStyleNote } from '../types';

interface OutfitWeatherProfile {
  coverage: 'light' | 'medium' | 'heavy';
  layering: 'single' | 'layered' | 'heavy-layered';
  fabricWeight: 'light' | 'mid' | 'heavy';
}

/**
 * Generate a weather-appropriate style note based on outfit properties and current weather.
 */
export function generateWeatherStyleNote(
  profile: OutfitWeatherProfile,
  currentWeather: string,
  outfitScore: number
): WeatherStyleNote | null {
  if (!profile || !currentWeather) return null;

  const weather = currentWeather.toLowerCase();

  // Determine weather category
  const isHot = weather.includes('hot') || weather.includes('very hot');
  const isWarm = weather.includes('warm') || weather.includes('mild') || weather.includes('sunny');
  const isCold = weather.includes('cold') || weather.includes('cool');
  const isRainy = weather.includes('rain') || weather.includes('storm') || weather.includes('drizzle');
  const isSnowy = weather.includes('snow');

  const { coverage, layering, fabricWeight } = profile;

  // Heavy outfit in hot weather
  if (isHot && (coverage === 'heavy' || fabricWeight === 'heavy' || layering === 'heavy-layered')) {
    return {
      summary: "This outfit might be too warm for today's heat. Consider lighter fabrics or fewer layers to stay comfortable.",
      verdict: 'mismatch',
    };
  }

  // Light outfit in cold weather
  if ((isCold || isSnowy) && (coverage === 'light' || fabricWeight === 'light') && layering === 'single') {
    return {
      summary: "Today's cooler temperatures might call for an extra layer. A jacket or sweater would complement this outfit well.",
      verdict: 'mismatch',
    };
  }

  // Rainy weather without heavy layering
  if (isRainy && coverage === 'light') {
    return {
      summary: "With rain expected, consider adding a water-resistant outer layer to protect this look.",
      verdict: 'caution',
    };
  }

  // Good match scenarios
  if (isHot && coverage === 'light' && fabricWeight === 'light') {
    return {
      summary: "This outfit is well-suited for the warm weather. Light and breathable — a smart choice.",
      verdict: 'match',
    };
  }

  if (isCold && (coverage === 'heavy' || layering !== 'single')) {
    return {
      summary: "Good layering for the cooler conditions. You should stay comfortable throughout the day.",
      verdict: 'match',
    };
  }

  if (isWarm && coverage === 'medium') {
    return {
      summary: "This outfit fits today's mild conditions well. Comfortable and appropriate.",
      verdict: 'match',
    };
  }

  // Default: moderate match
  return {
    summary: "This outfit should work for today's conditions. Adjust layers if the weather shifts.",
    verdict: 'neutral',
  };
}
