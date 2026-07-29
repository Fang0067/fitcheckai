import { useEffect, useState } from 'react';

interface WeatherFeedProps {
  onWeatherUpdate: (data: { 
    verdict: string; 
    explanation: string;
    icon?: string;
    label?: string;
  }) => void;
}

export const WeatherFeed: React.FC<WeatherFeedProps> = ({ onWeatherUpdate }) => {
  const [hasFetched, setHasFetched] = useState(false);

  const getWeatherIcon = (condition: string): string => {
    if (condition.includes('clear')) return '☀️';
    if (condition.includes('cloud')) return '⛅️';
    if (condition.includes('rain') || condition.includes('drizzle')) return '🌧';
    if (condition.includes('storm') || condition.includes('thunderstorm')) return '⛈';
    if (condition.includes('snow')) return '❄️';
    if (condition.includes('wind')) return '🌬';
    return '⛅️';
  };

  const getWeatherLabel = (temp: number, condition: string): string => {
    const conditionName = condition.charAt(0).toUpperCase() + condition.slice(1);
    if (temp < 10) return `${conditionName} & Cold`;
    if (temp > 33) return `${conditionName} & Hot`;
    if (temp >= 28) return `${conditionName} & Warm`;
    if (temp >= 18) return `${conditionName} & Mild`;
    return `${conditionName} & Cool`;
  };

  const evaluateWeatherFit = (
  temp: number,
  condition: string
): { verdict: string; explanation: string } => {

  // Severe weather = instant veto
  if (
    condition.includes('storm') ||
    condition.includes('thunderstorm') ||
    condition.includes('snow')
  ) {
    return {
      verdict: 'Not ideal',
      explanation:
        'Harsh conditions nearby. Comfort and protection may matter more than styling today.'
    };
  }

  // VERY HOT
  if (temp >= 34) {
    return {
      verdict: 'Not ideal',
      explanation:
        'Intense heat. Heavy fabrics, layers, or dark materials will feel suffocating.'
    };
  }

  // HOT
  if (temp >= 28) {
    return {
      verdict: 'Mostly suitable',
      explanation:
        'Warm conditions. Breathable materials will likely feel better than structured or layered looks.'
    };
  }

  // COOL
  if (temp >= 18 && temp < 28) {
    return {
      verdict: 'Suitable',
      explanation:
        'Comfortable range. Most outfit choices should wear well without adjustment.'
    };
  }

  // COLD
  if (temp >= 10 && temp < 18) {
    return {
      verdict: 'Mostly suitable',
      explanation:
        'Cooler air. Light layering could help keep the outfit feeling balanced.'
    };
  }

  // VERY COLD
  if (temp < 10) {
    return {
      verdict: 'Not ideal',
      explanation:
        'Cold conditions. Without adequate layering, comfort may take a hit.'
    };
  }

  // Rain modifier
  if (condition.includes('rain') || condition.includes('drizzle')) {
    return {
      verdict: 'Mostly suitable',
      explanation:
        'Rain expected. Materials and footwear choice will affect how well this outfit holds up.'
    };
  }

  // Fallback
  return {
    verdict: 'Suitable',
    explanation:
      'Conditions are neutral. Outfit performance should be stable.'
  };
};

  // Get user location using multiple methods
  const getUserLocation = async (): Promise<{ latitude: number; longitude: number }> => {
    // Method 1: Try browser geolocation first (most accurate)
    if (navigator.geolocation) {
      try {
        console.log('📍 Trying browser geolocation...');
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              timeout: 5000,
              maximumAge: 300000,
              enableHighAccuracy: false
            }
          );
        });
        console.log('✅ Browser geolocation success!');
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      } catch (error) {
        console.log('⚠️ Browser geolocation failed, trying IP-based location...');
      }
    }

    // Method 2: Fallback to IP-based geolocation (works everywhere)
    try {
      console.log('🌐 Trying IP-based geolocation...');
      const response = await fetch('https://ipapi.co/json/');
      if (!response.ok) throw new Error('IP geolocation failed');
      
      const data = await response.json();
      console.log('✅ IP-based geolocation success!');
      return {
        latitude: data.latitude,
        longitude: data.longitude
      };
    } catch (error) {
      console.error('❌ IP-based geolocation failed');
      throw new Error('Could not determine location');
    }
  };

  useEffect(() => {
    if (hasFetched) return;

    const fetchWeather = async () => {
      try {
        console.log('🌍 Starting weather fetch...');
        
        // Get user location (tries browser geolocation, then IP-based)
        const { latitude, longitude } = await getUserLocation();
        console.log(`✅ Location: ${latitude}, ${longitude}`);

        // Fetch weather using location
        const API_KEY = 'fe906e526c29f73cb335d8c6b3e4ee0c';
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`;
        
        console.log('🌤️ Fetching weather data...');
        const response = await fetch(url);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ Weather API error:', errorData);
          throw new Error(`Weather API failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Weather data received:', data);
        
        const temp = Math.round(data.main.temp);
        const condition = data.weather[0]?.main || 'Unknown';
        const description = data.weather[0]?.description || '';

        // Compute verdict using helper functions
        const { verdict, explanation } = evaluateWeatherFit(temp, condition.toLowerCase());
        const weatherIcon = getWeatherIcon(condition.toLowerCase());
        const weatherLabel = getWeatherLabel(temp, condition);

        console.log('✅ Weather processed:', { verdict, icon: weatherIcon, label: weatherLabel });

        // Send data to Homepage via callback
onWeatherUpdate({ 
  verdict, 
  explanation,
  icon: weatherIcon,
  label: weatherLabel,
  temp: temp,
  condition: condition.toLowerCase()
});
        
        setHasFetched(true);
        console.log('✅ Weather update complete! 🎉');

      } catch (error) {
        console.error('❌ Weather fetch error:', error);
        
        // Graceful fallback
        onWeatherUpdate({
          verdict: 'Unknown',
          explanation: 'Weather data unavailable for your location.',
          icon: '⛅️',
          label: 'Weather Fit'
        });
        
        setHasFetched(true);
      }
    };

    fetchWeather();
  }, [hasFetched, onWeatherUpdate]);

  // Returns nothing - this is a logic-only component
  return null;
};
