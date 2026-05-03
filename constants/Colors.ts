const tintColorLight = '#39AAAA';
const tintColorDark = '#23D5D5';

export default {
  light: {
    text: '#000',
    background: '#fff',
    tint: tintColorLight,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
  },
  dark: {
    /** Same as active tab / tint so body copy matches tab accent in dark mode. */
    text: tintColorDark,
    /** Dark mode canvas — used app-wide via `Themed` and navigation theme. */
    background: '#241734',
    tint: tintColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
  },
};
