import { Navigate } from 'react-router-dom';

/**
 * ProtectedRoute - Wraps routes that require authentication
 * Redirects to login if user is not authenticated
 */
export default function ProtectedRoute({ children }) {
  const isAuthenticated = () => {
    try {
      if (typeof window !== 'undefined') {
        const username = window.localStorage.getItem('lg_username');
        return username && username.trim() !== '';
      }
    } catch {
      return false;
    }
    return false;
  };

  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  return children;
}
