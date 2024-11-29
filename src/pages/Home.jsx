/**
 * Home Page Component
 * 
 * Main interface for displaying and interacting with local sales. Features include:
 * - Interactive map showing user location and nearby sales
 * - List view of sales with detailed information
 * - Click-to-scroll synchronization between map markers and list items
 * - Real-time location-based filtering
 * - Dark mode support
 */

import React, { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import { ChevronDownIcon, ArrowsPointingInIcon } from '@heroicons/react/24/solid'
import { collection, getDocs, query, where, Timestamp, updateDoc, doc, addDoc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { calculateDistance, getBounds } from '../utils/geoUtils'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Dialog, Transition } from '@headlessui/react'
import { HiX, HiPlus } from 'react-icons/hi'
import debounce from 'lodash.debounce'

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

/**
 * Calculates the bounds for the map based on center coordinates and radius
 * @param {Object} center - Center coordinates {latitude, longitude}
 * @param {number} radius - Radius in miles
 * @returns {L.LatLngBounds} Leaflet bounds object
 */
const calculateMapBounds = (center, radius) => {
  // More precise miles to degrees conversion
  // At the equator, 1 degree = 69.172 miles
  const milesPerDegreeAtEquator = 69.172;
  
  // Calculate the latitude offset
  const latOffset = radius / milesPerDegreeAtEquator;
  
  // Calculate the longitude offset, accounting for the Earth's curvature
  const latitudeRadians = center.latitude * (Math.PI / 180);
  const lngOffset = radius / (milesPerDegreeAtEquator * Math.cos(latitudeRadians));
  
  // Create the bounds with a small minimum to prevent zero-size bounds
  const minOffset = Math.max(0.001, Math.min(latOffset, lngOffset));
  
  return L.latLngBounds(
    [center.latitude - minOffset, center.longitude - minOffset],
    [center.latitude + minOffset, center.longitude + minOffset]
  );
};

/**
 * Calculates the appropriate zoom level based on the search radius
 * @param {number} radius - Search radius in miles
 * @returns {number} Zoom level for the map
 */
const calculateZoomLevel = (radius) => {
  if (radius <= 5) return 14
  if (radius <= 10) return 13
  if (radius <= 25) return 12
  if (radius <= 50) return 11
  if (radius <= 100) return 10
  return 10 // Cap at zoom level 10 for max 100 miles
}

/**
 * Map boundary component to restrict movement and show radius
 */
const MapBoundary = ({ coordinates, radius }) => {
  const map = useMap();
  
  // Convert radius from miles to meters
  const radiusInMeters = radius * 1609.34;
  
  useEffect(() => {
    if (!coordinates) return;

    const center = [coordinates.latitude, coordinates.longitude];
    
    // Function to check if point is within radius
    const isPointInBounds = (point) => {
      const distance = map.distance(center, point);
      return distance <= radiusInMeters;
    };

    // Handle map movement
    const onMove = () => {
      const mapCenter = map.getCenter();
      if (!isPointInBounds([mapCenter.lat, mapCenter.lng])) {
        // If map center moves outside radius, move it back to the nearest point on the circle
        const currentCenter = L.latLng(mapCenter.lat, mapCenter.lng);
        const originalCenter = L.latLng(center[0], center[1]);
        const distance = currentCenter.distanceTo(originalCenter);
        const factor = radiusInMeters / distance;
        
        const newLat = originalCenter.lat + (currentCenter.lat - originalCenter.lat) * factor;
        const newLng = originalCenter.lng + (currentCenter.lng - originalCenter.lng) * factor;
        
        map.panTo([newLat, newLng], { animate: true });
      }
    };

    map.on('move', onMove);
    
    return () => {
      map.off('move', onMove);
    };
  }, [map, coordinates, radius]);

  if (!coordinates) return null;

  return (
    <Circle
      center={[coordinates.latitude, coordinates.longitude]}
      radius={radiusInMeters}
      pathOptions={{
        color: '#4F46E5',
        fillColor: '#4F46E5',
        fillOpacity: 0.1,
        weight: 1
      }}
    />
  );
};

/**
 * Map controls component for distance selection and recentering
 */
const MapControls = ({ coordinates, radius, setRadius, map, radiusOptions }) => {
  const handleRecenter = () => {
    if (coordinates && map) {
      map.setView(
        [coordinates.latitude, coordinates.longitude],
        calculateZoomLevel(radius),
        { animate: true }
      );
    }
  };

  return (
    <>
      {/* Distance Selector */}
      <div className="absolute bottom-4 right-4 z-[400]">
        <div className="relative">
          <select
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="appearance-none bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm pl-3 pr-10 py-2 border border-gray-300/50 dark:border-gray-600/50 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-lg cursor-pointer hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors duration-200"
          >
            {radiusOptions.map((option) => (
              <option key={option} value={option}>
                {option} miles
              </option>
            ))}
          </select>
          <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Recenter Button */}
      <div className="absolute bottom-4 left-4 z-[400]">
        <button
          onClick={handleRecenter}
          className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm w-12 h-12 flex items-center justify-center rounded-full shadow-lg border border-gray-300/50 dark:border-gray-600/50 text-gray-700 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-800/80 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
          title="Recenter map"
        >
          <ArrowsPointingInIcon className="h-[32px] w-[32px] text-gray-700 dark:text-gray-300" />
        </button>
      </div>
    </>
  );
};

/**
 * Map updater component to handle map view changes based on coordinates and radius
 */
const MapUpdater = ({ coordinates, radius, setRadius, radiusOptions }) => {
  const map = useMap();
  
  useEffect(() => {
    if (coordinates) {
      const zoom = calculateZoomLevel(radius);
      map.setView([coordinates.latitude, coordinates.longitude], zoom);
    }
  }, [coordinates, radius, map]);
  
  return <MapControls coordinates={coordinates} radius={radius} setRadius={setRadius} map={map} radiusOptions={radiusOptions} />;
}

/**
 * Home page component
 * Manages the display and interaction of sales data, map view, and list view
 */
const Home = () => {
  // Constants
  const radiusOptions = [5, 10, 25, 50, 100];

  // State management
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [coordinates, setCoordinates] = useState(null)
  const [locationLoading, setLocationLoading] = useState(true)
  const [locationError, setLocationError] = useState(null)
  const [radius, setRadius] = useState(10)
  const [userLiveSale, setUserLiveSale] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
  const [confirmationType, setConfirmationType] = useState(null)
  const unsubscribeRef = useRef(null);
  const [newSale, setNewSale] = useState({
    eventType: '',
    description: '',
  })
  const [address, setAddress] = useState('');
  const [originalAddress, setOriginalAddress] = useState('');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [validatedAddressInfo, setValidatedAddressInfo] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [isNavigationModalOpen, setIsNavigationModalOpen] = useState(false);
  const navigationModalRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 9;
  const observerTarget = useRef(null);
  const { currentUser, isAdmin, isLoading: authLoading } = useAuth()
  const { darkMode } = useTheme()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const listContainerRef = useRef(null);
  const itemRefs = useRef({});

  // Define regions mapping
  const regions = {
    'Northeast': ['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA'],
    'Midwest': ['OH', 'MI', 'IN', 'IL', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'],
    'South': ['DE', 'MD', 'DC', 'VA', 'WV', 'NC', 'SC', 'GA', 'FL', 'KY', 'TN', 'AL', 'MS', 'AR', 'LA', 'OK', 'TX'],
    'West': ['MT', 'ID', 'WY', 'CO', 'NM', 'AZ', 'UT', 'NV', 'CA', 'OR', 'WA', 'AK', 'HI']
  };

  // Function to get region from state
  const getRegionFromState = (stateCode) => {
    for (const [region, states] of Object.entries(regions)) {
      if (states.includes(stateCode)) {
        return region;
      }
    }
    return null;
  };

  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      setLocationLoading(false)
      return
    }

    const options = {
      enableHighAccuracy: false, // Set to false to prioritize faster response over high accuracy
      timeout: 15000, // Increased timeout to 15 seconds
      maximumAge: 60000, // Cache location for 1 minute
    }

    let retryCount = 0;
    const maxRetries = 2;

    const onSuccess = (position) => {
      const { latitude, longitude } = position.coords
      setCoordinates(prev => {
        // Only update if coordinates changed significantly (more than 100m) or if it's the first update
        if (!prev || calculateDistance(prev.latitude, prev.longitude, latitude, longitude) > 0.1) {
          return { latitude, longitude }
        }
        return prev
      })
      setLocationLoading(false)
      setLocationError(null)
    }

    const onError = (error) => {
      let errorMessage = 'Failed to get location. '
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage += 'Location permission denied.'
          setLocationLoading(false)
          break
        case error.POSITION_UNAVAILABLE:
          errorMessage += 'Location information unavailable.'
          retryWithFallback()
          break
        case error.TIMEOUT:
          errorMessage += 'Location request timed out.'
          retryWithFallback()
          break
        default:
          errorMessage += error.message
          retryWithFallback()
      }
      
      setLocationError(errorMessage)
    }

    const retryWithFallback = () => {
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`Retrying geolocation (attempt ${retryCount} of ${maxRetries})...`);
        
        // On retry, disable high accuracy for faster response
        const retryOptions = {
          ...options,
          enableHighAccuracy: false,
          timeout: 10000 // Shorter timeout for retries
        };
        
        navigator.geolocation.getCurrentPosition(onSuccess, onError, retryOptions);
      } else {
        setLocationLoading(false);
        // If all retries fail, try to get an approximate location from IP (you would need to implement this)
        // or let the user manually enter their location
      }
    }

    // Get initial position
    navigator.geolocation.getCurrentPosition(onSuccess, onError, options)

    // Watch for position changes
    const watchId = navigator.geolocation.watchPosition(onSuccess, onError, options)

    // Return cleanup function to stop watching
    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  useEffect(() => {
    const cleanup = fetchLocation();
    return () => {
      if (cleanup) cleanup();
    }
  }, [fetchLocation]);

  // Memoize the sales data to prevent unnecessary re-renders
  const memoizedSales = useMemo(() => {
    return sales.map(sale => ({
      ...sale,
      distanceDisplay: `${sale.distance} ${sale.distance === 1 ? 'mile' : 'miles'} away`
    }))
  }, [sales])

  // Effect for setting up real-time sales listener
  useEffect(() => {
    if (!coordinates) return;

    setLoading(true);
    setError(null);

    // Create the query for live sales
    const salesRef = collection(db, 'sales');
    const q = query(
      salesRef,
      where('status', '==', 'live')
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        try {
          const updatedSales = [];

          // Get all current documents
          snapshot.forEach(async (doc) => {
            const sale = { id: doc.id, ...doc.data() };
            const saleLocation = sale.location || {};

            if (!saleLocation.latitude || !saleLocation.longitude) {
              console.log('Sale missing location data:', sale.id);
              return;
            }

            // Calculate distance from user
            const distance = calculateDistance(
              coordinates.latitude,
              coordinates.longitude,
              saleLocation.latitude,
              saleLocation.longitude
            );

            if (distance <= radius) {
              const address = sale.address || await getAddressFromCoordinates(saleLocation.latitude, saleLocation.longitude);
              
              updatedSales.push({
                ...sale,
                distance: Math.round(distance * 10) / 10,
                address
              });
            }
          });

          // Sort by distance
          updatedSales.sort((a, b) => a.distance - b.distance);
          setSales(updatedSales);
          setLoading(false);
        } catch (error) {
          console.error('Error processing sales update:', error);
          setError('Error loading sales. Please try again later. ' + error.message);
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error in sales listener:', error);
        setError('Error loading sales. Please try again later. ' + error.message);
        setLoading(false);
      }
    );

    // Store unsubscribe function
    unsubscribeRef.current = unsubscribe;

    // Cleanup listener on unmount or when coordinates/radius change
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [coordinates, radius]);

  // Function to get address from coordinates using Google Geocoding API
  const getAddressFromCoordinates = async (latitude, longitude) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_GEOCODING_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results[0]) {
        const address = data.results[0].formatted_address;
        return address;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error fetching address:', error);
      return null;
    }
  };

  // Function to get coordinates from address using Google Geocoding API
  const getCoordinatesFromAddress = async (searchAddress) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchAddress)}&key=${import.meta.env.VITE_GOOGLE_GEOCODING_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results[0]) {
        const location = data.results[0].geometry.location;
        return {
          latitude: location.lat,
          longitude: location.lng
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting coordinates:', error);
      return null;
    }
  };

  // Function to get address components from coordinates using Google Geocoding API
  const getAddressComponents = async (latitude, longitude) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_GEOCODING_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results[0]) {
        const addressComponents = data.results[0].address_components;
        const formattedAddress = data.results[0].formatted_address;
        
        let city = '';
        let state = '';
        let stateCode = '';
        
        // Extract city and state from address components
        addressComponents.forEach(component => {
          if (component.types.includes('locality') || 
              (component.types.includes('neighborhood') && component.types.includes('political')) ||
              component.types.includes('sublocality') ||
              component.types.includes('postal_town') ||
              component.types.includes('administrative_area_level_3')) {
            city = component.long_name;
          } else if (component.types.includes('administrative_area_level_1')) {
            state = component.long_name;
            stateCode = component.short_name;
          }
        });

        // Fallback: if no city found, try one more time with any remaining valid types
        if (!city) {
          addressComponents.forEach(component => {
            if (!city && (
                component.types.includes('neighborhood') ||
                component.types.includes('sublocality_level_1')
            )) {
              city = component.long_name;
            }
          });
        }
        
        return {
          formattedAddress,
          city,
          state: stateCode,
          region: getRegionFromState(stateCode)
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error fetching address components:', error);
      return null;
    }
  };

  // Function to get address components from a search address
  const getAddressComponentsFromAddress = async (searchAddress) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchAddress)}&key=${import.meta.env.VITE_GOOGLE_GEOCODING_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results[0]) {
        const result = data.results[0];
        const location = result.geometry?.location;
        if (!location?.lat || !location?.lng) {
          return null;
        }

        const addressComponents = result.address_components || [];
        if (addressComponents.length === 0) {
          return null;
        }
        
        let city = '';
        let state = '';
        let stateCode = '';
        let zipCode = '';
        let country = '';
        let streetNumber = '';
        let route = '';
        
        // Extract city and state from address components
        addressComponents.forEach(component => {
          if (!component.types || !component.long_name) {
            return;
          }

          const types = component.types;
          if (types.includes('locality') || 
              (types.includes('neighborhood') && types.includes('political')) ||
              types.includes('sublocality') ||
              types.includes('postal_town') ||
              types.includes('administrative_area_level_3')) {
            city = component.long_name;
          } else if (types.includes('administrative_area_level_1')) {
            state = component.long_name;
            stateCode = component.short_name;
          } else if (types.includes('postal_code')) {
            zipCode = component.long_name;
          } else if (types.includes('country')) {
            country = component.long_name;
          } else if (types.includes('street_number')) {
            streetNumber = component.long_name;
          } else if (types.includes('route')) {
            route = component.long_name;
          }
        });

        // Fallback: if no city found, try one more time with any remaining valid types
        if (!city) {
          addressComponents.forEach(component => {
            if (!city && (
                component.types.includes('neighborhood') ||
                component.types.includes('sublocality_level_1')
            )) {
              city = component.long_name;
            }
          });
        }

        // Final validation
        if (!city || !stateCode) {
          return null;
        }
        
        const addressInfo = {
          coordinates: {
            latitude: location.lat,
            longitude: location.lng
          },
          formattedAddress: result.formatted_address,
          streetAddress: streetNumber && route ? `${streetNumber} ${route}` : '',
          city,
          state: stateCode,
          zipCode,
          country,
          region: getRegionFromState(stateCode)
        };
        
        return addressInfo;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error fetching address components:', error);
      return null;
    }
  };

  // Function to validate if new address is within range
  const validateNewAddress = async (newAddress) => {
    if (!coordinates) return false;
    
    const newCoords = await getCoordinatesFromAddress(newAddress);
    if (!newCoords) {
      setAddressError('Could not find this address. Please enter a valid street address, city, state, and ZIP code.');
      return false;
    }

    const distance = calculateDistance(
      coordinates.latitude,
      coordinates.longitude,
      newCoords.latitude,
      newCoords.longitude
    );

    // Allow addresses within 0.5 miles of current location
    if (distance > 0.5) {
      setAddressError('Address must be within 0.5 miles of your current location.');
      return false;
    }

    return true;
  };

  // Fetch user's live sale if they have one
  useEffect(() => {
    const fetchUserLiveSale = async () => {
      if (!currentUser) {
        setUserLiveSale(null)
        return
      }

      try {
        const q = query(
          collection(db, 'sales'),
          where('userId', '==', currentUser.uid),
          where('status', '==', 'live')
        )
        
        const querySnapshot = await getDocs(q)
        if (!querySnapshot.empty) {
          const liveSale = {
            id: querySnapshot.docs[0].id,
            ...querySnapshot.docs[0].data()
          }
          setUserLiveSale(liveSale)
        } else {
          setUserLiveSale(null)
        }
      } catch (error) {
        console.error('Error fetching user live sale:', error)
      }
    }

    fetchUserLiveSale()
  }, [currentUser])

  const handleEndSale = async () => {
    if (!userLiveSale) return

    try {
      const saleRef = doc(db, 'sales', userLiveSale.id)
      await updateDoc(saleRef, {
        status: 'ended',
        endedAt: Timestamp.now()
      })
      setUserLiveSale(null)
    } catch (error) {
      console.error('Error ending sale:', error)
      setError('Failed to end sale. Please try again.')
    }
  }

  const handleAddSaleClick = () => {
    if (!currentUser) {
      navigate('/login', { state: { from: '/' } })
      return
    }

    if (userLiveSale?.status === 'live') {
      setConfirmationType('end')
      setIsConfirmationOpen(true)
    } else {
      setIsModalOpen(true)
    }
  }

  const handleCreateSale = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Get coordinates from the validated address
      const locationCoordinates = await getCoordinatesFromAddress(validatedAddressInfo.formattedAddress);
      if (!locationCoordinates) {
        throw new Error('Could not get coordinates for the address');
      }

      const sale = {
        userId: currentUser.uid,
        eventType: newSale.eventType,
        description: newSale.description,
        location: {
          latitude: locationCoordinates.latitude,
          longitude: locationCoordinates.longitude
        },
        status: 'live',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        address: validatedAddressInfo.formattedAddress,
        city: validatedAddressInfo.city,
        state: validatedAddressInfo.state,
        region: validatedAddressInfo.region
      };

      // Add the sale to Firestore
      await addDoc(collection(db, 'sales'), sale);

      // Reset form and close modal
      setNewSale({
        eventType: '',
        description: '',
      });
      setIsModalOpen(false);
      
      // Remove manual state update since real-time listener will handle it
    } catch (error) {
      console.error('Error creating sale:', error);
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmation = async () => {
    setIsSubmitting(true);
    try {
      if (confirmationType === 'start') {
        if (!newSale.eventType || !newSale.description || !address) {
          setError('Please fill in all required fields');
          return;
        }

        // First get coordinates
        const coords = await getCoordinatesFromAddress(address);
        if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
          setError('Invalid address - Could not get valid coordinates');
          return;
        }

        // Then get address components
        const addressInfo = await getAddressComponentsFromAddress(address);
        if (!addressInfo) {
          setError('Failed to get address information');
          return;
        }

        if (!addressInfo.formattedAddress || !addressInfo.city || !addressInfo.state) {
          setError('Failed to get complete address information. Please ensure your address includes a city and state.');
          return;
        }

        // Create the sale object
        const sale = {
          userId: currentUser.uid,
          eventType: newSale.eventType,
          description: newSale.description,
          location: {
            latitude: coords.latitude,
            longitude: coords.longitude
          },
          status: 'live',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          address: addressInfo.formattedAddress,
          city: addressInfo.city,
          state: addressInfo.state,
          region: addressInfo.region
        };

        // Create the sale in Firestore
        await addDoc(collection(db, 'sales'), sale);
        
        // Update local state - only update userLiveSale
        setUserLiveSale({ ...sale });

        // Reset form and close modals
        setNewSale({ eventType: '', description: '' });
        setAddress('');
        setIsModalOpen(false);
        setIsConfirmationOpen(false);
        setError(null);
      } else if (confirmationType === 'end') {
        if (!userLiveSale?.id) return;

        // End the sale in Firestore
        await updateDoc(doc(db, 'sales', userLiveSale.id), {
          status: 'ended',
          updatedAt: Timestamp.now(),
        });
        
        // Only update userLiveSale state
        setUserLiveSale(null);

        // Close modals and reset states
        setIsConfirmationOpen(false);
        setIsModalOpen(false);
        setError(null);
      }
    } catch (error) {
      console.error('Error handling sale confirmation:', error);
      setError(error.message);
    } finally {
      setIsSubmitting(false);
      setConfirmationType(null);
    }
  };

  // Update address when coordinates change
  useEffect(() => {
    const updateAddress = async () => {
      if (coordinates) {
        const newAddress = await getAddressFromCoordinates(coordinates.latitude, coordinates.longitude);
        if (newAddress) {
          setAddress(newAddress);
          setOriginalAddress(newAddress);
        }
      }
    };
    updateAddress();
  }, [coordinates]);

  // Fetch event types
  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        const eventTypesRef = collection(db, 'eventTypes');
        const querySnapshot = await getDocs(eventTypesRef);
        const eventTypesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEventTypes(eventTypesData);
      } catch (error) {
        console.error('Error fetching event types:', error);
      }
    };
    fetchEventTypes();
  }, []);

  const handleNavigateToSale = (sale) => {
    setSelectedSale(sale);
    setIsNavigationModalOpen(true);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navigationModalRef.current && !navigationModalRef.current.contains(event.target)) {
        setIsNavigationModalOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const setItemRef = (index, el) => {
    if (el) {
      itemRefs.current[index] = el;
    }
  };

  const scrollToItem = (index) => {
    const listContainer = listContainerRef.current;
    const item = itemRefs.current[index];
    
    if (!listContainer || !item) {
      return;
    }

    const itemTop = item.offsetTop;
    listContainer.scrollTo({
      top: itemTop - 16,
      behavior: 'smooth'
    });
  };

  /**
   * Sets up reference for list item elements
   * @param {number} index - Index of the list item
   * @param {HTMLElement} el - DOM element reference
   */
  const renderMarkers = () => {
    return sales.map((sale, index) => {
      const saleLocation = sale.location || {};
      
      if (!saleLocation.latitude || !saleLocation.longitude) return null;
      
      const markerIcon = new L.DivIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: rgb(79, 70, 229); color: white; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: bold; font-size: 16px; cursor: pointer;">${index + 1}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      return (
        <Marker
          key={`marker-${sale.id}-${index}`}
          position={[saleLocation.latitude, saleLocation.longitude]}
          icon={markerIcon}
          eventHandlers={{
            click: () => scrollToItem(index)
          }}
        />
      );
    });
  };

  return (
    <div className="fixed inset-0 overflow-hidden">
      {locationError && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white p-4 text-center">
          {locationError}
        </div>
      )}

      {/* Fixed Map Section */}
      <div className="fixed top-16 left-0 right-0 h-[45vh] z-10">
        {locationLoading ? (
          <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-2"></div>
              <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Getting your location...</p>
            </div>
          </div>
        ) : coordinates ? (
          <div className="h-full relative">
            {/* Map Container */}
            <div className="absolute inset-0">
              <MapContainer
                center={[coordinates.latitude, coordinates.longitude]}
                zoom={calculateZoomLevel(radius)}
                className="h-full w-full"
                maxZoom={16}
                minZoom={10}
                zoomControl={true}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maxZoom={16}
                  minZoom={10}
                  subdomains={['a', 'b', 'c']}
                  detectRetina={true}
                  tileSize={256}
                />
                <MapUpdater coordinates={coordinates} radius={radius} setRadius={setRadius} radiusOptions={radiusOptions} />
                <MapBoundary coordinates={coordinates} radius={radius} />
                
                {/* User location marker */}
                <Marker position={[coordinates.latitude, coordinates.longitude]} />

                {/* Sale markers */}
                {renderMarkers()}
              </MapContainer>
            </div>

            {/* Map Controls */}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="text-center p-4">
              <p className={`text-lg font-medium ${
                darkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>
                We need your location to show nearby sales
              </p>
              <button
                onClick={fetchLocation}
                className="bg-primary-600 text-white px-4 py-2 rounded-full hover:bg-primary-700 transition-colors duration-200"
              >
                Allow Location Access
              </button>
            </div>
          </div>
        )}
      </div>

      {/* List Section */}
      <div className="fixed top-[calc(45vh+4rem)] left-0 right-0 bottom-0 z-20">
        <div 
          ref={listContainerRef}
          className={`h-full ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg overflow-y-auto`}
        >
          <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
            {loading ? (
              <div className="flex justify-center items-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              </div>
            ) : error ? (
              <div className="text-red-500 text-center p-4">{error}</div>
            ) : sales.length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400 text-center p-4">No sales found in your area</div>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {sales.map((sale, index) => (
                  <div 
                    key={`list-${sale.id}-${index}`}
                    ref={el => setItemRef(index, el)}
                    className={`relative p-4 rounded-lg shadow-md ${
                      darkMode ? 'bg-gray-700' : 'bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="bg-primary-600 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center text-lg">
                          {index + 1}
                        </div>
                      </div>
                      <div className="flex-grow min-w-0">
                        <h3 className={`font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {(() => {
                            const eventType = eventTypes.find(type => type.id === sale.eventType);
                            return eventType ? `${eventType.emoji} ${eventType.name}` : 'Unknown Event Type';
                          })()}
                        </h3>
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} line-clamp-2`}>{sale.description}</p>
                        {sale.address && (
                          <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            📍 {sale.address}
                          </p>
                        )}
                        <p className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {sale.distance} {sale.distance === 1 ? 'mile' : 'miles'} away
                        </p>
                      </div>
                      <div className="flex-shrink-0 self-center">
                        <button
                          onClick={() => handleNavigateToSale(sale)}
                          className={`flex items-center justify-center p-2 rounded-full transition-colors duration-200 outline-none focus:outline-none ${
                            darkMode 
                              ? 'text-primary-400 bg-gray-700 hover:text-primary-300 hover:bg-gray-700 focus:bg-gray-700 active:bg-gray-700' 
                              : 'text-primary-600 bg-white hover:text-primary-700 hover:bg-gray-100 focus:bg-gray-100 active:bg-gray-100'
                          }`}
                          title="Get directions"
                          aria-label="Open navigation options"
                        >
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-6 w-6" 
                            viewBox="0 0 24 24" 
                            fill="currentColor"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                            <circle cx="12" cy="10" r="3" stroke="currentColor" fill="currentColor" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      {currentUser && (
        <button
          onClick={handleAddSaleClick}
          className={`fixed right-4 sm:right-8 bottom-4 sm:bottom-8 w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 z-40 ${
            userLiveSale?.status === 'live'
              ? 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800'
              : 'bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-800'
          }`}
        >
          {userLiveSale?.status === 'live' ? (
            <HiX className="w-6 h-6 text-white" />
          ) : (
            <HiPlus className="w-6 h-6 text-white" />
          )}
        </button>
      )}

      {/* Navigation Options Modal */}
      {isNavigationModalOpen && selectedSale?.id && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-25 z-50"
            onClick={() => setIsNavigationModalOpen(false)}
          />
          {/* Modal */}
          <div 
            ref={navigationModalRef}
            className={`fixed bottom-0 left-0 right-0 w-full sm:w-96 sm:left-auto sm:right-4 sm:bottom-4 transform transition-transform duration-200 ease-in-out ${
              isNavigationModalOpen ? 'translate-y-0' : 'translate-y-full'
            } z-50`}
          >
            <div className={`${
              darkMode ? 'bg-gray-800' : 'bg-white'
            } rounded-t-xl sm:rounded-xl shadow-lg`}>
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className={`text-lg font-medium ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Open directions in...
                </h3>
              </div>
              <div className="py-2">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedSale.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsNavigationModalOpen(false)}
                  className={`flex items-center px-4 py-3 text-base ${
                    darkMode 
                      ? 'text-gray-100 hover:bg-gray-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  role="menuitem"
                >
                  <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                  </svg>
                  Google Maps
                </a>
                <a
                  href={`maps://?q=${encodeURIComponent(selectedSale.address)}`}
                  onClick={() => setIsNavigationModalOpen(false)}
                  className={`flex items-center px-4 py-3 text-base ${
                    darkMode 
                      ? 'text-gray-100 hover:bg-gray-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  role="menuitem"
                >
                  <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                  </svg>
                  Apple Maps
                </a>
                <a
                  href={`waze://?q=${encodeURIComponent(selectedSale.address)}`}
                  onClick={() => setIsNavigationModalOpen(false)}
                  className={`flex items-center px-4 py-3 text-base ${
                    darkMode 
                      ? 'text-gray-100 hover:bg-gray-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  role="menuitem"
                >
                  <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                  </svg>
                  Waze
                </a>
              </div>
            </div>
          </div>
        </>
      )}
      {/* Create Sale Modal */}
      <Transition.Root show={isModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[9999]" onClose={setIsModalOpen}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-[9999] overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-0 text-center sm:items-center sm:p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left align-middle shadow-xl transition-all sm:my-8 w-full sm:max-w-lg sm:p-6">
                  <div className="w-full">
                    <div className="mt-3 text-center sm:mt-5">
                      <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                        Create a New Sale
                      </Dialog.Title>
                      <div className="mt-2">
                        <div className="space-y-4">
                          <div className="text-left">
                            <label htmlFor="eventType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Event Type
                            </label>
                            <select
                              id="eventType"
                              value={newSale.eventType}
                              onChange={(e) => setNewSale({ ...newSale, eventType: e.target.value })}
                              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 text-gray-900 dark:text-white"
                              required
                            >
                              <option value="">Select an event type</option>
                              {[...eventTypes]
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(type => (
                                  <option key={type.id} value={type.id}>{type.emoji} {type.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="text-left">
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Description
                            </label>
                            <textarea
                              id="description"
                              name="description"
                              value={newSale.description}
                              onChange={(e) => setNewSale({ ...newSale, description: e.target.value })}
                              required
                              rows={3}
                              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 text-gray-900 dark:text-white"
                              placeholder="Describe what you're selling..."
                            />
                          </div>
                          <div className="text-left mt-6">
                            <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Address
                            </label>
                            <div className="mt-1 w-full">
                              {isEditingAddress ? (
                                <div className="space-y-2 w-full">
                                  <input
                                    type="text"
                                    name="address"
                                    id="address"
                                    value={address}
                                    onChange={(e) => {
                                      setAddress(e.target.value);
                                      setAddressError('');
                                    }}
                                    placeholder="Enter full address (street, city, state, ZIP)"
                                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 px-3 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 text-gray-900 dark:text-white"
                                  />
                                  <div className="flex justify-end space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAddress(originalAddress);
                                        setIsEditingAddress(false);
                                        setAddressError('');
                                      }}
                                      className="inline-flex items-center rounded-md bg-white dark:bg-gray-700 px-2.5 py-1.5 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          // First validate that we can get coordinates from the address
                                          const addressInfo = await getAddressComponentsFromAddress(address);
                                          if (!addressInfo || !addressInfo.coordinates) {
                                            setAddressError('Invalid address. Please enter a valid address with street, city, state, and ZIP code.');
                                            return;
                                          }

                                          // Only check distance for non-admin users
                                          if (!isAdmin) {
                                            const distance = calculateDistance(
                                              coordinates.latitude,
                                              coordinates.longitude,
                                              addressInfo.coordinates.latitude,
                                              addressInfo.coordinates.longitude
                                            );

                                            // Only allow addresses within 0.5 miles of current location for non-admin users
                                            if (distance > 0.5) {
                                              setAddressError('Address must be within 0.5 miles of your current location.');
                                              return;
                                            }
                                          }

                                          // If all validations pass, update the coordinates and address
                                          setCoordinates({
                                            latitude: addressInfo.coordinates.latitude,
                                            longitude: addressInfo.coordinates.longitude
                                          });
                                          setAddress(addressInfo.formattedAddress);
                                          setValidatedAddressInfo(addressInfo);
                                          setIsEditingAddress(false);
                                          setAddressError('');
                                        } catch (error) {
                                          console.error('Error validating address:', error);
                                          setAddressError('Error validating address. Please try again.');
                                        }
                                      }}
                                      className="inline-flex items-center rounded-md bg-primary-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-primary-500"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between w-full">
                                  <span className="block flex-1 text-sm text-gray-700 dark:text-gray-300">
                                    {address || 'No address set'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setIsEditingAddress(true)}
                                    className="ml-2 inline-flex items-center rounded-md bg-white dark:bg-gray-700 px-2.5 py-1.5 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                                  >
                                    Edit
                                  </button>
                                </div>
                              )}
                              {addressError && (
                                <p className="mt-2 text-sm text-red-600 dark:text-red-500">{addressError}</p>
                              )}
                              {!isEditingAddress && address && (
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                  Your address will be automatically filled based on your location. You can edit it if needed for accuracy.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmationType('start');
                        setIsConfirmationOpen(true);
                      }}
                      disabled={isSubmitting || !newSale.eventType || !newSale.description || !address || addressError}
                      className={`inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:col-start-2 ${
                        isSubmitting || !newSale.eventType || !newSale.description || !address || addressError
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-primary-600 hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-primary-500'
                      }`}
                    >
                      {isSubmitting ? 'Creating...' : 'Create Sale'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 sm:col-start-1 sm:mt-0"
                    >
                      Cancel
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Confirmation Dialog */}
      <Transition appear show={isConfirmationOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[9999]" onClose={() => setIsConfirmationOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 z-[9999] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 dark:text-white"
                  >
                    {confirmationType === 'start' ? 'Start Live Sale?' : 'End Live Sale?'}
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {confirmationType === 'start'
                        ? 'Are you ready to start your live sale? This will make it visible to nearby users.'
                        : 'Are you sure you want to end your live sale? This action cannot be undone.'}
                    </p>
                  </div>

                  <div className="mt-4 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-primary-500"
                      onClick={() => setIsConfirmationOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={`inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                        confirmationType === 'start'
                          ? 'bg-primary-600 hover:bg-primary-500 focus-visible:ring-primary-500'
                          : 'bg-red-600 hover:bg-red-500 focus-visible:ring-red-500'
                      }`}
                      onClick={handleConfirmation}
                    >
                      {confirmationType === 'start' ? 'Start Sale' : 'End Sale'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

export default Home;
