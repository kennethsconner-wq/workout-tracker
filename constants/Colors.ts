const tintColor = '#23D5D5';

/** Shared palette: light mode currently matches dark mode (may diverge later). */
const sharedPalette = {
  text: tintColor,
  background: '#241734',
  tint: tintColor,
  tabIconDefault: '#ccc',
  tabIconSelected: tintColor,
};

export default {
  light: { ...sharedPalette },
  dark: { ...sharedPalette },
};
