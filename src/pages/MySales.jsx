import React, { useState, useEffect, Fragment } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ConfirmationModal from '../components/ConfirmationModal';
import NotificationPreferences from '../components/NotificationPreferences';
import { Dialog, Transition } from '@headlessui/react';
import { HiPlus, HiX } from 'react-icons/hi';

// Function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Convert kilometers to miles
  return distance * 0.621371;
}

export default function MySales() {
  const [sales, setSales] = useState([]);
  const [eventTypes, setEventTypes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentUser, isAdmin } = useAuth();
  const { darkMode } = useTheme();
  const [modalState, setModalState] = useState({
    isOpen: false,
    saleId: null
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSale, setNewSale] = useState({
    eventType: '',
    description: '',
  });
  const [address, setAddress] = useState('');
  const [addressError, setAddressError] = useState('');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [originalAddress, setOriginalAddress] = useState('');
  const [coordinates, setCoordinates] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [userLiveSale, setUserLiveSale] = useState(null);

  useEffect(() => {
    fetchMySales();
  }, [currentUser]);

  const fetchMySales = async () => {
    try {
      // Fetch event types first
      const eventTypesSnapshot = await getDocs(collection(db, 'eventTypes'));
      const eventTypesMap = {};
      eventTypesSnapshot.forEach(doc => {
        eventTypesMap[doc.id] = {
          name: doc.data().name,
          emoji: doc.data().emoji
        };
      });
      setEventTypes(eventTypesMap);

      // Fetch sales
      const q = query(
        collection(db, 'sales'),
        where('userId', '==', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const salesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Find user's live sale
      const liveSale = salesData.find(sale => sale.status === 'live');
      setUserLiveSale(liveSale || null);

      // Sort sales by creation date (newest first)
      salesData.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
      
      setSales(salesData);
    } catch (error) {
      console.error('Error fetching sales:', error);
      setError('Failed to load your sales');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (saleId, newStatus) => {
    if (newStatus === 'ended') {
      setModalState({
        isOpen: true,
        saleId
      });
      return;
    }

    try {
      const saleRef = doc(db, 'sales', saleId);
      const updates = {
        status: newStatus
      };

      if (newStatus === 'live') {
        updates.startedAt = Timestamp.now();
      } else if (newStatus === 'ended') {
        updates.endedAt = Timestamp.now();
      }

      await updateDoc(saleRef, updates);
      await fetchMySales(); // Refresh the list
    } catch (error) {
      console.error('Error updating sale status:', error);
      setError('Failed to update sale status');
    }
  };

  const handleConfirmEnd = async () => {
    try {
      const saleRef = doc(db, 'sales', modalState.saleId);
      const updates = {
        status: 'ended',
        endedAt: Timestamp.now()
      };

      await updateDoc(saleRef, updates);
      await fetchMySales(); // Refresh the list
      setModalState({ isOpen: false, saleId: null });
    } catch (error) {
      console.error('Error ending sale:', error);
      setError('Failed to end sale');
      setModalState({ isOpen: false, saleId: null });
    }
  };

  const handleEndSale = async () => {
    if (!userLiveSale) return;

    try {
      const saleRef = doc(db, 'sales', userLiveSale.id);
      await updateDoc(saleRef, {
        status: 'ended',
        endedAt: Timestamp.now()
      });

      // Update local state
      setUserLiveSale(null);
      setSales(prevSales => 
        prevSales.map(sale => 
          sale.id === userLiveSale.id 
            ? { ...sale, status: 'ended', endedAt: Timestamp.now() }
            : sale
        )
      );

      setModalState({ isOpen: false, saleId: null });
    } catch (error) {
      console.error('Error ending sale:', error);
      setError('Failed to end sale. Please try again.');
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'draft':
        return darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800';
      case 'live':
        return darkMode ? 'bg-green-700 text-green-300' : 'bg-green-100 text-green-800';
      case 'ended':
        return darkMode ? 'bg-red-700 text-red-300' : 'bg-red-100 text-red-800';
      default:
        return darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800';
    }
  };

  const getCoordinatesFromAddress = async (address) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          address
        )}&key=${import.meta.env.VITE_GOOGLE_GEOCODING_API_KEY}`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        const { lat, lng } = result.geometry.location;
        
        // Extract address components
        let city = '';
        let state = '';
        let zipCode = '';
        let country = '';
        let streetNumber = '';
        let route = '';
        
        result.address_components.forEach(component => {
          // Some cities (like Providence Village, TX) are classified as neighborhoods
          // with types ["neighborhood", "political"] rather than as localities
          if (component.types.includes('locality') || 
              (component.types.includes('neighborhood') && component.types.includes('political')) ||
              component.types.includes('sublocality') ||
              component.types.includes('postal_town') ||
              component.types.includes('administrative_area_level_3')) {
            city = component.long_name;
          } else if (component.types.includes('administrative_area_level_1')) {
            state = component.short_name; // Using short_name to get state code (e.g., 'CA' instead of 'California')
          } else if (component.types.includes('postal_code')) {
            zipCode = component.long_name;
          } else if (component.types.includes('country')) {
            country = component.long_name;
          } else if (component.types.includes('street_number')) {
            streetNumber = component.long_name;
          } else if (component.types.includes('route')) {
            route = component.long_name;
          }
        });

        // Fallback: if no city found, try one more time with any remaining valid types
        if (!city) {
          result.address_components.forEach(component => {
            if (!city && (
                component.types.includes('neighborhood') ||
                component.types.includes('sublocality_level_1')
            )) {
              city = component.long_name;
            }
          });
        }

        return {
          latitude: lat,
          longitude: lng,
          formattedAddress: result.formatted_address,
          streetAddress: streetNumber && route ? `${streetNumber} ${route}` : '',
          city,
          state,
          zipCode,
          country
        };
      }
      return null;
    } catch (error) {
      console.error('Error geocoding address:', error);
      return null;
    }
  };

  const getCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000,
        });
      });

      const { latitude, longitude } = position.coords;
      setCoordinates({ latitude, longitude });

      // Get address from coordinates
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_GEOCODING_API_KEY}`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        
        // Extract city and state from address components
        let city = '';
        let state = '';
        
        result.address_components.forEach(component => {
          // Some cities (like Providence Village, TX) are classified as neighborhoods
          // with types ["neighborhood", "political"] rather than as localities
          if (component.types.includes('locality') || 
              (component.types.includes('neighborhood') && component.types.includes('political')) ||
              component.types.includes('sublocality') ||
              component.types.includes('postal_town') ||
              component.types.includes('administrative_area_level_3')) {
            city = component.long_name;
          } else if (component.types.includes('administrative_area_level_1')) {
            state = component.short_name;
          }
        });

        // Fallback: if no city found, try one more time with any remaining valid types
        if (!city) {
          result.address_components.forEach(component => {
            if (!city && (
                component.types.includes('neighborhood') ||
                component.types.includes('sublocality_level_1')
            )) {
              city = component.long_name;
            }
          });
        }

        setAddress(result.formatted_address);
        setOriginalAddress(result.formatted_address);
        // Store these for when creating the sale
        setCoordinates({
          latitude,
          longitude,
          city,
          state
        });
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      // Don't show an error, just let user input address manually
    } finally {
      setLocationLoading(false);
    }
  };

  const handleCreateSale = async (e) => {
    e.preventDefault();
    
    try {
      if (!newSale.eventType || !newSale.description || !address) {
        setError('Please fill in all required fields');
        return;
      }

      const addressInfo = await getCoordinatesFromAddress(address);
      if (!addressInfo) {
        setError('Failed to validate address');
        return;
      }

      // Only check distance for non-admin users
      if (!isAdmin && coordinates) {
        const distance = calculateDistance(
          coordinates.latitude,
          coordinates.longitude,
          addressInfo.latitude,
          addressInfo.longitude
        );

        // Only allow addresses within 0.5 miles of current location for non-admin users
        if (distance > 0.5) {
          setError('Address must be within 0.5 miles of your current location.');
          return;
        }
      }

      const sale = {
        userId: currentUser.uid,
        eventType: newSale.eventType,
        description: newSale.description,
        location: {
          latitude: addressInfo.latitude,
          longitude: addressInfo.longitude
        },
        status: 'live',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        address: addressInfo.formattedAddress,
        streetAddress: addressInfo.streetAddress,
        city: addressInfo.city,
        state: addressInfo.state,
        zipCode: addressInfo.zipCode,
        country: addressInfo.country
      };

      const docRef = await addDoc(collection(db, 'sales'), sale);
      
      const newSaleWithId = {
        id: docRef.id,
        ...sale
      };

      // Add the new sale to the local state
      setSales(prevSales => [newSaleWithId, ...prevSales]);
      
      // Update userLiveSale state since this is a new live sale
      setUserLiveSale(newSaleWithId);
      
      setIsCreateModalOpen(false);
      setNewSale({ eventType: '', description: '' });
      setAddress('');
      setError('');
    } catch (error) {
      console.error('Error creating sale:', error);
      setError('Failed to create sale. Please try again.');
    }
  };

  const openCreateModal = async () => {
    setIsCreateModalOpen(true);
    setNewSale({ eventType: '', description: '' });
    setAddressError('');
    await getCurrentLocation();
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} py-6 flex flex-col justify-center sm:py-12`}>
        <div className="relative py-3 sm:max-w-xl sm:mx-auto w-full px-4 sm:px-0">
          <div className="text-center">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConfirmationModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, saleId: null })}
        onConfirm={userLiveSale ? handleEndSale : handleConfirmEnd}
        title="End Sale"
        message="Are you sure you want to end this sale? This action cannot be undone."
      />

      {/* Create Sale Modal */}
      <Transition.Root show={isCreateModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[9999]" onClose={setIsCreateModalOpen}>
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
                <Dialog.Panel className={`relative transform overflow-hidden rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 w-full sm:max-w-lg sm:p-6`}>
                  <div className="w-full">
                    <div className="mt-3 text-center sm:mt-5">
                      <Dialog.Title as="h3" className={`text-base font-semibold leading-6 ${darkMode ? 'text-white' : 'text-gray-900'} sm:text-3xl sm:truncate`}>
                        Create a New Sale
                      </Dialog.Title>
                      <div className="mt-2">
                        <form onSubmit={handleCreateSale} className="space-y-4">
                          <div className="text-left">
                            <label htmlFor="eventType" className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Event Type
                            </label>
                            <select
                              id="eventType"
                              value={newSale.eventType}
                              onChange={(e) => setNewSale({ ...newSale, eventType: e.target.value })}
                              className={`mt-1 block w-full rounded-md border ${darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'} py-2 px-3 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500`}
                              required
                            >
                              <option value="">Select an event type</option>
                              {Object.entries(eventTypes).map(([id, type]) => (
                                <option key={id} value={id}>{type.emoji} {type.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="text-left">
                            <label htmlFor="description" className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Description
                            </label>
                            <textarea
                              id="description"
                              name="description"
                              value={newSale.description}
                              onChange={(e) => setNewSale({ ...newSale, description: e.target.value })}
                              required
                              rows={3}
                              className={`mt-1 block w-full rounded-md border ${darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'} py-2 px-3 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500`}
                              placeholder="Describe what you're selling..."
                            />
                          </div>
                          <div className="text-left mt-6">
                            <label htmlFor="address" className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
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
                                    className={`mt-1 block w-full rounded-md border ${darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'} py-2 px-3 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500`}
                                  />
                                  <div className="flex justify-end space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAddress(originalAddress);
                                        setIsEditingAddress(false);
                                        setAddressError('');
                                      }}
                                      className={`inline-flex items-center rounded-md ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-900 hover:bg-gray-50'} px-2.5 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600`}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          const addressInfo = await getCoordinatesFromAddress(address);
                                          if (!addressInfo) {
                                            setAddressError('Invalid address. Please enter a valid address with street, city, state, and ZIP code.');
                                            return;
                                          }

                                          // Only check distance for non-admin users
                                          if (!isAdmin && coordinates) {
                                            const distance = calculateDistance(
                                              coordinates.latitude,
                                              coordinates.longitude,
                                              addressInfo.latitude,
                                              addressInfo.longitude
                                            );

                                            // Only allow addresses within 0.5 miles of current location for non-admin users
                                            if (distance > 0.5) {
                                              setAddressError('Address must be within 0.5 miles of your current location.');
                                              return;
                                            }
                                          }

                                          // If all validations pass, update the coordinates and address
                                          setCoordinates({
                                            latitude: addressInfo.latitude,
                                            longitude: addressInfo.longitude
                                          });
                                          setAddress(addressInfo.formattedAddress);
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
                                    className={`ml-2 inline-flex items-center rounded-md ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-900 hover:bg-gray-50'} px-2.5 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600`}
                                  >
                                    Edit
                                  </button>
                                </div>
                              )}
                              {!isEditingAddress && address && (
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                  Your address will be automatically filled based on your location. You can edit it if needed for accuracy.
                                </p>
                              )}
                              {addressError && (
                                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                                  {addressError}
                                </p>
                              )}
                              {locationLoading && (
                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                  Loading location...
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                            <button
                              type="submit"
                              className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-primary-500 sm:col-start-2"
                            >
                              Create Sale
                            </button>
                            <button
                              type="button"
                              className={`mt-3 inline-flex w-full justify-center rounded-md ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-900 hover:bg-gray-50'} px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-inset ring-gray-300 sm:col-start-1 sm:mt-0`}
                              onClick={() => setIsCreateModalOpen(false)}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} py-6 sm:py-12`}>
        {/* Floating Action Button */}
        {userLiveSale ? (
          <button
            onClick={() => setModalState({ isOpen: true, saleId: userLiveSale.id })}
            className={`fixed right-4 sm:right-8 bottom-4 sm:bottom-8 w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 z-40 ${
              darkMode 
                ? 'bg-red-700 hover:bg-red-800 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title="End current sale"
          >
            <HiX className="h-8 w-8" />
          </button>
        ) : (
          <button
            onClick={openCreateModal}
            className={`fixed right-4 sm:right-8 bottom-4 sm:bottom-8 w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 z-40 ${
              darkMode 
                ? 'bg-primary-700 hover:bg-primary-800 text-white' 
                : 'bg-primary-600 hover:bg-primary-700 text-white'
            }`}
            title="Create new sale"
          >
            <HiPlus className="h-8 w-8" />
          </button>
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <NotificationPreferences />
            {error && (
              <div className={`p-4 rounded-md mb-6 ${
                darkMode 
                  ? 'bg-red-900 border border-red-700 text-red-100' 
                  : 'bg-red-100 border border-red-400 text-red-700'
              }`} role="alert">
                <p>{error}</p>
              </div>
            )}

            {sales.length === 0 ? (
              <div className={`text-center py-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <p className="text-lg">
                  No sales yet
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sales.map((sale) => (
                  <div
                    key={sale.id}
                    className={`relative rounded-lg p-6 ${
                      darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100'
                    } transition-all duration-200 shadow-sm hover:shadow-md`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-lg ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                            {eventTypes[sale.eventType] 
                              ? `${eventTypes[sale.eventType].emoji} ${eventTypes[sale.eventType].name}`
                              : 'Unknown Type'
                            }
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(sale.status)}`}>
                            {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
                          </span>
                        </div>
                        <p className={`mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          {sale.description}
                        </p>
                        <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {sale.address}
                        </p>
                        <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Created: {new Date(sale.createdAt.seconds * 1000).toLocaleDateString()}
                          {sale.startedAt && ` • Started: ${new Date(sale.startedAt.seconds * 1000).toLocaleDateString()}`}
                          {sale.endedAt && ` • Ended: ${new Date(sale.endedAt.seconds * 1000).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="ml-4 flex-shrink-0 flex flex-col gap-2">
                        {sale.status === 'draft' && (
                          <button
                            onClick={() => handleStatusChange(sale.id, 'live')}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                          >
                            Go Live
                          </button>
                        )}
                        {sale.status === 'live' && (
                          <button
                            onClick={() => handleStatusChange(sale.id, 'ended')}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            End Sale
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
