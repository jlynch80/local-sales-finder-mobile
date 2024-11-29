/**
 * Location utility functions for handling geolocation and address formatting
 */

/**
 * Gets the user's current location and formats it into a readable address
 * Uses the browser's Geolocation API and OpenStreetMap's Nominatim service
 * 
 * @returns {Promise<{
 *   latitude: number,
 *   longitude: number,
 *   address: string,
 *   rawAddress: Object
 * }>} Object containing coordinates and formatted address
 * 
 * @throws {Error} If geolocation is not supported, permission is denied,
 *                 or location/address lookup fails
 * 
 * @example
 * try {
 *   const location = await getCurrentLocation();
 *   console.log(`Current location: ${location.address}`);
 * } catch (error) {
 *   // Handle geolocation errors
 * }
 */
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords
          
          // Get address details using Nominatim
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
          )
          const data = await response.json()
          
          // Format address from most specific to least specific components
          const locationParts = []
          if (data.address.house_number) locationParts.push(data.address.house_number)
          if (data.address.road) locationParts.push(data.address.road)
          if (data.address.suburb) locationParts.push(data.address.suburb)
          if (data.address.city || data.address.town) locationParts.push(data.address.city || data.address.town)
          if (data.address.state) locationParts.push(data.address.state)
          
          resolve({
            latitude,
            longitude,
            address: locationParts.join(', '),
            rawAddress: data.address
          })
        } catch (error) {
          reject(new Error('Failed to get location details'))
        }
      },
      (error) => {
        reject(
          error.code === 1
            ? new Error('Please allow location access to create a sale')
            : new Error('Error getting your location')
        )
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  })
}
