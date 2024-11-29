# Local Sales Finder

A modern web application that helps users discover and navigate to local sales events in their area. Whether you're hunting for garage sales, estate sales, or yard sales, Local Sales Finder makes it easy to find and plan your treasure hunting adventures.

## Features

### Interactive Map View
- Real-time location-based display of nearby sales
- Custom numbered markers for easy reference
- Click-to-scroll synchronization with list view
- Visual radius indicator for search area

### Detailed List View
- Comprehensive sale information including:
  - Event type with descriptive emoji
  - Detailed description
  - Distance from current location
  - Full address
  - Quick navigation options
- Synchronized with map markers for easy reference
- Smooth scrolling behavior

### User Experience
- Clean, modern interface
- Dark mode support
- Responsive design for all devices
- Real-time updates
- One-click navigation options
- Location-based filtering

### Event Management
- Multiple event type support
- Custom emoji for each event type
- Distance-based sorting
- Detailed event information

## Technologies Used

### Frontend
- **React**: Component-based UI development
- **Tailwind CSS**: Utility-first styling with dark mode support
- **React Router**: Client-side routing
- **Leaflet/React-Leaflet**: Interactive mapping
- **Headless UI**: Accessible UI components
- **React Icons**: Comprehensive icon library

### Backend & Infrastructure
- **Firebase**:
  - Authentication
  - Firestore database
  - Hosting
  - Analytics
- **Geolocation Services**: Browser-based location services

### Development Tools
- **Windsurf IDE**: Advanced AI-powered development environment
- **Vite**: Next-generation frontend tooling
- **ESLint**: Code quality and style enforcement
- **Git**: Version control

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Firebase account
- Modern web browser

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/local-sales-finder.git
   ```

2. Install dependencies:
   ```bash
   cd local-sales-finder
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add your Firebase configuration:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Development with Windsurf
This project is developed using Windsurf, a cutting-edge IDE that provides:
- AI-powered code assistance
- Intelligent code navigation
- Advanced refactoring capabilities
- Context-aware code completion
- Integrated version control

## Contributing
We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments
- OpenStreetMap for map data
- Firebase team for the excellent backend services
- Windsurf team for the amazing development environment
- All contributors and users of the application

## Project Status
For detailed information about the project's current status, planned features, and technical decisions, please see our [Project Status](PROJECT_STATUS.md) document.
