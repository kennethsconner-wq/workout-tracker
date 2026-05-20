import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy tab route — forwards to the stack log screen so params are not reused from a hidden tab. */
export default function AddTabRedirect() {
  const params = useLocalSearchParams();
  return (
    <Redirect
      href={{
        pathname: '/log-workout',
        params: {
          ...params,
          t: String(Date.now()),
        },
      }}
    />
  );
}
