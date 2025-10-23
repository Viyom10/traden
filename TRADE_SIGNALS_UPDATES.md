# Trade Signals - Recent Updates

## Major Changes Made

### 1. Leverage-Based System (Instead of Fixed Size)
**Before:** Signals specified a fixed trade size (e.g., "0.5 SOL" or "100 USDC")
**After:** Signals specify a leverage multiplier (e.g., "2x", "3x")

**How it works now:**
- Creator sets leverage multiplier when creating signal (e.g., 2x)
- When customer executes signal:
  ```
  Customer's Collateral = 10 SOL
  Leverage Multiplier = 2x
  Trade Size = 10 × 2 = 20 SOL worth
  ```
- Each customer's trade size is personalized to their balance
- System always uses "quote" (USDC) asset type for consistency

**Benefits:**
- Fairer for customers with different account sizes
- Risk is proportional to their capital
- No need for creator to know customer balances
- Simpler signal creation

### 2. Experience-Based Access Control (Instead of Creator ID)
**Before:** Signals were tied to creatorId (wallet address)
**After:** Signals are tied to experienceId (Whop experience)

**How it works now:**
- Only Whop admins of an experience can create signals
- Signals are stored with experienceId as the key
- All members of that Whop experience can see and execute the signals
- Proper integration with Whop's access control system

**Benefits:**
- Cleaner access control through Whop
- Multiple admins per experience can manage signals
- Customers see signals from their experience, not from specific wallet
- Better scalability and multi-admin support

## Files Modified

### Schema & API
1. `/schemas/TradeSignalSchema.ts`
   - Removed: `creatorId`, `sizeType`, `size`
   - Added: `leverageMultiplier` (number, 0.1-10 range)
   - Updated indexes to use only experienceId

2. `/app/api/signal/route.ts`
   - POST: Now validates `leverageMultiplier` instead of `size`/`sizeType`
   - GET: Removed creatorId filtering, only experienceId
   - Updated validation logic

3. `/lib/signalApi.ts`
   - Removed `fetchCreatorSignals` function
   - Updated interfaces to use `leverageMultiplier`
   - Only `fetchExperienceSignals` function remains

### Components
4. `/components/creator/CreateSignalForm.tsx`
   - Removed: Size Type dropdown, Size input
   - Added: Leverage Multiplier input (0.1-10 range)
   - Helper text explains how leverage works
   - Removed `creatorId` prop, only needs `experienceId`

5. `/components/creator/ActiveSignalsTable.tsx`
   - "Size" column → "Leverage" column
   - Shows "2x leverage" instead of "0.5 SOL"

6. `/components/signals/SignalCard.tsx`
   - Shows leverage multiplier prominently
   - Displays: "Trade size = Your collateral × {multiplier}"
   - Removed size/sizeType display

### Hooks
7. `/hooks/creator/useCreatorSignals.ts`
   - Now takes `experienceId` instead of `creatorId`
   - Uses `fetchExperienceSignals` internally
   - Updated query key to "experienceSignals"

8. `/hooks/signals/useSignalExecution.ts`
   - **Major change:** Calculates trade size dynamically
   - Gets customer's collateral: `currentUserAccount.getNetUsdValue()`
   - Calculates: `tradeSize = collateral × signal.leverageMultiplier`
   - Always uses "quote" asset type
   - Passes calculated size to Drift SDK

9. `/app/creator/components/CreatorDashboard.tsx`
   - Removed `useWallet` import (no longer needs publicKey)
   - Passes only `experienceId` to CreateSignalForm
   - Uses `experienceId` for fetching signals

## UI Changes Visible to Users

### For Creators:
- **Signal Creation Form:**
  - No more "Size Type" dropdown
  - No more "Size" input
  - New "Leverage Multiplier" input (with helper text)
  - Range: 0.1x to 10x
  
- **Active Signals Table:**
  - "Size" column changed to "Leverage"
  - Shows "2x leverage" instead of specific amounts

### For Customers:
- **Signal Cards:**
  - Prominently displays leverage (e.g., "2x")
  - Shows explanation: "Trade size = Your collateral × 2"
  - More transparent about how their trade will be sized

## Technical Details

### Size Calculation Logic
```typescript
// In useSignalExecution.ts
const currentUserAccount = drift.driftClient.getUser(activeSubAccountId);
const collateralValue = currentUserAccount.getNetUsdValue();
const tradeSizeInQuote = collateralValue.toNum() * signal.leverageMultiplier;
const sizeBigNum = BigNum.fromPrint(tradeSizeInQuote.toString(), QUOTE_PRECISION_EXP);

// Always use "quote" asset type
await drift.openPerpOrder({
  ...
  assetType: "quote",
  size: sizeBigNum,
  ...
});
```

### Database Structure
```typescript
{
  experienceId: string,      // Primary identifier
  leverageMultiplier: number, // 0.1 to 10
  // ... other fields
}
```

## Migration Notes

If you have existing signals in the database, you'll need to:
1. Add `leverageMultiplier` field to existing documents
2. Remove `creatorId`, `sizeType`, `size` fields
3. Or simply clear the signals collection and start fresh

## Testing Checklist

- [ ] Create signal with different leverage values (0.5x, 1x, 2x, 5x)
- [ ] Verify only Whop admins can access Creator Dashboard
- [ ] Execute signal with different collateral amounts
- [ ] Verify trade size = collateral × leverage
- [ ] Test with multiple users in same experience
- [ ] Verify all users see the same signals
- [ ] Test signal expiry
- [ ] Test signal cancellation
- [ ] Verify database records show correct calculated sizes
