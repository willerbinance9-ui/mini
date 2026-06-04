const {
  validateTradingPassword,
  validateAccountName,
  normalizeBotType,
  getMinDeposit,
} = require('./liveTradingValidation');
const { normalizePriceBatch } = require('./priceFeedNormalize');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const goodPw = validateTradingPassword('Abcdef1!');
assert(goodPw.ok, 'valid password should pass');

const badPw = validateTradingPassword('short');
assert(!badPw.ok, 'short password should fail');

const name = validateAccountName('My Live 1');
assert(name.ok && name.value === 'My Live 1', 'valid nickname');

const bot = normalizeBotType('Synthetix_EA');
assert(bot === 'synthetix_ea', 'bot normalize');

assert(getMinDeposit('synthetix_ea') === 1000, 'synthetix min deposit');
assert(getMinDeposit('quantix_ea') === 200, 'quantix min deposit');

const batch = normalizePriceBatch({
  prices: [
    { symbol: 'eurusd', bid: 1.08, ask: 1.0802, digits: 5, dayOpen: 1.07, dayHigh: 1.09, dayLow: 1.06 },
    { symbol: 'EURUSD', bid: 1.08, ask: 1.08, digits: 5 },
    { symbol: 'BAD', bid: -1, ask: 1 },
  ],
});
assert(batch.length === 1, 'dedupe and validate prices');
assert(batch[0].symbol === 'EURUSD', 'uppercase symbol');
assert(batch[0].dayOpen === 1.07, 'day open parsed');

const { mapPriceRowForApi } = require('./priceFeedNormalize');
const mapped = mapPriceRowForApi({
  symbol: 'EURUSD',
  bid: 1.08,
  ask: 1.0802,
  digits: 5,
  day_open: 1.07,
  day_high: 1.09,
  day_low: 1.06,
  updated_at: new Date().toISOString(),
});
assert(mapped.changePct != null && mapped.changePct > 0, 'change percent computed');

console.log('liveTrading tests passed');
