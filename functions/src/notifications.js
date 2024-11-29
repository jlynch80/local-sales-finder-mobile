const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3963.0; // Radius of the Earth in miles
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const latDiff = ((lat2 - lat1) * Math.PI) / 180;
  const lonDiff = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(latDiff / 2) * Math.sin(latDiff / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(lonDiff / 2) *
      Math.sin(lonDiff / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Function to send notification to a specific user
async function sendNotificationToUser(token, saleEvent) {
  const message = {
    token: token,
    notification: {
      title: 'New Sale Event Nearby!',
      body: `${saleEvent.title} starting at ${new Date(saleEvent.startDate).toLocaleDateString()}`,
    },
    data: {
      eventId: saleEvent.id,
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
    webpush: {
      fcm_options: {
        link: `/event/${saleEvent.id}`,
      },
    },
  };

  try {
    await messaging.send(message);
    console.log('Successfully sent notification to token:', token);
  } catch (error) {
    console.error('Error sending notification:', error);
    if (error.code === 'messaging/registration-token-not-registered') {
      // Token is invalid, remove it from the database
      const tokenDocs = await db
        .collectionGroup('tokens')
        .where('token', '==', token)
        .get();
      
      for (const doc of tokenDocs.docs) {
        await doc.ref.delete();
      }
    }
  }
}

// Cloud Function triggered when a new sale event is created
exports.onNewSaleEvent = functions.firestore
  .document('saleEvents/{eventId}')
  .onCreate(async (snap, context) => {
    const saleEvent = { id: context.params.eventId, ...snap.data() };
    
    // Get all user tokens
    const tokenDocs = await db.collectionGroup('tokens').get();
    
    // For each token, check if the sale event is within the user's search radius
    const notificationPromises = tokenDocs.docs.map(async (tokenDoc) => {
      const tokenData = tokenDoc.data();
      
      if (!tokenData.location || !tokenData.searchRadius) {
        return;
      }

      const distance = calculateDistance(
        tokenData.location.latitude,
        tokenData.location.longitude,
        saleEvent.location.latitude,
        saleEvent.location.longitude
      );

      // If the sale event is within the user's search radius, send a notification
      if (distance <= tokenData.searchRadius) {
        await sendNotificationToUser(tokenData.token, saleEvent);
      }
    });

    await Promise.all(notificationPromises);
  });
