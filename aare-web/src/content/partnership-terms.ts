export const PARTNERSHIP_TERMS = `
AARE PARTNER API — APPLICATION TERMS

1. Purpose and eligibility
The Min Partner API (accessed via Aare) is reserved for investment-oriented individuals and businesses. Submitting this application does not guarantee approval. We estimate that fewer than 10% of applicants qualify for enrollment.

2. Use of your answers
Every response you provide is used to design a personalized API scope, limits, and onboarding path. Incomplete or inaccurate information may result in immediate rejection.

3. API access
If approved, you receive server-to-server credentials (ema_pk_...) subject to granular scopes (users, wallet, deposits, withdrawals, compliance, airfarming, VIP, webhooks). You must not embed API keys in client-side applications. End-user sessions must be minted server-side.

4. Financial products
Partner users may access wallet balances, AarePaymentApi crypto deposits, approved withdrawals, airfarming drops, and VIP farmer products. All movements are subject to compliance review, admin approval where applicable, and platform risk controls.

5. Payment details
Fiat bank details or crypto addresses you provide are stored for settlement configuration. Crypto payout addresses will not be changed unless you contact us through official support channels first. You are responsible for accuracy of payment information.

6. Compliance
You agree that partner users created under your account may be subject to KYC/compliance requirements before withdrawals. You will not use the API for money laundering, fraud, or sanctions evasion.

7. Data protection
We process personal data in accordance with applicable law. Application data is retained for review and audit purposes.

8. No investment advice
Min and Aare provide infrastructure only. Nothing in the API documentation or onboarding constitutes financial, legal, or tax advice.

9. Termination
We may suspend or revoke API access at any time for risk, compliance, or policy violations without prior notice.

10. Acceptance
By checking "I agree", you confirm that all information is truthful and that you understand approval is discretionary.
`.trim();

export const PARTNERSHIP_DISCLAIMER =
  'Each answer shapes how personalized your API configuration will be. After submission, there is roughly a 90% chance you will not qualify — our Partner API is reserved for investment-oriented applicants only.';
