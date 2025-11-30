# Shiprocket Checkout Integration Guide

This document explains the complete Shiprocket Checkout integration for your e-commerce platform.

## Overview

Shiprocket Checkout provides a seamless, high-converting checkout solution with:
- ✅ One-click Checkout
- ✅ Address Autofill & Validation
- ✅ Smart Payment Options (UPI, BNPL, Cards, COD)
- ✅ Post-purchase Engagement

## Integration Components

### 1. Catalog Sync APIs (Public Edge Functions)

These APIs allow Shiprocket to pull your product catalog. They are **public endpoints** (no authentication required) but should be registered with Shiprocket.

#### Fetch All Products
**Endpoint**: `https://your-project.supabase.co/functions/v1/shiprocket-catalog-products?page=1&limit=100`

Returns all products with pagination.

#### Fetch Products by Collection
**Endpoint**: `https://your-project.supabase.co/functions/v1/shiprocket-catalog-products-by-collection?collection_id=xxx&page=1&limit=100`

Returns products filtered by category/collection.

#### Fetch All Collections
**Endpoint**: `https://your-project.supabase.co/functions/v1/shiprocket-catalog-collections?page=1&limit=100`

Returns all categories/collections.

### 2. Checkout Flow

#### Generate Access Token
When user clicks checkout, call:
- **Edge Function**: `shiprocket-create-session`
- **Purpose**: Generates a checkout token
- **Modes**: 
  - **Test Mode**: When `SHIPROCKET_API_KEY` and `SHIPROCKET_API_SECRET` are not configured
  - **Production Mode**: When credentials are configured

#### Checkout Button
The checkout button loads Shiprocket's iframe with the generated token:
```javascript
HeadlessCheckout.addToCart(event, token, {fallbackUrl: "https://your-site.com"})
```

### 3. Order Webhook

**Edge Function**: `shiprocket-webhook`

Receives order confirmation from Shiprocket after successful payment.

**Handles**:
- Payment status updates
- Cart clearing
- Order confirmation
- Both test and production modes

### 4. Product & Collection Sync (Outgoing Webhooks)

These functions notify Shiprocket when you update products or categories:

#### Sync Product
**Edge Function**: `shiprocket-sync-product`
- Call this after creating/updating a product
- Requires authentication (user must be logged in)
- Only sends to Shiprocket if API credentials are configured

#### Sync Collection
**Edge Function**: `shiprocket-sync-collection`
- Call this after creating/updating a category
- Requires authentication
- Only sends to Shiprocket if API credentials are configured

### 5. Order Details API

**Edge Function**: `shiprocket-order-details`

Fetch complete order details from Shiprocket using the order ID.

## Setup Instructions

### Step 1: Enable Shiprocket Checkout
Contact Shiprocket to enable Checkout for your account.

### Step 2: Configure API Credentials (For Production)

1. Get your API Key and Secret Key from Shiprocket
2. Add them as secrets in your project:
   - `SHIPROCKET_API_KEY`
   - `SHIPROCKET_API_SECRET`

**Note**: Without these credentials, the system runs in **Test Mode** automatically.

### Step 3: Register Catalog Endpoints with Shiprocket

Provide Shiprocket with your catalog API endpoints:
```
https://your-project.supabase.co/functions/v1/shiprocket-catalog-products
https://your-project.supabase.co/functions/v1/shiprocket-catalog-products-by-collection
https://your-project.supabase.co/functions/v1/shiprocket-catalog-collections
```

### Step 4: Register Webhook Endpoint

Provide your order webhook URL to Shiprocket:
```
https://your-project.supabase.co/functions/v1/shiprocket-webhook
```

### Step 5: Test the Integration

1. Add products to cart
2. Proceed to checkout
3. In Test Mode: Use the simulated payment page to test success/failure
4. In Production Mode: Complete real payment via Shiprocket's checkout

## Test Mode vs Production Mode

### Test Mode (Default)
- **Activated when**: `SHIPROCKET_API_KEY` and `SHIPROCKET_API_SECRET` are not set
- **Features**:
  - Mock checkout sessions
  - Simulated payment page
  - Can test success/failure scenarios
  - No real payment processing
  - Catalog sync webhooks are skipped

### Production Mode
- **Activated when**: Both API credentials are configured
- **Features**:
  - Real Shiprocket API calls
  - Actual payment processing
  - Real order tracking
  - Automatic catalog sync to Shiprocket

## Using Sync Functions

### In Admin Panel
When admin creates/updates products or categories, you should call the sync functions:

```javascript
// After creating/updating a product
await supabase.functions.invoke('shiprocket-sync-product', {
  body: { productId: 'product-uuid' }
});

// After creating/updating a category
await supabase.functions.invoke('shiprocket-sync-collection', {
  body: { collectionId: 'category-uuid' }
});
```

**Note**: These functions gracefully handle missing credentials in Test Mode.

## API Response Formats

All catalog APIs return data in Shiprocket's expected format with:
- Product/collection data
- Pagination information
- Proper status codes

## Security

- Catalog APIs are public (required by Shiprocket)
- Sync functions require user authentication
- HMAC signatures verify all communication with Shiprocket
- Test mode is completely isolated from production

## Troubleshooting

### Catalog Not Syncing
1. Verify catalog API endpoints are accessible
2. Check that APIs return proper format
3. Confirm endpoints are registered with Shiprocket

### Payments Failing
1. Check if in Test Mode or Production Mode
2. Verify API credentials are correct
3. Check edge function logs for errors

### Order Not Created
1. Check webhook is receiving calls
2. Verify order webhook endpoint is registered with Shiprocket
3. Check logs in `shiprocket-webhook` function

## Next Steps

1. **Test Mode**: Start testing without credentials to verify the flow
2. **Get Credentials**: Contact Shiprocket for API access
3. **Configure Production**: Add credentials to enable real payments
4. **Register Endpoints**: Share your API endpoints with Shiprocket
5. **Go Live**: Start processing real orders!

## Support

For integration support, contact Shiprocket or refer to their documentation:
- API Docs: https://documenter.getpostman.com/view/25617008/2sB34bL3ig
