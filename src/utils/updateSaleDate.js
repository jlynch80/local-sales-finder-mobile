/**
 * Utility function to update a sale's date to the current time
 * 
 * @param {string} saleId - The ID of the sale to update
 * @returns {Promise<boolean>} True if update was successful, false otherwise
 * 
 * @example
 * const success = await updateSaleDate('sale123');
 * if (!success) {
 *   // Handle error
 * }
 */

import { doc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

export const updateSaleDate = async (saleId) => {
  try {
    const saleRef = doc(db, 'sales', saleId)
    const currentDate = new Date()
    await updateDoc(saleRef, {
      date: Timestamp.fromDate(currentDate)
    })
    return true
  } catch (error) {
    return false
  }
}
