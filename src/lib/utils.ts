import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isMatchLocked(matchDate: string, matchTime: string): boolean {
  if (!matchDate || !matchTime) return false;
  try {
    // Parse the date and time. Assuming local time for simplicity, 
    // or you can append 'Z' if it's UTC, or '+05:30' for IST.
    // Using standard ISO parsing which defaults to local time if no timezone is provided.
    const matchDateTime = new Date(`${matchDate}T${matchTime}`);
    return new Date() > matchDateTime;
  } catch (error) {
    return false;
  }
}
