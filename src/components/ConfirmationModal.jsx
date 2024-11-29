/**
 * ConfirmationModal Component
 * 
 * A reusable modal component for confirming user actions.
 * Features:
 * - Responsive design
 * - Dark mode support
 * - Keyboard accessibility
 * - Body scroll lock when open
 * - Portal rendering for proper stacking context
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Controls modal visibility
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Function} props.onConfirm - Callback when action is confirmed
 * @param {string} props.title - Modal title text
 * @param {string} props.message - Modal body message
 * 
 * @example
 * <ConfirmationModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   onConfirm={handleDelete}
 *   title="Confirm Deletion"
 *   message="Are you sure you want to delete this item?"
 * />
 */

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { createPortal } from 'react-dom';

const ConfirmationModal = React.memo(({ isOpen, onClose, onConfirm, title, message }) => {
  const { darkMode } = useTheme();

  // Lock body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleConfirm = (e) => {
    e.stopPropagation();
    onConfirm();
  };

  const handleClose = (e) => {
    e.stopPropagation();
    onClose();
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] overflow-y-auto bg-black bg-opacity-50"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="flex min-h-screen items-center justify-center p-4">
        <div 
          className="relative w-full max-w-md transform overflow-hidden rounded-lg bg-white shadow-xl transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`${
            darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
          } p-6`}>
            <h3 
              id="modal-title"
              className="text-lg font-medium leading-6"
            >
              {title}
            </h3>
            <div className="mt-2">
              <p className={`text-sm ${
                darkMode ? 'text-gray-300' : 'text-gray-500'
              }`}>
                {message}
              </p>
            </div>
            <div className="mt-4 flex justify-end space-x-3">
              <button
                type="button"
                className={`inline-flex justify-center rounded-md border px-4 py-2 text-sm font-medium ${
                  darkMode 
                    ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600' 
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
                onClick={handleClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                onClick={handleConfirm}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(
    modalContent,
    document.body
  );
});

ConfirmationModal.displayName = 'ConfirmationModal';

export default ConfirmationModal;
