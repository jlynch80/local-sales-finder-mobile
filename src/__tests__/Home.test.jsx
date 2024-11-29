import { render, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import Home from '../pages/Home';
import { AuthContext } from '../contexts/AuthContext';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';

// Mock Firebase functions
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  doc: vi.fn(),
  Timestamp: {
    now: () => new Date()
  }
}));

// Mock geocoding functions
vi.mock('../utils/geocoding', () => ({
  getCoordinatesFromAddress: vi.fn().mockResolvedValue({
    latitude: 37.7749,
    longitude: -122.4194
  }),
  getAddressComponentsFromAddress: vi.fn().mockResolvedValue({
    formattedAddress: '123 Test St, Test City, CA',
    city: 'Test City',
    state: 'CA',
    region: 'West'
  })
}));

describe('Home Component', () => {
  const mockUser = {
    uid: 'test-user-id'
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
  });

  test('creates a new sale successfully', async () => {
    // Mock successful Firestore response
    addDoc.mockResolvedValueOnce({ id: 'test-sale-id' });

    const { getByText, getByLabelText } = render(
      <AuthContext.Provider value={{ currentUser: mockUser }}>
        <Home />
      </AuthContext.Provider>
    );

    // Open the create sale modal
    fireEvent.click(getByText('Create Sale'));

    // Fill in the form
    fireEvent.change(getByLabelText('Event Type'), {
      target: { value: 'Garage Sale' }
    });
    fireEvent.change(getByLabelText('Description'), {
      target: { value: 'Test sale description' }
    });
    fireEvent.change(getByLabelText('Address'), {
      target: { value: '123 Test St' }
    });

    // Submit the form
    fireEvent.click(getByText('Create'));

    // Verify the sale was created
    await waitFor(() => {
      expect(addDoc).toHaveBeenCalledTimes(1);
      const saleData = addDoc.mock.calls[0][1];
      expect(saleData).toMatchObject({
        eventType: 'Garage Sale',
        description: 'Test sale description',
        status: 'live'
      });
    });

    // Verify modals are closed
    await waitFor(() => {
      expect(getByText('Create Sale')).toBeInTheDocument();
      expect(() => getByText('Confirm')).toThrow();
    });
  });

  test('ends a sale successfully', async () => {
    // Mock successful Firestore response
    updateDoc.mockResolvedValueOnce();

    const { getByText } = render(
      <AuthContext.Provider value={{ currentUser: mockUser }}>
        <Home userLiveSale={{ id: 'test-sale-id' }} />
      </AuthContext.Provider>
    );

    // Click end sale button
    fireEvent.click(getByText('End Sale'));

    // Confirm ending the sale
    fireEvent.click(getByText('Confirm'));

    // Verify the sale was ended
    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalledTimes(1);
      expect(updateDoc.mock.calls[0][1]).toMatchObject({
        status: 'ended'
      });
    });

    // Verify modals are closed
    await waitFor(() => {
      expect(() => getByText('Confirm')).toThrow();
    });
  });
});
