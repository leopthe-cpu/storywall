// Verify screen is not needed when using Base44's built-in auth flow.
// Redirect back to root — auth result is handled by Landing.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Verify() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/', { replace: true }); }, [navigate]);
  return null;
}