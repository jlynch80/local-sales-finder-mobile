/**
 * Analytics Component
 * 
 * Displays comprehensive analytics for sales data including:
 * - Sales statistics and metrics
 * - Interactive heat map showing sale locations
 * - Charts showing sales by month and day
 * - Detailed sales breakdown by region, city, and event type
 * - Filterable list of all sales
 * 
 * Features:
 * - Responsive design for mobile and desktop
 * - Dark/light mode support
 * - Interactive charts with organized legends
 * - Google Maps integration with heat map visualization
 * - Infinite scroll for sales list
 * - Advanced filtering capabilities
 */

import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { Bar } from 'react-chartjs-2';
import InfiniteScroll from 'react-infinite-scroll-component';

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const libraries = ['visualization', 'places'];
const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '0.5rem'
};

const center = {
  lat: 37.0902,
  lng: -95.7129
};

const regions = {
  'Northeast': ['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA'],
  'Midwest': ['OH', 'MI', 'IN', 'IL', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'],
  'South': ['DE', 'MD', 'DC', 'VA', 'WV', 'NC', 'SC', 'GA', 'FL', 'KY', 'TN', 'AL', 'MS', 'AR', 'LA', 'OK', 'TX'],
  'West': ['MT', 'ID', 'WY', 'CO', 'NM', 'AZ', 'UT', 'NV', 'CA', 'OR', 'WA', 'AK', 'HI']
};

// State name to abbreviation mapping
const stateMapping = {
  'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
  'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA',
  'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA',
  'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
  'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
  'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH',
  'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT',
  'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY',
  'DISTRICT OF COLUMBIA': 'DC'
};

// Create reverse mapping from state codes to names
const stateCodeToName = Object.entries(stateMapping).reduce((acc, [name, code]) => {
  acc[code] = name.charAt(0) + name.slice(1).toLowerCase();
  return acc;
}, {});

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const dayNames = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday'
];

const useWindowSize = () => {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
};

export default function Analytics() {
  const [stats, setStats] = useState({
    totalSales: 0,
    activeSales: 0,
    totalUsers: 0,
    activeUsers: 0,
    averageSaleDuration: 0,
    salesByEventType: {},
    salesByDay: {},
    salesByMonth: {},
    eventTypes: {},
    allSales: [],
    salesByCity: {},
    salesByState: {},
    salesByRegion: {},
    heatmapData: [],
    loading: true,
    error: null
  });

  const [displayedSales, setDisplayedSales] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState({
    eventType: '',
    status: '',
    dateRange: {
      start: '',
      end: ''
    },
    searchQuery: ''
  });
  const itemsPerPage = 10;

  const [mapInstance, setMapInstance] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { darkMode } = useTheme();

  // Get the appropriate Map ID based on theme
  const currentMapId = darkMode 
    ? import.meta.env.VITE_GOOGLE_MAPS_ID_DARK 
    : import.meta.env.VITE_GOOGLE_MAPS_ID_LIGHT;

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries
  });

  const { width: windowWidth } = useWindowSize();
  const isMobile = windowWidth < 768; // md breakpoint in Tailwind

  // Get chart height based on screen size
  const getChartHeight = () => {
    if (isMobile) {
      return 400; // Taller on mobile
    }
    return 300; // Default height for desktop
  };

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }

    const fetchAnalytics = async () => {
      try {
        // Get event types first
        const eventTypesRef = collection(db, 'eventTypes');
        const eventTypesSnapshot = await getDocs(eventTypesRef);
        const eventTypesMap = {};
        eventTypesSnapshot.forEach(doc => {
          eventTypesMap[doc.id] = {
            name: doc.data().name,
            emoji: doc.data().emoji
          };
        });

        // Get all sales
        const salesRef = collection(db, 'sales');
        const salesSnapshot = await getDocs(salesRef);
        const sales = salesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Get all users
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        const users = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Calculate statistics
        const activeSales = sales.filter(sale => sale.status === 'live').length;
        const salesByType = {};
        const salesByDayMap = {};
        const salesByMonthMap = {};
        const salesByEventTypeAndDay = {};
        const salesByEventTypeAndMonth = {};
        const salesByCity = {};
        const salesByState = {};
        const salesByRegion = {};
        const heatmapData = [];
        let totalDuration = 0;
        let salesWithDuration = 0;

        // Initialize event type maps
        Object.keys(eventTypesMap).forEach(eventType => {
          salesByType[eventType] = 0;
          salesByEventTypeAndDay[eventType] = Array(7).fill(0);
          salesByEventTypeAndMonth[eventType] = Array(12).fill(0);
        });

        // Initialize region counts
        Object.keys(regions).forEach(region => {
          salesByRegion[region] = 0;
        });

        // Initialize day and month arrays
        const salesByDayArray = Array(7).fill(0);
        const salesByMonthArray = Array(12).fill(0);

        sales.forEach(sale => {
          const date = new Date(sale.createdAt.seconds * 1000);
          const dayIndex = date.getDay();
          const monthIndex = date.getMonth();

          // Count sales by event type
          salesByType[sale.eventType] = (salesByType[sale.eventType] || 0) + 1;

          // Count sales by day and event type
          salesByDayArray[dayIndex]++;
          if (salesByEventTypeAndDay[sale.eventType]) {
            salesByEventTypeAndDay[sale.eventType][dayIndex]++;
          }

          // Count sales by month and event type
          salesByMonthArray[monthIndex]++;
          if (salesByEventTypeAndMonth[sale.eventType]) {
            salesByEventTypeAndMonth[sale.eventType][monthIndex]++;
          }

          // Calculate duration for ended sales
          if (sale.status === 'ended' && sale.endedAt) {
            const duration = (sale.endedAt.seconds - sale.createdAt.seconds) / 3600;
            totalDuration += duration;
            salesWithDuration++;
          }

          // Process location data
          if (sale.location && sale.location.latitude && sale.location.longitude) {
            heatmapData.push({
              lat: sale.location.latitude,
              lng: sale.location.longitude,
              weight: 1
            });
          }

          // Process city and state data
          if (sale.city && sale.state) {
            const city = sale.city;
            const state = sale.state.toUpperCase();
            
            const cityStateKey = `${city}, ${state}`;
            salesByCity[cityStateKey] = (salesByCity[cityStateKey] || 0) + 1;
            salesByState[state] = (salesByState[state] || 0) + 1;

            // Count sales by region
            Object.entries(regions).forEach(([region, states]) => {
              if (states.includes(state)) {
                salesByRegion[region]++;
              }
            });
          }
        });

        // Prepare chart data
        const monthlyChartData = {
          labels: monthNames,
          datasets: [
            ...Object.entries(salesByEventTypeAndMonth).map(([eventType, data], index) => ({
              type: 'bar',
              label: `${eventTypesMap[eventType]?.emoji} ${eventTypesMap[eventType]?.name}`,
              data: data,
              backgroundColor: `hsla(${index * 360 / Object.keys(salesByEventTypeAndMonth).length}, 70%, 50%, 0.6)`,
              stack: 'Stack 0',
              legendRow: 0 // Top row for totals
            })),
            {
              type: 'line',
              label: 'Total Average Sales',
              data: salesByMonthArray,
              borderColor: 'rgb(75, 192, 192)',
              borderWidth: 2,
              tension: 0.1,
              yAxisID: 'y1',
              legendRow: 1 // Bottom row for averages
            },
            ...Object.entries(salesByEventTypeAndMonth).map(([eventType, data], index) => ({
              type: 'line',
              label: `Avg ${eventTypesMap[eventType]?.emoji}`,
              data: data,
              borderColor: `hsla(${index * 360 / Object.keys(salesByEventTypeAndMonth).length}, 70%, 50%, 1)`,
              borderWidth: 1,
              borderDash: [5, 5],
              tension: 0.1,
              yAxisID: 'y1',
              legendRow: 1 // Bottom row for averages
            }))
          ]
        };

        const dailyChartData = {
          labels: dayNames,
          datasets: [
            ...Object.entries(salesByEventTypeAndDay).map(([eventType, data], index) => ({
              type: 'bar',
              label: `${eventTypesMap[eventType]?.emoji} ${eventTypesMap[eventType]?.name}`,
              data: data,
              backgroundColor: `hsla(${index * 360 / Object.keys(salesByEventTypeAndDay).length}, 70%, 50%, 0.6)`,
              stack: 'Stack 0',
              legendRow: 0 // Top row for totals
            })),
            {
              type: 'line',
              label: 'Total Average Sales',
              data: salesByDayArray,
              borderColor: 'rgb(75, 192, 192)',
              borderWidth: 2,
              tension: 0.1,
              yAxisID: 'y1',
              legendRow: 1 // Bottom row for averages
            },
            ...Object.entries(salesByEventTypeAndDay).map(([eventType, data], index) => ({
              type: 'line',
              label: `Avg ${eventTypesMap[eventType]?.emoji}`,
              data: data,
              borderColor: `hsla(${index * 360 / Object.keys(salesByEventTypeAndDay).length}, 70%, 50%, 1)`,
              borderWidth: 1,
              borderDash: [5, 5],
              tension: 0.1,
              yAxisID: 'y1',
              legendRow: 1 // Bottom row for averages
            }))
          ]
        };

        // Sort cities and states by count
        const sortedCities = Object.entries(salesByCity)
          .sort(([, a], [, b]) => b - a)
          .reduce((acc, [city, count]) => ({ ...acc, [city]: count }), {});

        const sortedStates = Object.entries(salesByState)
          .sort(([, a], [, b]) => b - a)
          .reduce((acc, [state, count]) => ({ ...acc, [state]: count }), {});

        setStats({
          totalSales: sales.length,
          activeSales,
          totalUsers: users.length,
          activeUsers: new Set(sales.map(sale => sale.userId)).size,
          averageSaleDuration: salesWithDuration > 0 ? totalDuration / salesWithDuration : 0,
          salesByEventType: salesByType,
          salesByDay: dailyChartData,
          salesByMonth: monthlyChartData,
          eventTypes: eventTypesMap,
          allSales: sales,
          salesByCity: sortedCities,
          salesByState: sortedStates,
          salesByRegion,
          heatmapData,
          loading: false,
          error: null
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
        setStats(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to load analytics data'
        }));
      }
    };

    fetchAnalytics();
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (stats.allSales.length > 0) {
      const filteredSales = stats.allSales.filter(sale => {
        const matchesEventType = !filters.eventType || sale.eventType === filters.eventType;
        const matchesStatus = !filters.status || sale.status === filters.status;
        
        const saleDate = new Date(sale.createdAt.seconds * 1000);
        const matchesDateRange = (!filters.dateRange.start || saleDate >= new Date(filters.dateRange.start)) &&
                               (!filters.dateRange.end || saleDate <= new Date(filters.dateRange.end));
        
        const matchesSearch = !filters.searchQuery || 
          sale.city?.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
          sale.state?.toLowerCase().includes(filters.searchQuery.toLowerCase());

        return matchesEventType && matchesStatus && matchesDateRange && matchesSearch;
      });

      setDisplayedSales(filteredSales.slice(0, itemsPerPage));
      setHasMore(filteredSales.length > itemsPerPage);
    }
  }, [stats.allSales, filters]);

  useEffect(() => {
    if (mapInstance && stats.heatmapData.length > 0 && !heatmap) {
      const heatmapData = stats.heatmapData.map(point => 
        new window.google.maps.LatLng(point.lat, point.lng)
      );
      
      const newHeatmap = new window.google.maps.visualization.HeatmapLayer({
        data: heatmapData,
        map: mapInstance,
        radius: 30,
        opacity: 0.8,
        maxIntensity: 10,
        gradient: [
          'rgba(0, 255, 255, 0)',
          'rgba(0, 255, 255, 1)',
          'rgba(0, 191, 255, 1)',
          'rgba(0, 127, 255, 1)',
          'rgba(0, 63, 255, 1)',
          'rgba(0, 0, 255, 1)',
          'rgba(0, 0, 223, 1)',
          'rgba(0, 0, 191, 1)',
          'rgba(0, 0, 159, 1)',
          'rgba(0, 0, 127, 1)',
        ]
      });
      
      setHeatmap(newHeatmap);
    }
    
    return () => {
      if (heatmap) {
        heatmap.setMap(null);
        setHeatmap(null);
      }
    };
  }, [mapInstance, stats.heatmapData, heatmap]);

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleDateRangeChange = (type, value) => {
    setFilters(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        [type]: value
      }
    }));
  };

  const clearFilters = () => {
    setFilters({
      eventType: '',
      status: '',
      dateRange: {
        start: '',
        end: ''
      },
      searchQuery: ''
    });
  };

  const loadMoreSales = () => {
    const currentLength = displayedSales.length;
    const nextBatch = stats.allSales.filter(sale => {
      const matchesEventType = !filters.eventType || sale.eventType === filters.eventType;
      const matchesStatus = !filters.status || sale.status === filters.status;
      
      const saleDate = new Date(sale.createdAt.seconds * 1000);
      const matchesDateRange = (!filters.dateRange.start || saleDate >= new Date(filters.dateRange.start)) &&
                             (!filters.dateRange.end || saleDate <= new Date(filters.dateRange.end));
      
      const matchesSearch = !filters.searchQuery || 
        sale.city?.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        sale.state?.toLowerCase().includes(filters.searchQuery.toLowerCase());

      return matchesEventType && matchesStatus && matchesDateRange && matchesSearch;
    }).slice(
      currentLength,
      currentLength + itemsPerPage
    );
    
    if (nextBatch.length > 0) {
      setDisplayedSales(prev => [...prev, ...nextBatch]);
      setHasMore(currentLength + nextBatch.length < stats.allSales.length);
    } else {
      setHasMore(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case 'live':
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`;
      case 'ended':
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`;
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200`;
    }
  };

  if (stats.loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (stats.error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-500">{stats.error}</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Analytics Dashboard</h1>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className={`p-6 rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-lg font-semibold mb-2">Total Sales</h2>
            <p className="text-3xl font-bold text-primary-500">{stats.totalSales}</p>
          </div>
          <div className={`p-6 rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-lg font-semibold mb-2">Active Sales</h2>
            <p className="text-3xl font-bold text-primary-500">{stats.activeSales}</p>
          </div>
          <div className={`p-6 rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-lg font-semibold mb-2">Total Users</h2>
            <p className="text-3xl font-bold text-primary-500">{stats.totalUsers}</p>
          </div>
          <div className={`p-6 rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-lg font-semibold mb-2">Active Users</h2>
            <p className="text-3xl font-bold text-primary-500">{stats.activeUsers}</p>
          </div>
        </div>

        {/* Average Sale Duration */}
        <div className={`p-6 rounded-lg shadow mb-8 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 className="text-xl font-semibold mb-4">Average Sale Duration</h2>
          <p className="text-2xl">
            {stats.averageSaleDuration === 0 ? (
              'No completed sales yet'
            ) : stats.averageSaleDuration < 1 ? (
              `${Math.round(stats.averageSaleDuration * 60)} minutes`
            ) : (
              `${stats.averageSaleDuration.toFixed(1)} hours`
            )}
          </p>
        </div>

        {/* Sales Heat Map */}
        <div className={`p-6 rounded-lg shadow mb-8 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 className="text-xl font-semibold mb-4">Sales Heat Map</h2>
          {isLoaded ? (
            <div className="relative">
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={center}
                zoom={4}
                options={{
                  mapId: currentMapId,
                  disableDefaultUI: true,
                  zoomControl: true,
                }}
                onLoad={(map) => {
                  setMapInstance(map);
                }}
                onUnmount={() => {
                  if (heatmap) {
                    heatmap.setMap(null);
                    setHeatmap(null);
                  }
                  setMapInstance(null);
                }}
              >
                {stats.heatmapData.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <p className="text-gray-500">No location data available for heatmap</p>
                  </div>
                )}
              </GoogleMap>
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-500">Loading map...</p>
            </div>
          )}
        </div>

        {/* Sales by Region */}
        <div className={`p-6 rounded-lg shadow mb-8 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 className="text-xl font-semibold mb-4">Sales by Region</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(stats.salesByRegion)
              .sort(([, a], [, b]) => b - a)
              .map(([region, count]) => (
                <div key={region} className={`p-6 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} transition-colors duration-200 hover:bg-opacity-80`}>
                  <h3 className="text-lg font-medium mb-2 capitalize">{region.toLowerCase()}</h3>
                  <p className="text-3xl font-bold text-primary-500">{count}</p>
                  <p className={`text-sm mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {((count / stats.totalSales) * 100).toFixed(1)}% of total sales
                  </p>
                </div>
              ))}
          </div>
        </div>

        {/* Top Cities, States, and Event Types Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Sales by Event Type */}
          <div className={`p-6 rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-xl font-semibold mb-4">Sales by Event Type</h2>
            <div className="space-y-3">
              {Object.entries(stats.salesByEventType)
                .sort(([, a], [, b]) => b - a)
                .map(([typeId, count]) => (
                  <div key={typeId} className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100'} transition-colors duration-200`}>
                    <div className="flex justify-between items-center">
                      <span>
                        {stats.eventTypes[typeId] 
                          ? `${stats.eventTypes[typeId].emoji} ${stats.eventTypes[typeId].name}`
                          : 'Unknown Type'
                        }
                      </span>
                      <span className="font-semibold">{count}</span>
                    </div>
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                      {((count / stats.totalSales) * 100).toFixed(1)}% of total sales
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Top Cities */}
          <div className={`p-6 rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-xl font-semibold mb-4">Top Cities</h2>
            <div className="space-y-3">
              {Object.entries(stats.salesByCity)
                .slice(0, 10)
                .map(([city, count]) => (
                  <div key={city} className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100'} transition-colors duration-200`}>
                    <div className="flex justify-between items-center">
                      <span className="truncate pr-4">{city}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                      {((count / stats.totalSales) * 100).toFixed(1)}% of total sales
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Top States */}
          <div className={`p-6 rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-xl font-semibold mb-4">Top States</h2>
            <div className="space-y-3">
              {Object.entries(stats.salesByState)
                .slice(0, 10)
                .map(([stateCode, count]) => (
                  <div key={stateCode} className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100'} transition-colors duration-200`}>
                    <div className="flex justify-between items-center">
                      <span className="truncate pr-4">{stateCodeToName[stateCode] || stateCode}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                    <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                      {((count / stats.totalSales) * 100).toFixed(1)}% of total sales
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Sales by Month Chart */}
        <div className={`p-6 rounded-lg shadow mb-8 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 className="text-xl font-semibold mb-4">Sales by Month</h2>
          <div style={{ height: getChartHeight() }}>
            {stats.salesByMonth && (
              <Bar
                data={stats.salesByMonth}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'index',
                    intersect: false,
                  },
                  scales: {
                    x: {
                      stacked: true,
                      grid: {
                        display: false
                      },
                      ticks: {
                        color: darkMode ? '#E5E7EB' : '#374151',
                        maxRotation: isMobile ? 45 : 0,
                        minRotation: isMobile ? 45 : 0
                      }
                    },
                    y: {
                      stacked: true,
                      grid: {
                        color: darkMode ? '#374151' : '#E5E7EB'
                      },
                      ticks: {
                        color: darkMode ? '#E5E7EB' : '#374151'
                      },
                      title: {
                        display: true,
                        text: 'Number of Sales',
                        color: darkMode ? '#E5E7EB' : '#374151'
                      }
                    },
                    y1: {
                      position: 'right',
                      grid: {
                        drawOnChartArea: false
                      },
                      ticks: {
                        color: darkMode ? '#E5E7EB' : '#374151'
                      },
                      title: {
                        display: true,
                        text: 'Average Sales',
                        color: darkMode ? '#E5E7EB' : '#374151'
                      }
                    }
                  },
                  plugins: {
                    legend: {
                      position: isMobile ? 'bottom' : 'top',
                      labels: {
                        color: darkMode ? '#E5E7EB' : '#374151',
                        padding: isMobile ? 20 : 10,
                        boxWidth: isMobile ? 12 : 40,
                        sort: (a, b) => {
                          // Get row based on whether it's an average
                          const getRow = (item) => item.text.startsWith('Avg') ? 1 : 0;
                          const rowA = getRow(a);
                          const rowB = getRow(b);
                          
                          // First sort by row
                          if (rowA !== rowB) {
                            return rowA - rowB;
                          }
                          // Then sort by dataset index within the same row
                          return a.datasetIndex - b.datasetIndex;
                        }
                      }
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const label = context.dataset.label || '';
                          const value = context.parsed.y;
                          if (label.startsWith('Avg')) {
                            return `${label}: ${value.toFixed(1)}`;
                          }
                          return `${label}: ${value}`;
                        }
                      }
                    }
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Sales by Day Chart */}
        <div className={`p-6 rounded-lg shadow mb-8 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 className="text-xl font-semibold mb-4">Sales by Day</h2>
          <div style={{ height: getChartHeight() }}>
            {stats.salesByDay && (
              <Bar
                data={stats.salesByDay}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'index',
                    intersect: false,
                  },
                  scales: {
                    x: {
                      stacked: true,
                      grid: {
                        display: false
                      },
                      ticks: {
                        color: darkMode ? '#E5E7EB' : '#374151',
                        maxRotation: isMobile ? 45 : 0,
                        minRotation: isMobile ? 45 : 0
                      }
                    },
                    y: {
                      stacked: true,
                      grid: {
                        color: darkMode ? '#374151' : '#E5E7EB'
                      },
                      ticks: {
                        color: darkMode ? '#E5E7EB' : '#374151'
                      },
                      title: {
                        display: true,
                        text: 'Number of Sales',
                        color: darkMode ? '#E5E7EB' : '#374151'
                      }
                    },
                    y1: {
                      position: 'right',
                      grid: {
                        drawOnChartArea: false
                      },
                      ticks: {
                        color: darkMode ? '#E5E7EB' : '#374151'
                      },
                      title: {
                        display: true,
                        text: 'Average Sales',
                        color: darkMode ? '#E5E7EB' : '#374151'
                      }
                    }
                  },
                  plugins: {
                    legend: {
                      position: isMobile ? 'bottom' : 'top',
                      labels: {
                        color: darkMode ? '#E5E7EB' : '#374151',
                        padding: isMobile ? 20 : 10,
                        boxWidth: isMobile ? 12 : 40,
                        sort: (a, b) => {
                          // Get row based on whether it's an average
                          const getRow = (item) => item.text.startsWith('Avg') ? 1 : 0;
                          const rowA = getRow(a);
                          const rowB = getRow(b);
                          
                          // First sort by row
                          if (rowA !== rowB) {
                            return rowA - rowB;
                          }
                          // Then sort by dataset index within the same row
                          return a.datasetIndex - b.datasetIndex;
                        }
                      }
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const label = context.dataset.label || '';
                          const value = context.parsed.y;
                          if (label.startsWith('Avg')) {
                            return `${label}: ${value.toFixed(1)}`;
                          }
                          return `${label}: ${value}`;
                        }
                      }
                    }
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* All Sales List */}
        <div className={`p-6 rounded-lg shadow mb-8 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">All Sales</h2>
            <button
              onClick={clearFilters}
              className={`px-3 py-1 rounded-lg text-sm ${
                darkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              Clear Filters
            </button>
          </div>

          {/* Filters Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Event Type Filter */}
            <div>
              <label className="block text-sm font-medium mb-1">Event Type</label>
              <select
                value={filters.eventType}
                onChange={(e) => handleFilterChange('eventType', e.target.value)}
                className={`w-full rounded-lg p-2 ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-200' 
                    : 'bg-white text-gray-900'
                } border border-gray-300 focus:ring-2 focus:ring-primary-500`}
              >
                <option value="">All Types</option>
                {Object.entries(stats.eventTypes).map(([id, type]) => (
                  <option key={id} value={id}>
                    {type.emoji} {type.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className={`w-full rounded-lg p-2 ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-200' 
                    : 'bg-white text-gray-900'
                } border border-gray-300 focus:ring-2 focus:ring-primary-500`}
              >
                <option value="">All Status</option>
                <option value="live" className="text-green-600">Live</option>
                <option value="ended" className="text-red-600">Ended</option>
                <option value="pending" className="text-yellow-600">Pending</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={filters.dateRange.start}
                onChange={(e) => handleDateRangeChange('start', e.target.value)}
                className={`w-full rounded-lg p-2 ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-200' 
                    : 'bg-white text-gray-900'
                } border border-gray-300 focus:ring-2 focus:ring-primary-500`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={filters.dateRange.end}
                onChange={(e) => handleDateRangeChange('end', e.target.value)}
                className={`w-full rounded-lg p-2 ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-200' 
                    : 'bg-white text-gray-900'
                } border border-gray-300 focus:ring-2 focus:ring-primary-500`}
              />
            </div>

            {/* Search Input */}
            <div className="lg:col-span-4">
              <label className="block text-sm font-medium mb-1">Search by City or State</label>
              <input
                type="text"
                value={filters.searchQuery}
                onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                placeholder="Enter city or state name..."
                className={`w-full rounded-lg p-2 ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-200' 
                    : 'bg-white text-gray-900'
                } border border-gray-300 focus:ring-2 focus:ring-primary-500`}
              />
            </div>
          </div>

          {/* Sales List */}
          <div 
            id="scrollableDiv"
            className="space-y-4 overflow-auto"
            style={{ maxHeight: '500px' }}
          >
            <InfiniteScroll
              dataLength={displayedSales.length}
              next={loadMoreSales}
              hasMore={hasMore}
              loader={
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
                </div>
              }
              endMessage={
                <div className="text-center py-4 text-gray-500">
                  {displayedSales.length === 0 
                    ? 'No sales match the selected filters' 
                    : 'No more sales to load'
                  }
                </div>
              }
              scrollableTarget="scrollableDiv"
            >
              <div className="space-y-4">
                {displayedSales.map(sale => (
                  <div key={sale.id} className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100'} transition-colors duration-200`}>
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium">
                            {stats.eventTypes[sale.eventType] 
                              ? `${stats.eventTypes[sale.eventType].emoji} ${stats.eventTypes[sale.eventType].name}`
                              : 'Unknown Type'
                            }
                          </span>
                          <span className={getStatusBadgeClass(sale.status)}>
                            {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
                          </span>
                        </div>
                        <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {new Date(sale.createdAt.seconds * 1000).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {sale.city}, {sale.state}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </InfiniteScroll>
          </div>
        </div>
      </div>
    </div>
  );
}
