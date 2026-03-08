import { useState, useEffect } from 'react';
import API_BASE_URL from '../config';

export const useSearch = (endpoint, clinicId) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    // 1. If search is empty, clear results and stop
    if (!query) {
      setResults([]);
      return;
    }

    // 2. Debounce: Wait 500ms after user stops typing
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Calls: /api/appointments/CLINIC_ID?mode=search&query=TEXT
        const res = await fetch(`${API_BASE_URL}${endpoint}/${clinicId}?mode=search&query=${query}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (err) {
        console.error("Global Search Failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    // Cleanup: Cancel the timeout if user types again quickly
    return () => clearTimeout(delayDebounceFn);
  }, [query, endpoint, clinicId]);

  return { query, setQuery, results, isSearching };
};