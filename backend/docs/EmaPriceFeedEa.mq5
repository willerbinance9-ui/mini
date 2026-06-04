//+------------------------------------------------------------------+
//|                                           EmaPriceFeedEa.mq5     |
//|                   Batch POST market prices to EMA backend       |
//+------------------------------------------------------------------+
#property copyright "EMA"
#property link      "https://github.com/willerdev/ema"
#property version   "1.00"
#property description "POSTs bid/ask for Market Watch symbols to /webhooks/mt5-ea/prices"
#property strict

input string InpApiBase =
   "https://your-backend.onrender.com";   // No trailing slash; must be https
input string InpPriceFeedSecret =
   "";                                     // MT5_PRICE_FEED_SECRET from backend env
input int    InpIntervalSeconds  = 1;     // POST interval (1 = every second)
input string InpSymbolList       =
   "";                                     // Optional comma list; empty = all Market Watch

#define MAX_PRICE_SYMBOLS 120

//+------------------------------------------------------------------+
string TrimApiBase(string base)
{
   string b = base;
   while(StringLen(b) > 0 && StringGetCharacter(b, StringLen(b) - 1) == '/')
      b = StringSubstr(b, 0, StringLen(b) - 1);
   return b;
}

//+------------------------------------------------------------------+
string JsonEscape(const string s)
{
   string r = s;
   StringReplace(r, "\\", "\\\\");
   StringReplace(r, "\"", "\\\"");
   StringReplace(r, "\r", "\\r");
   StringReplace(r, "\n", "\\n");
   return r;
}

//+------------------------------------------------------------------+
bool HttpPostJson(const string url, const string headers, const string body, int timeout_ms,
                  string &response_out, int &http_status)
{
   uchar data[];
   int sz = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(sz < 1)
      return false;
   uchar result[];
   string result_headers;
   ResetLastError();
   http_status = WebRequest("POST", url, headers, timeout_ms, data, sz, result, result_headers);
   if(http_status == -1)
   {
      response_out = "";
      return false;
   }
   response_out = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return true;
}

//+------------------------------------------------------------------+
int CollectSymbols(string &symbols[])
{
   ArrayResize(symbols, 0);
   string list = InpSymbolList;
   StringTrimLeft(list);
   StringTrimRight(list);
   if(StringLen(list) > 0)
   {
      string parts[];
      int n = StringSplit(list, ',', parts);
      for(int i = 0; i < n && ArraySize(symbols) < MAX_PRICE_SYMBOLS; i++)
      {
         string sym = parts[i];
         StringTrimLeft(sym);
         StringTrimRight(sym);
         if(StringLen(sym) < 1)
            continue;
         SymbolSelect(sym, true);
         int sz = ArraySize(symbols);
         ArrayResize(symbols, sz + 1);
         symbols[sz] = sym;
      }
      return ArraySize(symbols);
   }
   int total = SymbolsTotal(true);
   for(int i = 0; i < total && ArraySize(symbols) < MAX_PRICE_SYMBOLS; i++)
   {
      string sym = SymbolName(i, true);
      if(StringLen(sym) < 1)
         continue;
      int sz = ArraySize(symbols);
      ArrayResize(symbols, sz + 1);
      symbols[sz] = sym;
   }
   return ArraySize(symbols);
}

//+------------------------------------------------------------------+
bool PostPriceBatch(const string api_base)
{
   if(StringLen(InpPriceFeedSecret) < 16)
   {
      Print("EmaPriceFeedEa: set InpPriceFeedSecret (same as MT5_PRICE_FEED_SECRET).");
      return false;
   }
   string symbols[];
   int count = CollectSymbols(symbols);
   if(count < 1)
   {
      Print("EmaPriceFeedEa: no symbols in Market Watch.");
      return false;
   }
   string body = "{\"prices\":[";
   bool first = true;
   for(int i = 0; i < count; i++)
   {
      string sym = symbols[i];
      double bid = SymbolInfoDouble(sym, SYMBOL_BID);
      double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
      if(bid <= 0 || ask <= 0 || ask < bid)
         continue;
      int dg = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      datetime bar_time = iTime(sym, PERIOD_D1, 0);
      double day_open = (bar_time > 0) ? iOpen(sym, PERIOD_D1, 0) : 0;
      double day_high = (bar_time > 0) ? iHigh(sym, PERIOD_D1, 0) : 0;
      double day_low  = (bar_time > 0) ? iLow(sym, PERIOD_D1, 0) : 0;
      if(!first)
         body += ",";
      first = false;
      body += "{\"symbol\":\"" + JsonEscape(sym) + "\",";
      body += "\"bid\":" + DoubleToString(bid, dg) + ",";
      body += "\"ask\":" + DoubleToString(ask, dg) + ",";
      body += "\"digits\":" + IntegerToString(dg);
      if(day_open > 0)
         body += ",\"dayOpen\":" + DoubleToString(day_open, dg);
      if(day_high > 0)
         body += ",\"dayHigh\":" + DoubleToString(day_high, dg);
      if(day_low > 0)
         body += ",\"dayLow\":" + DoubleToString(day_low, dg);
      body += "}";
   }
   body += "]}";
   if(first)
      return false;
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + InpPriceFeedSecret + "\r\n";
   string resp;
   int st = 0;
   string url = api_base + "/webhooks/mt5-ea/prices";
   if(!HttpPostJson(url, headers, body, 15000, resp, st))
   {
      Print("EmaPriceFeedEa: WebRequest failed. Err=", GetLastError(),
            " (Tools → Options → Expert Advisors → Allow WebRequest for API host)");
      return false;
   }
   if(st < 200 || st >= 300)
      Print("EmaPriceFeedEa: HTTP ", st, " ", StringSubstr(resp, 0, 200));
   return (st >= 200 && st < 300);
}

//+------------------------------------------------------------------+
int OnInit()
{
   EventSetTimer(MathMax(1, InpIntervalSeconds));
   Print("EmaPriceFeedEa started. Interval=", InpIntervalSeconds, "s");
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
}

//+------------------------------------------------------------------+
void OnTimer()
{
   string base = TrimApiBase(InpApiBase);
   PostPriceBatch(base);
}

//+------------------------------------------------------------------+
void OnTick()
{
   // Timer-driven only
}

//+------------------------------------------------------------------+
