import { useColorScheme as useColorSchemeCore } from 'react-native';

/**
 * Light mode is intentionally the same as dark mode for now (palette + conditional UI).
 * When light mode should follow the OS again, restore: `coreScheme === 'unspecified' ? 'light' : coreScheme`
 * and differentiate `Colors.light` vs `Colors.dark`.
 */
export const useColorScheme = (): 'dark' => {
  void useColorSchemeCore(); // subscribe so we re-render if OS scheme changes (for future use)
  return 'dark';
};
