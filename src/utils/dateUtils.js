// src/utils/dateUtils.js (Create this file or add to existing utils)

export const getLocalDateString = (dateObj = new Date()) => {
  // This explicitly grabs the Local Year, Month, and Date
  // ignoring the UTC offset.
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};
