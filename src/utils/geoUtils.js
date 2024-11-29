/**
 * Geolocation utility functions for calculating distances and handling coordinates
 */

/**
 * Calculates the distance between two points on Earth using the Haversine formula
 * 
 * @param {number} lat1 - Latitude of first point in degrees
 * @param {number} lon1 - Longitude of first point in degrees
 * @param {number} lat2 - Latitude of second point in degrees
 * @param {number} lon2 - Longitude of second point in degrees
 * @returns {number} Distance in miles
 * 
 * @example
 * const distance = calculateDistance(37.7749, -122.4194, 34.0522, -118.2437);
 * console.log(`Distance: ${distance} miles`);
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959 // Earth's radius in miles
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // Distance in miles
}

/**
 * Converts degrees to radians
 * @param {number} value - Angle in degrees
 * @returns {number} Angle in radians
 * @private
 */
const toRad = (value) => (value * Math.PI) / 180

/**
 * Calculates the bounding box coordinates for a given center point and radius
 * 
 * @param {number} lat - Center latitude in degrees
 * @param {number} lon - Center longitude in degrees
 * @param {number} radiusMiles - Radius in miles
 * @returns {{lat1: number, lat2: number, lon1: number, lon2: number}} Bounding box coordinates
 * 
 * @example
 * const bounds = getBounds(37.7749, -122.4194, 10);
 * // Use bounds for querying locations within radius
 */
export const getBounds = (lat, lon, radiusMiles) => {
  const R = 3959 // Earth's radius in miles
  const lat1 = lat - (radiusMiles / R) * (180 / Math.PI)
  const lat2 = lat + (radiusMiles / R) * (180 / Math.PI)
  const lon1 = lon - (radiusMiles / R) * (180 / Math.PI) / Math.cos(toRad(lat))
  const lon2 = lon + (radiusMiles / R) * (180 / Math.PI) / Math.cos(toRad(lat))
  return { lat1, lat2, lon1, lon2 }
}

/**
 * Gets a human-readable address from coordinates using OpenStreetMap's Nominatim service
 * Note: For production use, consider rate limits and terms of service
 * 
 * @param {number} latitude - Latitude in degrees
 * @param {number} longitude - Longitude in degrees
 * @returns {Promise<string|null>} Address string or null if not found
 * 
 * @example
 * const address = await getAddressFromCoordinates(37.7749, -122.4194);
 * if (address) {
 *   console.log(`Location: ${address}`);
 * }
 */
export const getAddressFromCoordinates = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
    )
    const data = await response.json()
    return data.display_name || null
  } catch (error) {
    return null
  }
}
