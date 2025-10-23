# Trade Signals Feature Implementation

## Overview
This document describes the complete Trade Signals feature that has been implemented, allowing creators (Whop admins) to broadcast trading signals to their customers with expiry times. **Signals are based on leverage multipliers** rather than fixed sizes, so each customer's trade size is calculated based on their own collateral × the leverage multiplier.

## Key Concepts

### Experience-Based Access Control
- Signals are created and managed at the **Experience ID** level (not Creator ID)
- Only Whop admins of an experience can create signals
- All users with access to that experience can see and execute the signals
- This ensures proper access control through Whop's membership system

### Leverage-Based Trading
- Instead of fixed trade sizes, signals specify a **leverage multiplier** (e.g., 2x, 3x)
- When a customer executes a signal:
  - The system reads their current collateral balance
  - Calculates trade size = collateral × leverage multiplier
  - Places order with that calculated size
- Example: If creator sets 2x leverage and customer has 10 SOL collateral, the trade will be for 20 SOL worth

## Features Implemented

### 1. Database Schema (`/schemas/TradeSignalSchema.ts`)
- MongoDB schema for storing trade signals
- Fields include:
  - **experienceId** (not creatorId) - ties signals to Whop experiences
  - Market details (index, symbol)
  - Order parameters (type, direction, prices)
  - **leverageMultiplier** (replaces size/sizeType)
  - Expiry settings (duration, unit, expiry date)
  - Status tracking (isActive)
- Optimized indexes for efficient querying by experienceId

### 2. API Routes (`/app/api/signal/route.ts`)
- **POST**: Create new trade signals with automatic expiry calculation
  - Only requires experienceId (not creatorId)
  - Validates leverage multiplier (0.1x - 10x range)
- **GET**: Fetch active signals (filtered by experienceId, excludes expired by default)
- **DELETE**: Cancel/deactivate signals
- Includes validation and error handling

### 3. API Client Utilities (`/lib/signalApi.ts`)
- Helper functions for creating, fetching, and canceling signals
- `fetchExperienceSignals` - fetches signals by experienceId
- Time remaining calculation utilities
- Signal expiry checking
- TypeScript interfaces for type safety

### 4. Creator Components

#### CreateSignalForm (`/components/creator/CreateSignalForm.tsx`)
- Comprehensive form for Whop admins to define trade signals
- Features:
  - Market selection
  - Direction toggle (Long/Short)
  - Order type selection (Market, Limit, Take Profit, Stop Loss, Oracle Limit)
  - **Leverage Multiplier input** (e.g., 2 for 2x, 3 for 3x)
    - Range: 0.1x to 10x
    - Helper text explains how it works
  - Price inputs (conditional based on order type)
  - Optional TP/SL settings
  - Order flags (Reduce Only, Post Only)
  - **Expiry configuration**: Duration (number) + Unit (minutes/hours/days)
- Real-time validation and user feedback
- Only requires experienceId (no creatorId needed)

#### ActiveSignalsTable (`/components/creator/ActiveSignalsTable.tsx`)
- Display all active signals created by the creator
- Features:
  - Live countdown timers (updates every second)
  - Market, direction, order details
  - Expiry status with visual indicators
  - Cancel button for each signal
  - Automatic expiry detection

#### Updated CreatorDashboard
- Added tab navigation for "Fee Management" and "Trade Signals"
- Integrates CreateSignalForm and ActiveSignalsTable
- Fetches and displays signals using React Query
- Handles signal cancellation with toast notifications

### 5. Customer Components

#### SignalCard (`/components/signals/SignalCard.tsx`)
- Beautiful card display for each trade signal
- Features:
  - Market and direction indicators with color coding
  - Live countdown timer showing time until expiry
  - **Leverage Multiplier display** with explanation
  - Shows: "Trade size = Your collateral × {multiplier}"
  - All order details (type, prices)
  - Expandable TP/SL information
  - Order flags display (Reduce Only, Post Only)
  - **Execute Trade button** - calculates size and places order
  - Automatic disabling when expired
  - Loading states during execution

#### Signals Page (`/app/signals/page.tsx`)
- Dedicated page for customers to view and execute signals
- Features:
  - Grid layout displaying all active signals
  - Live status indicator
  - Loading, error, and empty states
  - Auto-refresh every 5 seconds
  - Wallet connection requirement
  - Signal count display

### 6. Hooks

#### useCreatorSignals (`/hooks/creator/useCreatorSignals.ts`)
- React Query hook for Whop admins
- Fetches signals for the current experienceId (not by creatorId)
- Auto-refetch every 10 seconds
- Handles signal cancellation

#### useExperienceSignals (`/hooks/signals/useExperienceSignals.ts`)
- React Query hook for customers
- Fetches active signals for the current experience
- Auto-refetch every 5 seconds to keep expiry status current
- Filters out expired signals automatically

#### useSignalExecution (`/hooks/signals/useSignalExecution.ts`)
- Handles the execution of trade signals
- **Key Feature: Dynamic Size Calculation**
  - Reads customer's current collateral balance
  - Calculates: `tradeSize = collateral × leverageMultiplier`
  - Uses quote (USDC) asset type for consistent calculations
- Features:
  - Validates signal is not expired before execution
  - Converts signal parameters to Drift SDK format
  - Supports all order types (Market, Limit, TP/SL, Oracle Limit)
  - Handles Swift execution when available
  - Records trades in database with calculated size
  - Proper error handling and user feedback
  - Builder fee integration

### 7. Navigation
- Added "Signals" link to the main navigation header
- Positioned between "Spot" and "User" tabs
- Available to all connected users

## User Flow

### For Whop Admins (Creators):
1. Must be admin of a Whop experience (access level = "admin")
2. Navigate to Creator Dashboard
3. Click "Trade Signals" tab
4. Fill out the signal form:
   - Select market
   - Choose direction (Long/Short)
   - Set order type and parameters
   - **Define leverage multiplier** (e.g., 2 for 2x leverage)
   - Set prices if needed
   - **Set expiry** (e.g., "15 minutes", "2 hours", "1 day")
5. Click "Create Signal"
6. Signal is saved with experienceId
7. All members of that experience can now see it
8. View active signals in the table below
9. Cancel signals if needed

### For Customers:
1. Must be member of a Whop experience
2. Navigate to "Signals" page from main navigation
3. See all active signals created by their experience admin
4. View leverage multiplier and countdown timer
5. Click "Execute Trade" on any signal
6. System calculates: `tradeSize = yourCollateral × leverageMultiplier`
7. Order is placed instantly through Drift with calculated size
8. Trade is recorded in database
9. Example: If you have 10 SOL collateral and signal has 2x leverage, trade will be for 20 SOL worth

## Technical Highlights

### Expiry System
- Flexible duration + unit system (minutes, hours, days)
- Automatic calculation of expiry timestamp on server
- Live countdown timers on client using `setInterval`
- Server-side filtering of expired signals
- Client-side validation before execution

### Real-time Updates
- React Query automatic refetching
- Countdown timers update every second
- Live status indicators
- Optimistic UI updates

### Error Handling
- Comprehensive validation on both client and server
- User-friendly error messages via toast notifications
- Geo-blocking support
- Network error handling

### Performance
- MongoDB indexes for fast queries
- React Query caching to reduce API calls
- Efficient time calculations
- Lazy loading and code splitting

### Type Safety
- Full TypeScript implementation
- Shared interfaces between client and server
- Strict type checking for all components

## Database Indexes
- `{ experienceId: 1, isActive: 1, expiresAt: -1 }`
- `{ isActive: 1, expiresAt: 1 }` (for cleanup)

## API Endpoints

### POST /api/signal
Create a new trade signal
```typescript
{
  experienceId: string,  // NOT creatorId
  marketIndex: number,
  marketSymbol: string,
  orderType: string,
  direction: "LONG" | "SHORT",
  leverageMultiplier: number,  // NOT size/sizeType
  expiryDuration: number,
  expiryUnit: "min" | "hour" | "day",
  // ... optional fields
}
```

### GET /api/signal
Fetch trade signals
```
?experienceId=xxx - Filter by experience (NOT creatorId)
?includeExpired=true - Include expired signals
?limit=100 - Results limit
?skip=0 - Pagination offset
```

### DELETE /api/signal
Cancel a signal
```
?signalId=xxx - Signal to cancel
```

## Future Enhancements (Not Implemented)
- Signal analytics and performance tracking
- Signal templates for quick creation
- Push notifications when new signals are created
- Signal execution history for customers
- Bulk signal creation
- Signal scheduling (create now, activate later)
- Signal categories/tags
- Copy trading (auto-execute all signals)
- Signal comments/notes from creator
- Email/SMS notifications for new signals

## Testing Recommendations
1. Test signal creation with various expiry durations
2. Verify countdown timers update correctly
3. Test signal execution before and after expiry
4. Verify cancellation works properly
5. Test with multiple markets and order types
6. Check mobile responsiveness
7. Test error scenarios (network errors, invalid data)
8. Verify MongoDB queries are efficient
9. Test with multiple concurrent users
10. Verify builder fees are applied correctly

## Security Considerations
- Signals are tied to experienceId for access control
- Only creators can create/cancel their signals
- Signal execution uses existing Drift authentication
- No sensitive data exposed in APIs
- Input validation on all endpoints
- Rate limiting should be added for production

## Deployment Notes
- Ensure MongoDB connection string is configured
- Environment variables properly set
- Database indexes created
- Monitor API performance
- Set up logging for signal creation/execution
- Consider adding Redis for caching active signals
