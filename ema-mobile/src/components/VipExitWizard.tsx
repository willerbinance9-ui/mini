import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FormModal } from './FormModal';
import { PrimaryButton } from './PrimaryButton';
import {
  VIP_EXIT_REVENUE_PERCENTS,
  vipFarmerService,
  type VipExitDestination,
  type VipExitMode,
  type VipExitQuote,
  type VipSummary,
} from '../services/vipFarmerService';
import { palette } from '../theme/colors';
import { sanitizeUserFacingError } from '../utils/userFacingError';

function fmtUsd(n: number) {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Props = {
  visible: boolean;
  summary: VipSummary;
  onClose: () => void;
  onComplete: () => void;
};

type Step = 1 | 2 | 3 | 4 | 5;

const inputStyle = {
  backgroundColor: palette.surfaceElevated,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: palette.border,
  color: palette.textPrimary,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 16,
  marginBottom: 12,
};

function ChoiceRow({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>
      <Text style={styles.choiceDesc}>{description}</Text>
    </Pressable>
  );
}

function LineItem({ label, value, highlight }: { label: string; value: string; highlight?: 'up' | 'down' }) {
  return (
    <View style={styles.lineRow}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text
        style={[
          styles.lineValue,
          highlight === 'up' && { color: palette.success },
          highlight === 'down' && { color: palette.danger },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function baseBeforeAdjustments(quote: VipExitQuote) {
  return quote.revenueSelectedUsd + quote.principalReturnUsd;
}

function ExitAdjustmentsReview({ quote }: { quote: VipExitQuote }) {
  const base = baseBeforeAdjustments(quote);
  return (
    <View style={styles.breakdown}>
      <LineItem label='Amount before fees and rewards' value={fmtUsd(base)} />
      <Text style={styles.sectionTitle}>May be deducted</Text>
      <LineItem label='Gas fees' value={fmtUsd(quote.gasFeesUsd)} highlight='down' />
      <LineItem label='Commission (30%)' value={fmtUsd(quote.commissionUsd)} highlight='down' />
      {quote.penaltyUsd > 0 ? (
        <LineItem label='Penalty (may be lifted)' value={fmtUsd(quote.penaltyUsd)} highlight='down' />
      ) : (
        <LineItem label='Penalty' value='None on this exit' />
      )}
      <Text style={styles.sectionTitle}>May be added</Text>
      <LineItem label='Gas fee reward' value={fmtUsd(quote.gasRewardUsd)} highlight='up' />
      {quote.investmentExtraCreditUsd > 0 ? (
        <LineItem label='Investment extra credit' value={fmtUsd(quote.investmentExtraCreditUsd)} highlight='up' />
      ) : (
        <LineItem label='Investment extra credit' value='Not eligible on this exit' />
      )}
    </View>
  );
}

export function VipExitWizard({ visible, summary, onClose, onComplete }: Props) {
  const inv = summary.investment;
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<VipExitMode>('full_stop');
  const [revenuePercent, setRevenuePercent] = useState<number>(100);
  const [destination, setDestination] = useState<VipExitDestination>('platform');
  const [walletAddress, setWalletAddress] = useState('');
  const [quote, setQuote] = useState<VipExitQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const reset = useCallback(() => {
    setStep(1);
    setMode('full_stop');
    setRevenuePercent(100);
    setDestination('platform');
    setWalletAddress('');
    setQuote(null);
    setDone(false);
  }, []);

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  const fetchQuote = useCallback(async () => {
    if (!inv) return null;
    setLoadingQuote(true);
    try {
      const q = await vipFarmerService.previewExit({
        mode,
        revenuePercent,
        destination,
        walletAddress: destination === 'direct_wallet' ? walletAddress.trim() : undefined,
      });
      setQuote(q);
      return q;
    } catch (e) {
      Alert.alert('VIP exit', sanitizeUserFacingError((e as Error).message));
      return null;
    } finally {
      setLoadingQuote(false);
    }
  }, [inv, mode, revenuePercent, destination, walletAddress]);

  const goStep4 = async () => {
    if (destination === 'direct_wallet' && !walletAddress.trim()) {
      Alert.alert('Wallet required', 'Enter your TRC20 wallet address.');
      return;
    }
    const q = await fetchQuote();
    if (q) setStep(4);
  };

  const onFinish = async () => {
    setSubmitting(true);
    try {
      await vipFarmerService.submitExitRequest({
        mode,
        revenuePercent,
        destination,
        walletAddress: destination === 'direct_wallet' ? walletAddress.trim() : undefined,
      });
      setDone(true);
    } catch (e) {
      const err = e as Error & { status?: number };
      const message =
        err.status === 503
          ? 'Exit withdrawals are not available yet. Please try again later or contact support.'
          : sanitizeUserFacingError(err.message);
      Alert.alert('Request failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    done
      ? 'Thank you'
      : step === 1
        ? 'How do you want to exit?'
        : step === 2
          ? 'Revenue to withdraw'
          : step === 3
            ? 'Payout destination'
            : step === 4
              ? 'Review adjustments'
              : 'Confirm request';

  const footer = (() => {
    if (done) {
      return (
        <PrimaryButton
          label='Close'
          onPress={() => {
            onComplete();
            onClose();
          }}
          style={{ marginTop: 12 }}
        />
      );
    }
    if (step === 1) {
      return (
        <PrimaryButton
          label='Continue'
          onPress={() => setStep(2)}
          style={{ marginTop: 12 }}
        />
      );
    }
    if (step === 2) {
      return (
        <View style={{ gap: 8, marginTop: 12 }}>
          <PrimaryButton label='Back' onPress={() => setStep(1)} />
          <PrimaryButton label='Continue' onPress={() => setStep(3)} />
        </View>
      );
    }
    if (step === 3) {
      return (
        <View style={{ gap: 8, marginTop: 12 }}>
          <PrimaryButton label='Back' onPress={() => setStep(2)} />
          <PrimaryButton label='Review fees' onPress={() => void goStep4()} disabled={loadingQuote} />
        </View>
      );
    }
    if (step === 4) {
      return (
        <View style={{ gap: 8, marginTop: 12 }}>
          <PrimaryButton label='Back' onPress={() => setStep(3)} />
          <PrimaryButton
            label='Approve'
            onPress={() => setStep(5)}
            disabled={!quote || loadingQuote}
          />
        </View>
      );
    }
    return (
      <View style={{ gap: 8, marginTop: 12 }}>
        <PrimaryButton label='Back' onPress={() => setStep(4)} />
        <PrimaryButton
          label={submitting ? 'Submitting…' : 'Finish'}
          disabled={submitting || !quote}
          onPress={() => void onFinish()}
        />
      </View>
    );
  })();

  if (!inv) return null;

  const available = inv.availableRevenueUsd ?? Math.max(0, inv.totalAccruedUsd - (inv.revenueWithdrawnUsd ?? 0));

  return (
    <FormModal visible={visible} title={title} onClose={onClose} footer={footer}>
      {done ? (
        <>
          <Text style={styles.thankYou}>
            {quote?.thankYouMessage || 'Thank you for investing with us.'}
          </Text>
          <Text style={styles.body}>
            Your withdrawal request is being processed. You will be notified when funds are sent.
          </Text>
        </>
      ) : null}

      {!done && step === 1 ? (
        <>
          <Text style={styles.hint}>
            Your choice affects penalties, gas fees, and rewards on this exit. A $1,000 investment extra credit
            applies when your principal is over $4,900 and you have more than 22 working accrual days.
          </Text>
          <ChoiceRow
            label='Withdraw all & stop'
            description='End your VIP investment and withdraw principal plus selected revenue.'
            selected={mode === 'full_stop'}
            onPress={() => setMode('full_stop')}
          />
          <ChoiceRow
            label='Withdraw partial & continue'
            description='Take part of your earned revenue and keep the investment running.'
            selected={mode === 'partial_continue'}
            onPress={() => setMode('partial_continue')}
          />
        </>
      ) : null}

      {!done && step === 2 ? (
        <>
          <Text style={styles.hint}>
            Available revenue: {fmtUsd(available)}. Select what share of total investment revenue to withdraw.
          </Text>
          <View style={styles.chipRow}>
            {VIP_EXIT_REVENUE_PERCENTS.map((pct) => (
              <Pressable
                key={pct}
                onPress={() => setRevenuePercent(pct)}
                style={[styles.chip, revenuePercent === pct && styles.chipSelected]}
              >
                <Text style={[styles.chipText, revenuePercent === pct && styles.chipTextSelected]}>{pct}%</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.meta}>
            ≈ {fmtUsd((available * revenuePercent) / 100)} of revenue selected
          </Text>
        </>
      ) : null}

      {!done && step === 3 ? (
        <>
          <ChoiceRow
            label='Platform wallet'
            description='Credit your in-app cash balance after processing.'
            selected={destination === 'platform'}
            onPress={() => setDestination('platform')}
          />
          <ChoiceRow
            label='Direct wallet (TRC20)'
            description='Send USDT to your external TRC20 address after processing.'
            selected={destination === 'direct_wallet'}
            onPress={() => setDestination('direct_wallet')}
          />
          {destination === 'direct_wallet' ? (
            <TextInput
              style={inputStyle}
              value={walletAddress}
              onChangeText={setWalletAddress}
              placeholder='TRC20 address (starts with T)'
              placeholderTextColor={palette.textSecondary}
              autoCapitalize='none'
              autoCorrect={false}
            />
          ) : null}
        </>
      ) : null}

      {!done && (step === 4 || step === 5) ? (
        loadingQuote && !quote ? (
          <ActivityIndicator color={palette.primary} style={{ marginVertical: 24 }} />
        ) : quote ? (
          <>
            {step === 4 ? (
              <>
                <Text style={styles.hint}>{quote.gasFeeDescription}</Text>
                <Text style={[styles.hint, { marginTop: 8 }]}>{quote.commissionDescription}</Text>
                <Text style={[styles.hint, { marginTop: 8 }]}>{quote.gasRewardDescription}</Text>
                <Text style={[styles.hint, { marginTop: 8 }]}>{quote.investmentExtraCreditDescription}</Text>
                <Text style={[styles.hint, { marginTop: 8 }]}>{quote.penaltyDescription}</Text>
                <ExitAdjustmentsReview quote={quote} />
              </>
            ) : (
              <>
                <Text style={styles.hint}>
                  Confirm your request. Final amounts are calculated when processing completes.
                </Text>
                <LineItem
                  label='Destination'
                  value={destination === 'platform' ? 'Platform wallet' : 'TRC20 wallet'}
                />
                <ExitAdjustmentsReview quote={quote} />
              </>
            )}
          </>
        ) : null
      ) : null}
    </FormModal>
  );
}

const styles = StyleSheet.create({
  hint: { color: palette.textSecondary, lineHeight: 20, marginBottom: 12 },
  thankYou: { color: palette.primary, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  body: { color: palette.textPrimary, lineHeight: 22 },
  meta: { color: palette.textSecondary, fontSize: 13 },
  choice: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    backgroundColor: palette.surfaceElevated,
  },
  choiceSelected: { borderColor: palette.primary, backgroundColor: 'rgba(91,156,245,0.08)' },
  choiceLabel: { color: palette.textPrimary, fontWeight: '700', fontSize: 16, marginBottom: 4 },
  choiceLabelSelected: { color: palette.primary },
  choiceDesc: { color: palette.textSecondary, fontSize: 13, lineHeight: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceElevated,
  },
  chipSelected: { borderColor: palette.primary, backgroundColor: 'rgba(91,156,245,0.12)' },
  chipText: { color: palette.textSecondary, fontWeight: '600' },
  chipTextSelected: { color: palette.primary },
  breakdown: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    gap: 8,
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontWeight: '700',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 4,
  },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineLabel: { color: palette.textSecondary, flex: 1, paddingRight: 8 },
  lineValue: { color: palette.textPrimary, fontWeight: '700' },
});
