
// Generates an array from "00:00" to "23:45" automatically
export const TIME_SLOTS = Array.from({ length: 24 * 4 }).map((_, i) => {
  const hours = Math.floor(i / 4).toString().padStart(2, '0');
  const minutes = ((i % 4) * 15).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
});