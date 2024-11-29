/**
 * Sales Verification Script
 * 
 * This script connects to Firebase Admin SDK to verify and list all sales in the database.
 * It requires a service account key file for authentication.
 * 
 * Environment Variables Required:
 * GOOGLE_APPLICATION_CREDENTIALS - Path to the service account key file
 * 
 * Usage:
 * 1. Set up service account key file
 * 2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable
 * 3. Run script: node checkSales.js
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase Admin using environment credentials
const app = initializeApp()
const db = getFirestore()

/**
 * Retrieves and logs all sales from the database
 * Useful for verifying sale data integrity and monitoring sale status
 * 
 * @returns {Promise<void>}
 */
async function checkSales() {
  try {
    const salesRef = db.collection('sales')
    const snapshot = await salesRef.get()
    
    if (snapshot.empty) {
      console.log('No sales found in database')
      return
    }

    console.log('Current Sales:')
    console.log('--------------')
    
    snapshot.forEach((doc) => {
      const sale = doc.data()
      console.log(`ID: ${doc.id}`)
      console.log(`Location: ${sale.city}, ${sale.state}`)
      console.log(`Address: ${sale.address}`)
      console.log(`Status: ${sale.status}`)
      console.log('--------------')
    })
  } catch (error) {
    console.error('Error checking sales:', error.message)
    process.exit(1)
  }
}

// Execute the function
checkSales()
