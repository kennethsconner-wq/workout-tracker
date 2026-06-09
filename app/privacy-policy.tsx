import { Stack } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Text, View } from '@/components/Themed';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';
import privacyPolicyText from '../docs/privacy-policy.txt';

export default function PrivacyPolicyScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Privacy Policy',
          presentation: 'card',
          ...stackHeaderHideIosBackLabel,
        }}
      />
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.policyText}>{privacyPolicyText}</Text>
        </ScrollView>
        <StatusBar style="light" />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  policyText: {
    fontSize: 15,
    lineHeight: 22,
  },
});
