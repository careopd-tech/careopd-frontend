import React, { createContext, useState, useEffect, useContext } from 'react';
import { getLocalDateString } from '../utils/dateUtils'; // 1. Import the utility

const DateContext = createContext();

export const DateProvider = ({ children }) => {
  // 2. Initialize using the imported utility
  const [currentDate, setCurrentDate] = useState(getLocalDateString());

  useEffect(() => {
    const checkMidnight = () => {
      // 3. Use the utility inside the check
      const nowStr = getLocalDateString();
      
      if (nowStr !== currentDate) {
        console.log("🕛 Soft Midnight Update: Moving to", nowStr);
        setCurrentDate(nowStr); 
      }
    };

    // Check every 10 seconds (lightweight)
    const interval = setInterval(checkMidnight, 10000); 

    // Also check on window focus (waking up laptop)
    const handleFocus = () => checkMidnight();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentDate]);

  return (
    // 4. Expose setCurrentDate so other components can manually change the date if needed
    <DateContext.Provider value={{ currentDate, setCurrentDate }}>
      {children}
    </DateContext.Provider>
  );
};

export const useGlobalDate = () => useContext(DateContext);