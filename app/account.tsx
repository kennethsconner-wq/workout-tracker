import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthFormField } from '@/components/auth/AuthFormField';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';
import { useColorScheme } from '@/components/useColorScheme';
import { validateUsername } from '@/lib/auth/authErrors';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useSyncStatus } from '@/lib/sync/useSyncStatus';
import { syncEngine } from '@/lib/sync/syncEngine';
import { themedAlert } from '@/lib/themedAlert';

function formatRelativeSyncTime(iso: string | null): string {
  if (!iso) {
    return 'Not synced yet';
  }
  const syncedAt = Date.parse(iso);
  if (!Number.isFinite(syncedAt)) {
    return 'Not synced yet';
  }

  const diffMs = Date.now() - syncedAt;
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function formatAccountDate(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function AccountScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'dark';
  const textColor = Colors[activeScheme].text;
  const tint = Colors[activeScheme].tint;
  const borderColor = activeScheme === 'dark' ? '#333' : '#e5e5e5';
  const { user, isSignedIn, isConfigured, isAuthBusy, signOut, updateUsername, deleteAccount } = useAuth();
  const syncStatus = useSyncStatus();
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [showDeleteAccountForm, setShowDeleteAccountForm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState<string | null>(null);
  const [clearLocalDataOnDelete, setClearLocalDataOnDelete] = useState(false);
  const destructiveColor = '#ff453a';
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const scrollToDeleteForm = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  useEffect(() => {
    if (!showDeleteAccountForm) {
      return;
    }

    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      scrollToDeleteForm,
    );

    return () => {
      showSubscription.remove();
    };
  }, [showDeleteAccountForm]);

  const handleSaveUsername = async () => {
    const error = validateUsername(usernameDraft);
    if (error) {
      setUsernameError(error);
      return;
    }

    setUsernameError(null);
    const result = await updateUsername(usernameDraft);
    if (result.error) {
      setUsernameError(result.error);
      return;
    }
    setUsernameDraft('');
  };

  const handleSignOut = () => {
    themedAlert('Sign out?', 'Your workouts stay on this device. You can sign in again anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  };

  const resetDeleteAccountForm = () => {
    setShowDeleteAccountForm(false);
    setDeletePassword('');
    setDeletePasswordError(null);
    setClearLocalDataOnDelete(false);
  };

  const handleDeleteAccountPress = () => {
    setShowDeleteAccountForm(true);
    scrollToDeleteForm();
  };

  const handleConfirmDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      setDeletePasswordError('Enter your password to confirm.');
      return;
    }

    setDeletePasswordError(null);
    const result = await deleteAccount({
      password: deletePassword,
      clearLocalData: clearLocalDataOnDelete,
    });

    if (result.error) {
      setDeletePasswordError(result.error);
      return;
    }

    resetDeleteAccountForm();
    themedAlert(
      'Account deleted',
      clearLocalDataOnDelete
        ? 'Your account and workouts on this device have been removed.'
        : 'Your account and cloud backups have been removed. Workouts on this device were kept.',
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Account',
          presentation: 'card',
          ...stackHeaderHideIosBackLabel,
        }}
      />
      <View style={styles.screen}>
        {!isConfigured ? (
          <View style={styles.container}>
            <Text style={styles.copy}>
              Cloud accounts are not configured in this build. Your workouts continue to be stored locally on this
              device.
            </Text>
          </View>
        ) : isSignedIn && user ? (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.select({ ios: 'padding', android: 'height' })}
            keyboardVerticalOffset={Platform.select({ ios: 80, android: 24 })}>
            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 32) }]}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              showsVerticalScrollIndicator={false}>
              <View style={styles.container}>
            <View style={[styles.infoCard, { borderColor }]}>
              {user.username ? (
                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={20} color={tint} style={styles.infoIcon} />
                  <View style={styles.infoTextBlock}>
                    <Text style={[styles.infoLabel, { color: textColor, opacity: 0.7 }]}>Username</Text>
                    <Text style={[styles.infoValue, { color: textColor }]}>{user.username}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.missingUsernameBlock}>
                  <Text style={styles.copy}>
                    Add a username so others can identify you when social features are available.
                  </Text>
                  <AuthFormField
                    label="Username"
                    value={usernameDraft}
                    onChangeText={setUsernameDraft}
                    autoCapitalize="none"
                    textContentType="username"
                    autoComplete="username"
                    placeholder="letters, numbers, underscores"
                    error={usernameError}
                  />
                  <AuthPrimaryButton
                    label="Save username"
                    onPress={() => void handleSaveUsername()}
                    loading={isAuthBusy}
                  />
                </View>
              )}
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={20} color={tint} style={styles.infoIcon} />
                <View style={styles.infoTextBlock}>
                  <Text style={[styles.infoLabel, { color: textColor, opacity: 0.7 }]}>Email</Text>
                  <Text style={[styles.infoValue, { color: textColor }]}>{user.email ?? '—'}</Text>
                </View>
              </View>
              {formatAccountDate(user.createdAt) ? (
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={20} color={tint} style={styles.infoIcon} />
                  <View style={styles.infoTextBlock}>
                    <Text style={[styles.infoLabel, { color: textColor, opacity: 0.7 }]}>Member since</Text>
                    <Text style={[styles.infoValue, { color: textColor }]}>{formatAccountDate(user.createdAt)}</Text>
                  </View>
                </View>
              ) : null}
              <View style={[styles.infoRow, styles.syncStatusRow]}>
                <Ionicons name="cloud-outline" size={20} color={tint} style={styles.infoIcon} />
                <View style={styles.infoTextBlock}>
                  <Text style={[styles.infoLabel, { color: textColor, opacity: 0.7 }]}>Sync status</Text>
                  <Text style={[styles.infoValue, { color: textColor }]}>
                    {syncStatus.isSyncing
                      ? 'Syncing…'
                      : syncStatus.lastError
                        ? syncStatus.lastError
                        : `Last synced: ${formatRelativeSyncTime(syncStatus.lastSyncedAt)}`}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void syncEngine.syncNow()}
                  disabled={syncStatus.isSyncing}
                  accessibilityRole="button"
                  accessibilityLabel="Sync now"
                  style={({ pressed }) => [
                    styles.syncNowButton,
                    { opacity: syncStatus.isSyncing ? 0.7 : pressed ? 0.7 : 1 },
                  ]}>
                  {syncStatus.isSyncing ? (
                    <ActivityIndicator size="small" color={tint} />
                  ) : (
                    <Text style={[styles.syncNowLabel, { color: tint }]}>Sync now</Text>
                  )}
                </Pressable>
              </View>
            </View>
            <Text style={styles.copy}>
              Your workouts are backed up to the cloud while signed in. Edits save locally first, then sync in the
              background.
            </Text>
            <AuthPrimaryButton label="Sign out" onPress={handleSignOut} loading={isAuthBusy} />
            {showDeleteAccountForm ? (
              <View style={[styles.deleteCard, { borderColor: destructiveColor }]}>
                <Text style={[styles.deleteTitle, { color: destructiveColor }]}>Delete account permanently</Text>
                <Text style={styles.copy}>
                  This permanently deletes your account, profile, and all cloud backups. Enter your password to
                  confirm.
                </Text>
                <AuthFormField
                  label="Password"
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  secureTextEntry
                  textContentType="password"
                  autoComplete="password"
                  error={deletePasswordError}
                  onFocus={scrollToDeleteForm}
                />
                <Pressable
                  onPress={() => setClearLocalDataOnDelete((value) => !value)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: clearLocalDataOnDelete }}
                  accessibilityLabel="Also delete workouts on this device"
                  style={({ pressed }) => [styles.deleteOptionRow, { opacity: pressed ? 0.7 : 1 }]}>
                  <Ionicons
                    name={clearLocalDataOnDelete ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={clearLocalDataOnDelete ? destructiveColor : textColor}
                    style={styles.deleteOptionIcon}
                  />
                  <Text style={[styles.deleteOptionLabel, { color: textColor }]}>
                    Also delete workouts on this device
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleConfirmDeleteAccount()}
                  disabled={isAuthBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Delete account permanently"
                  style={({ pressed }) => [
                    styles.deleteConfirmButton,
                    {
                      borderColor: destructiveColor,
                      opacity: isAuthBusy ? 0.5 : pressed ? 0.7 : 1,
                    },
                  ]}>
                  {isAuthBusy ? (
                    <ActivityIndicator color={destructiveColor} />
                  ) : (
                    <Text style={[styles.deleteConfirmLabel, { color: destructiveColor }]}>
                      Delete account permanently
                    </Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={resetDeleteAccountForm}
                  disabled={isAuthBusy}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.cancelDeleteButton, { opacity: pressed ? 0.7 : 1 }]}>
                  <Text style={[styles.cancelDeleteLabel, { color: textColor }]}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={handleDeleteAccountPress}
                disabled={isAuthBusy}
                accessibilityRole="button"
                accessibilityLabel="Delete account"
                style={({ pressed }) => [styles.deleteAccountLink, { opacity: isAuthBusy ? 0.5 : pressed ? 0.7 : 1 }]}>
                <Text style={[styles.deleteAccountLinkLabel, { color: destructiveColor }]}>Delete account</Text>
              </Pressable>
            )}
            </View>
          </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <View style={styles.container}>
            <Text style={styles.copy}>
              Sign in or create an account to prepare for cloud backup. Without an account, everything stays on this
              device only.
            </Text>
            <AuthPrimaryButton label="Sign in" onPress={() => router.push('/auth/sign-in')} />
            <Pressable
              onPress={() => router.push('/auth/sign-up')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondaryButton, { borderColor, opacity: pressed ? 0.7 : 1 }]}>
              <Text style={[styles.secondaryButtonLabel, { color: textColor }]}>Create account</Text>
            </Pressable>
          </View>
        )}
        <StatusBar style="light" />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    padding: 20,
    gap: 16,
  },
  copy: {
    fontSize: 16,
    lineHeight: 24,
  },
  infoCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  syncStatusRow: {
    alignItems: 'center',
  },
  syncNowButton: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    minWidth: 72,
    paddingVertical: 4,
    paddingLeft: 8,
  },
  syncNowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoTextBlock: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    fontSize: 13,
  },
  infoValue: {
    fontSize: 17,
  },
  missingUsernameBlock: {
    gap: 12,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 20,
  },
  secondaryButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteAccountLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  deleteAccountLinkLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  deleteTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  deleteOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteOptionIcon: {
    marginRight: 10,
  },
  deleteOptionLabel: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  deleteConfirmButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 20,
  },
  deleteConfirmLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelDeleteButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelDeleteLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
