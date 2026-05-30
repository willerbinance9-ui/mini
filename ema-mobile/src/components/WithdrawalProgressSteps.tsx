import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme/colors';

export const WITHDRAWAL_PROGRESS_STEPS = [
  { key: 'review', label: 'Reviewing your cash-out' },
  { key: 'send', label: 'Preparing the transfer' },
  { key: 'queued', label: 'Handed off — watch for SMS' },
] as const;

type StepStatus = 'pending' | 'active' | 'done' | 'error';

type WithdrawalProgressStepsProps = {
  /** Active step index 0–2 (maps to the three steps above). */
  activeIndex: number;
  clientIp?: string | null;
  errorMessage?: string | null;
};

function stepStatus(index: number, activeIndex: number, hasError: boolean): StepStatus {
  if (hasError && index === activeIndex) return 'error';
  if (index < activeIndex) return 'done';
  if (index === activeIndex) {
    const isLast = activeIndex === WITHDRAWAL_PROGRESS_STEPS.length - 1;
    if (isLast && !hasError) return 'done';
    return 'active';
  }
  return 'pending';
}

export function WithdrawalProgressSteps({ activeIndex, clientIp, errorMessage }: WithdrawalProgressStepsProps) {
  const hasError = Boolean(errorMessage);
  const clampedActive = Math.min(Math.max(activeIndex, 0), WITHDRAWAL_PROGRESS_STEPS.length - 1);

  return (
    <View style={styles.wrap}>
      {WITHDRAWAL_PROGRESS_STEPS.map((step, index) => {
        const status = stepStatus(index, clampedActive, hasError);
        const isSendStep = step.key === 'send';
        return (
          <View key={step.key} style={styles.row}>
            <View style={styles.rail}>
              {index > 0 ? (
                <View
                  style={[
                    styles.connector,
                    status === 'pending' && index > clampedActive ? styles.connectorPending : styles.connectorDone,
                  ]}
                />
              ) : null}
              <View
                style={[
                  styles.bubble,
                  status === 'active' && styles.bubbleActive,
                  status === 'done' && styles.bubbleDone,
                  status === 'error' && styles.bubbleError,
                ]}
              >
                {status === 'done' ? (
                  <Ionicons name='checkmark' size={16} color='#fff' />
                ) : status === 'error' ? (
                  <Ionicons name='close' size={16} color='#fff' />
                ) : status === 'active' ? (
                  <ActivityIndicator size='small' color='#fff' />
                ) : (
                  <Text style={styles.bubbleNumber}>{index + 1}</Text>
                )}
              </View>
            </View>
            <View style={styles.copy}>
              <Text
                style={[
                  styles.label,
                  status === 'active' && styles.labelActive,
                  status === 'done' && styles.labelDone,
                  status === 'error' && styles.labelError,
                ]}
              >
                {step.label}
              </Text>
              {isSendStep && status !== 'pending' && clientIp ? (
                <Text style={styles.sub}>Session from {clientIp}</Text>
              ) : null}
              {status === 'error' && errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 8 },
  row: { flexDirection: 'row', minHeight: 52 },
  rail: { width: 36, alignItems: 'center' },
  connector: {
    position: 'absolute',
    top: 0,
    left: 17,
    width: 2,
    height: 14,
    backgroundColor: palette.primary,
  },
  connectorPending: { backgroundColor: palette.border },
  connectorDone: { backgroundColor: palette.primary },
  bubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bubbleActive: { borderColor: palette.primary, backgroundColor: palette.primary },
  bubbleDone: { borderColor: palette.primary, backgroundColor: palette.primary },
  bubbleError: { borderColor: palette.danger, backgroundColor: palette.danger },
  bubbleNumber: { color: palette.textSecondary, fontSize: 12, fontWeight: '700' },
  copy: { flex: 1, paddingLeft: 8, paddingBottom: 14 },
  label: { color: palette.textSecondary, fontSize: 14, fontWeight: '600' },
  labelActive: { color: palette.textPrimary },
  labelDone: { color: palette.textPrimary },
  labelError: { color: palette.danger },
  sub: { color: palette.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 17 },
  errorText: { color: palette.danger, fontSize: 12, marginTop: 4, lineHeight: 17 },
});
