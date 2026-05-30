import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { palette } from '../theme/colors';

const STORAGE_PREFIX = 'ema_compliance_notice_dismissed_';

type ComplianceProfileNoticeProps = {
  noticeId: string;
  message: string;
  onOpenSettings?: () => void;
};

export function ComplianceProfileNotice({ noticeId, message, onOpenSettings }: ComplianceProfileNoticeProps) {
  const [dismissed, setDismissed] = useState(false);
  const storageKey = `${STORAGE_PREFIX}${noticeId}`;

  useEffect(() => {
    void AsyncStorage.getItem(storageKey).then((v) => setDismissed(v === '1'));
  }, [storageKey]);

  const dismiss = () => {
    setDismissed(true);
    void AsyncStorage.setItem(storageKey, '1');
  };

  if (dismissed) return null;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Complete your profile</Text>
        <Pressable onPress={dismiss} hitSlop={12} accessibilityLabel='Dismiss notice'>
          <Ionicons name='close-circle' size={22} color={palette.textSecondary} />
        </Pressable>
      </View>
      <Text style={styles.body}>{message}</Text>
      {onOpenSettings ? (
        <Pressable onPress={onOpenSettings} style={styles.settingsBtn}>
          <Text style={styles.settingsLink}>Open Settings</Text>
          <Ionicons name='chevron-forward' size={16} color={palette.primary} />
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderColor: palette.noticeBorder,
    borderLeftWidth: 3,
    backgroundColor: palette.noticeBackground,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { color: palette.noticeBorder, fontSize: 15, fontWeight: '700', flex: 1 },
  body: { color: palette.textSecondary, fontSize: 13, lineHeight: 19 },
  settingsBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 },
  settingsLink: { color: palette.primary, fontSize: 14, fontWeight: '700' },
});
