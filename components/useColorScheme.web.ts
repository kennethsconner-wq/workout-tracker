// NOTE: The default React Native styling doesn't support server rendering.
// Server rendered styles should not change between the first render of the HTML
// and the first render on the client. Typically, web developers will use CSS media queries
// to render different styles on the client and server, these aren't directly supported in React Native
// but can be achieved with a styling library like Nativewind.
//
// Matches native: light mode uses the same appearance as dark mode for now.
export function useColorScheme(): 'dark' {
  return 'dark';
}
