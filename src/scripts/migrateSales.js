/**
 * Sales Data Migration Script
 * 
 * This script updates existing sale records by extracting and populating city information
 * from address strings. It's designed to be run as a one-time migration task.
 * 
 * Environment Variables Required:
 * GOOGLE_APPLICATION_CREDENTIALS - Path to the service account key file
 * 
 * Usage:
 * 1. Set up service account key file
 * 2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable
 * 3. Run script: node migrateSales.js
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase Admin using environment credentials
const app = initializeApp()
const db = getFirestore()

/**
 * Extracts city name from a full address string
 * Assumes standard US address format: street, city, state zip, country
 * 
 * @param {string} address - Full address string
 * @returns {string|null} Extracted city name or null if not found
 * @private
 */
function extractCityFromAddress(address) {
  try {
    // Split address by commas and clean up whitespace
    const parts = address.split(',').map(part => part.trim())
    
    // For US addresses, city is typically the second-to-last part before state and ZIP
    // Format: [street], [city], [state] [zip], [country]
    if (parts.length >= 3) {
      return parts[parts.length - 3]
    }
    return null
  } catch (error) {
    return null
  }
}

/**
 * Migrates sale records by extracting and updating city information
 * Only processes records that don't already have city data
 * 
 * @returns {Promise<void>}
 */
async function migrateSales() {
  try {
    console.log('Starting sales migration...')
    const salesRef = db.collection('sales')
    const snapshot = await salesRef.get()
    
    let processed = 0
    let updated = 0
    let skipped = 0
    let failed = 0
    
    for (const doc of snapshot.docs) {
      const sale = doc.data()
      processed++
      
      // Skip if city is already populated
      if (sale.city) {
        skipped++
        continue
      }

      // Skip if no address
      if (!sale.address) {
        skipped++
        continue
      }

      const city = extractCityFromAddress(sale.address)
      
      if (city) {
        await salesRef.doc(doc.id).update({ city })
        updated++
      } else {
        failed++
      }
    }

    console.log('\nMigration Summary:')
    console.log('-----------------')
    console.log(`Total Processed: ${processed}`)
    console.log(`Updated: ${updated}`)
    console.log(`Skipped: ${skipped}`)
    console.log(`Failed: ${failed}`)
    
  } catch (error) {
    console.error('Migration failed:', error.message)
    process.exit(1)
  }
}

// Execute the migration
migrateSales()
