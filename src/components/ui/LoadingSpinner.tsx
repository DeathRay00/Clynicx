import React from 'react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="relative">
        {/* Glass morphism container */}
        <div className="p-8 rounded-2xl bg-white/20 backdrop-blur-lg border border-white/30 shadow-xl">
          <div className="flex flex-col items-center space-y-4">
            {/* Spinner */}
            <div className="w-12 h-12 border-4 border-blue-200/30 border-t-blue-500 rounded-full animate-spin"></div>
            
            {/* Loading text */}
            <div className="text-blue-700">
              Loading...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};