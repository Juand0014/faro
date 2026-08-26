import { useEffect, useState } from 'react';

export function useHashRoute(): [string, (r: string) => void] {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/home');
  useEffect(() => {
    const on = () => setRoute(window.location.hash.slice(1) || '/home');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (r: string) => { window.location.hash = r; };
  return [route, go];
}
