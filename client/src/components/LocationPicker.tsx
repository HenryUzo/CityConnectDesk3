import { useState, useEffect, useRef } from "react";
import { MapPin, Search, Navigation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

// Mapbox types
interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number];
  geometry: {
    coordinates: [number, number];
  };
}

interface MapboxResponse {
  features: MapboxFeature[];
}

interface LocationData {
  address: string;
  latitude?: number;
  longitude?: number;
}

interface LocationPickerProps {
  value: LocationData;
  onChange: (location: LocationData) => void;
  placeholder?: string;
  className?: string;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Debounced search hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function LocationPicker({ value, onChange, placeholder = "Enter location", className }: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState(value.address || "");
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const debouncedQuery = useDebounce(searchQuery, 300);

  // Mapbox Places API query
  const { data: suggestions, isLoading } = useQuery<MapboxFeature[]>({
    queryKey: ['places', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 3) return [];
      
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(debouncedQuery)}.json?access_token=${MAPBOX_TOKEN}&limit=5&country=NG`
      );
      
      if (!response.ok) throw new Error('Failed to fetch suggestions');
      
      const data: MapboxResponse = await response.json();
      return data.features;
    },
    enabled: debouncedQuery.length >= 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Reverse geocoding query
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1`
      );
      
      if (!response.ok) throw new Error('Failed to reverse geocode');
      
      const data: MapboxResponse = await response.json();
      return data.features[0]?.place_name || 'Unknown location';
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return 'Unknown location';
    }
  };

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Location not supported",
        description: "Your browser doesn't support location services",
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const address = await reverseGeocode(latitude, longitude);
        
        const locationData: LocationData = {
          address,
          latitude,
          longitude,
        };
        
        setSearchQuery(address);
        onChange(locationData);
        
        toast({
          title: "Location found",
          description: "Your current location has been set",
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast({
          title: "Location access denied",
          description: "Please allow location access or enter your address manually",
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  };

  // Select suggestion
  const selectSuggestion = (feature: MapboxFeature) => {
    const locationData: LocationData = {
      address: feature.place_name,
      latitude: feature.center[1],
      longitude: feature.center[0],
    };
    
    setSearchQuery(feature.place_name);
    onChange(locationData);
  };

  // Initialize map when sheet opens
  useEffect(() => {
    if (isMapOpen && mapContainer.current && !mapInstance && MAPBOX_TOKEN) {
      // Lazy load mapbox-gl
      import('mapbox-gl').then((mapboxModule) => {
        const mapboxgl = mapboxModule.default;
        
        (mapboxgl as any).accessToken = MAPBOX_TOKEN;
        
        const map = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: value.longitude && value.latitude ? [value.longitude, value.latitude] : [3.3792, 6.5244], // Lagos default
          zoom: value.longitude && value.latitude ? 15 : 10,
        });

        // Add marker
        const newMarker = new mapboxgl.Marker({ draggable: true })
          .setLngLat(value.longitude && value.latitude ? [value.longitude, value.latitude] : [3.3792, 6.5244])
          .addTo(map);

        // Handle marker drag
        newMarker.on('dragend', async () => {
          const lngLat = newMarker.getLngLat();
          const address = await reverseGeocode(lngLat.lat, lngLat.lng);
          
          const locationData: LocationData = {
            address,
            latitude: lngLat.lat,
            longitude: lngLat.lng,
          };
          
          setSearchQuery(address);
          onChange(locationData);
        });

        setMapInstance(map);
        setMarker(newMarker);
      }).catch((error) => {
        console.error('Failed to load Mapbox:', error);
        toast({
          title: "Map loading failed",
          description: "Unable to load the map. Please use the search feature instead.",
          variant: "destructive",
        });
      });
    }
  }, [isMapOpen, value.latitude, value.longitude, onChange, toast, mapInstance]);

  // Update map center when coordinates change
  useEffect(() => {
    if (mapInstance && marker && value.latitude && value.longitude) {
      const newCenter = [value.longitude, value.latitude];
      mapInstance.setCenter(newCenter);
      marker.setLngLat(newCenter);
    }
  }, [mapInstance, marker, value.latitude, value.longitude]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstance) {
        mapInstance.remove();
        setMapInstance(null);
        setMarker(null);
      }
    };
  }, [mapInstance]);

  return (
    <div className={className}>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4"
            data-testid="input-location-search"
          />
        </div>

        {/* Suggestions dropdown */}
        {suggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
            {suggestions.map((feature) => (
              <button
                key={feature.id}
                onClick={() => selectSuggestion(feature)}
                className="w-full px-4 py-2 text-left hover:bg-muted transition-colors flex items-center gap-2"
                data-testid={`suggestion-${feature.id}`}
              >
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm">{feature.place_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={getCurrentLocation}
          className="flex items-center gap-2"
          data-testid="button-current-location"
        >
          <Navigation className="w-4 h-4" />
          Use my location
        </Button>

        {MAPBOX_TOKEN && (
          <Sheet open={isMapOpen} onOpenChange={setIsMapOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                data-testid="button-open-map"
              >
                <MapPin className="w-4 h-4" />
                Choose on map
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] p-0">
              <SheetHeader className="p-4 pb-2">
                <SheetTitle>Choose Location on Map</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  Drag the marker to select your exact location
                </p>
              </SheetHeader>
              <div className="flex-1 relative">
                <div
                  ref={mapContainer}
                  className="w-full h-[calc(80vh-100px)]"
                  data-testid="map-container"
                />
                <Button
                  onClick={() => setIsMapOpen(false)}
                  className="absolute top-4 right-4 z-10"
                  size="sm"
                  data-testid="button-close-map"
                >
                  <X className="w-4 h-4 mr-2" />
                  Done
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="text-xs text-muted-foreground mt-1">
          Searching locations...
        </div>
      )}

      {/* Selected location info */}
      {value.latitude && value.longitude && (
        <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          Coordinates: {value.latitude.toFixed(4)}, {value.longitude.toFixed(4)}
        </div>
      )}
    </div>
  );
}