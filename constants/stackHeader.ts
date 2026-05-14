/**
 * iOS shows the previous route's title next to the back chevron. Expo Router's
 * tab layout is registered as "(tabs)", which would appear as that literal string.
 * Use these options on stack screens / screenOptions so only the chevron shows.
 */
export const stackHeaderHideIosBackLabel = {
  headerBackTitleVisible: false,
  headerBackButtonDisplayMode: 'minimal' as const,
};
