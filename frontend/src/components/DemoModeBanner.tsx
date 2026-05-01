import React from 'react';
import { WifiOff } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { isDemoMode } from '../utils/demoMode';

export const DemoModeBanner: React.FC = () => {
  if (!isDemoMode()) {
    return null;
  }

  return (
    <Alert className="mb-4 bg-yellow-50 border-yellow-200">
      <WifiOff className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="text-yellow-800">
        <strong>Demo Mode:</strong> Server unavailable. Using local storage for demo functionality.
        <span className="ml-2 text-sm">
          Try: <code className="px-1 py-0.5 bg-yellow-100 rounded text-xs">patient@demo.com</code> or{' '}
          <code className="px-1 py-0.5 bg-yellow-100 rounded text-xs">doctor@demo.com</code> with password:{' '}
          <code className="px-1 py-0.5 bg-yellow-100 rounded text-xs">demo123</code>
        </span>
      </AlertDescription>
    </Alert>
  );
};
