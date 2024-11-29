/**
 * Clear Old Sales Script
 * 
 * CAUTION: This script permanently deletes all sales data from the database.
 * It should only be used in specific scenarios like:
 * - Cleaning up test data
 * - Preparing for a fresh start
 * - Database migration
 * 
 * Environment Variables Required:
 * GOOGLE_APPLICATION_CREDENTIALS - Path to the service account key file
 * CONFIRM_DELETE - Must be set to "yes" to proceed with deletion
 * 
 * Usage:
 * 1. Set up service account key file
 * 2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable
 * 3. Set CONFIRM_DELETE=yes
 * 4. Run script: node clearOldSales.js
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase Admin using environment credentials
const app = initializeApp()
const db = getFirestore()

/**
 * Clears all sales data from the database
 * Requires explicit confirmation via environment variable
 * 
 * @returns {Promise<void>}
 * @throws {Error} If confirmation is not provided or deletion fails
 */
async function clearOldSales() {
  // Safety check - require explicit confirmation
  if (process.env.CONFIRM_DELETE !== 'yes') {
    console.error('Error: CONFIRM_DELETE environment variable must be set to "yes"')
    console.error('This is a safety measure to prevent accidental data deletion')
    process.exit(1)
  }

  try {
    console.log('Starting database cleanup...')
    console.log('WARNING: This will permanently delete ALL sales data!')
    console.log('Press Ctrl+C within 5 seconds to abort')
    
    // Give user 5 seconds to abort
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Get all sales
    const salesSnapshot = await db.collection('sales').get()
    const totalSales = salesSnapshot.docs.length
    
    if (totalSales === 0) {
      console.log('No sales found in database')
      process.exit(0)
    }
    
    console.log(`Found ${totalSales} sales to delete`)

    // Delete each sale
    let deletedCount = 0
    const startTime = Date.now()
    
    for (const saleDoc of salesSnapshot.docs) {
      await db.collection('sales').doc(saleDoc.id).delete()
      deletedCount++
      
      // Log progress every 10%
      if (deletedCount % Math.max(1, Math.floor(totalSales / 10)) === 0) {
        const percentComplete = ((deletedCount / totalSales) * 100).toFixed(1)
        console.log(`Progress: ${percentComplete}% (${deletedCount}/${totalSales})`)
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log('\nCleanup Summary:')
    console.log('-----------------')
    console.log(`Total Sales Deleted: ${deletedCount}`)
    console.log(`Time Taken: ${duration} seconds`)
    
    process.exit(0)
  } catch (error) {
    console.error('Error during cleanup:', error.message)
    process.exit(1)
  }
}

// Run the function
clearOldSales()
