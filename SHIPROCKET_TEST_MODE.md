# Shiprocket Test Mode Guide

## Overview
The application automatically uses **Test Mode** when Shiprocket API credentials are not configured. This allows you to test the complete payment flow without real payment processing.

## How Test Mode Works

### Automatic Detection
The system checks for `SHIPROCKET_API_KEY` and `SHIPROCKET_API_SECRET` environment variables:
- **Missing credentials** → Test Mode is activated automatically
- **Credentials present** → Production Mode with real Shiprocket API calls

### Test Mode Flow

1. **Checkout Initiation**
   - User fills delivery information and clicks "Checkout with Shiprocket"
   - System generates a mock session ID and order ID
   - User is redirected to a simulated payment page

2. **Simulated Payment Page**
   - Beautiful test payment interface with order details
   - Two buttons:
     - ✓ **Simulate Success** - Marks payment as successful
     - ✗ **Simulate Failure** - Marks payment as failed

3. **Order Processing**
   - Webhook is triggered with test payment status
   - Order status is updated in the database
   - Cart is cleared on successful payment
   - User is redirected to order history page

## Testing the Payment Flow

### Step 1: Add Products to Cart
1. Browse products and add items to your cart
2. Go to Cart page

### Step 2: Proceed to Checkout
1. Click "Proceed to Checkout" button
2. Fill in delivery information:
   - Full Name
   - Phone Number
   - Address
   - Pincode, City, State

### Step 3: Initiate Payment
1. Click "Checkout with Shiprocket" button
2. You'll see a toast notification: "Test Mode Active"
3. Wait for redirect to test payment page

### Step 4: Simulate Payment
On the test payment page, you'll see:
- Order ID (truncated)
- Session ID (truncated)
- Amount to be paid
- Two buttons to simulate payment outcome

**To Test Success:**
- Click "✓ Simulate Success"
- Order status → `paid`
- Payment status → `paid`
- Cart is cleared
- Redirected to Order History with success message

**To Test Failure:**
- Click "✗ Simulate Failure"
- Order status → `pending`
- Payment status → `failed`
- Cart remains unchanged
- Redirected to Order History with failure message

## Switching to Production Mode

To use real Shiprocket payments, add these secrets in your Lovable project:

1. Go to your project settings
2. Add the following secrets:
   - `SHIPROCKET_API_KEY` - Your Shiprocket API Key
   - `SHIPROCKET_API_SECRET` - Your Shiprocket Secret Key

Once configured, the system automatically switches to Production Mode and uses real Shiprocket Checkout.

## Visual Indicators

### Test Mode Active
- Toast notification: "Test Mode Active - You'll be redirected to a test payment page"
- Test payment page has a yellow "TEST MODE" badge
- Beautiful gradient background (purple to violet)
- Clear indication this is for testing only

### Production Mode
- No test mode notifications
- Shiprocket iframe/modal opens for real payment
- Real payment methods available (UPI, Cards, BNPL, COD)

## Database Changes in Test Mode

When testing payments, actual database changes occur:
- Orders are created with status `pending`
- Order items are recorded
- On successful payment:
  - Order status → `paid`
  - Payment status → `paid`
  - Cart items are deleted
- On failed payment:
  - Order status → `pending`
  - Payment status → `failed`
  - Cart items remain

## Benefits of Test Mode

✅ **No Setup Required** - Works immediately without API credentials
✅ **Safe Testing** - No real money transactions
✅ **Full Flow Simulation** - Tests entire checkout process
✅ **Database Integration** - Tests order creation and updates
✅ **Easy Switching** - Automatically switches to production when credentials are added
✅ **Developer Friendly** - Clear UI and logging for debugging

## Troubleshooting

### Test Payment Page Not Loading
- Check browser console for errors
- Ensure Edge Functions are deployed
- Verify you're logged in (authentication required)

### Webhook Not Updating Order
- Check Edge Function logs for `shiprocket-webhook`
- Verify order was created with correct `payment_id`
- Ensure database connection is working

### Cart Not Clearing After Success
- Check if payment status is marked as `paid`
- Verify webhook completed successfully
- Check Edge Function logs for cart clearing errors

## Example Test Scenarios

### Scenario 1: Successful Order
1. Add product worth ₹500
2. Checkout and fill delivery details
3. Click "Simulate Success"
4. ✅ Order created with status `paid`
5. ✅ Cart cleared
6. ✅ Redirected to order history

### Scenario 2: Failed Payment
1. Add product worth ₹1000
2. Checkout and fill delivery details
3. Click "Simulate Failure"
4. ⚠️ Order created with status `pending`
5. ⚠️ Cart remains with items
6. ⚠️ User can retry checkout

### Scenario 3: Multiple Test Orders
1. Create multiple test orders
2. Some successful, some failed
3. Check order history page
4. Verify all orders are tracked correctly

## Production Checklist

Before going live with real payments:

- [ ] Obtain Shiprocket API Key and Secret from Shiprocket dashboard
- [ ] Add credentials as secrets in Lovable project
- [ ] Test production checkout with small amount
- [ ] Verify webhook receives real Shiprocket data
- [ ] Test successful payment flow
- [ ] Test failed payment handling
- [ ] Monitor Edge Function logs for errors
- [ ] Set up order notification system
- [ ] Configure shipping integration with Shiprocket
