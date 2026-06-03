const { validateTradingPassword, validateAccountName, normalizeBotType } = require('./liveTradingValidation');
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

const batch = normalizePriceBatch({
  prices: [
    { symbol: 'eurusd', bid: 1.08, ask: 1.0802, digits: 5 },
    { symbol: 'EURUSD', bid: 1.08, ask: 1.08, digits: 5 },
    { symbol: 'BAD', bid: -1, ask: 1 },
  ],
});
assert(batch.length === 1, 'dedupe and validate prices');
assert(batch[0].symbol === 'EURUSD', 'uppercase symbol');

console.log('liveTrading tests passed');
