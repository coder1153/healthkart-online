# Admin Authentication Setup Guide

## Overview

This application uses **API key-based authentication** for admin access, providing secure, token-based authentication separate from regular user logins.

## Initial Admin Key

A default admin key has been created for your first login:

```
admin_master_key_2024
```

**⚠️ SECURITY WARNING**: Change this key immediately after your first login!

## Admin Access

### 1. Login to Admin Panel

1. Navigate to `/admin/login`
2. Enter your admin key
3. Click "Access Admin Panel"

You'll receive a session token valid for **1 hour**.

### 2. Admin Features

Once logged in, you can:

- **Dashboard**: View statistics (products, orders, users, revenue)
- **Product Management**: Add, edit, delete products and manage stock
- **Order Management**: View all orders, update statuses, filter by date/status
- **User Management**: View registered users and their roles
- **Key Management**: Create and revoke admin keys

## Managing Admin Keys

### Create New Admin Key

```bash
# Using the admin-keys edge function
POST /functions/v1/admin-keys
Authorization: Bearer <admin_token>

{
  "label": "Marketing Team Key",
  "expires_in_days": 90
}
```

Response includes the **plaintext key** - this is shown **only once**!

```json
{
  "success": true,
  "key": "AbcD1234-EfGh5678-IjKl9012-MnOp3456",
  "label": "Marketing Team Key",
  "id": "...",
  "expires_at": "2025-03-15T...",
  "warning": "Store this key securely! It will not be shown again."
}
```

### List All Keys

```bash
GET /functions/v1/admin-keys
Authorization: Bearer <admin_token>
```

### Delete a Key

```bash
DELETE /functions/v1/admin-keys/:key_id
Authorization: Bearer <admin_token>
```

## Security Features

### 🔒 Rate Limiting

- Maximum **5 login attempts** per IP address
- **15-minute** lockout after exceeding limit
- Automatic reset on successful login

### 🔐 Token Security

- Admin tokens expire after **1 hour**
- Tokens are **JWT-based** with HMAC-SHA256 signing
- Keys are stored as **SHA-256 hashes** (never plaintext)

### 📝 Audit Logging

All admin actions are logged to the `admin_audit` table:

- Login attempts
- Key creation/deletion
- Product modifications
- Order updates

Query audit logs:

```sql
SELECT * FROM admin_audit 
ORDER BY timestamp DESC 
LIMIT 100;
```

## Environment Variables

Set these in your edge function environment:

```bash
JWT_SECRET=<your-secure-secret>
SHIPROCKET_API_KEY=<your-shiprocket-key>  # Optional: for production payments
```

**⚠️ Production Deployment**: Always set a strong `JWT_SECRET` in production!

## Best Practices

### 1. Key Rotation

- Rotate admin keys every **90 days**
- Set expiration dates when creating keys
- Delete unused/compromised keys immediately

### 2. Key Labeling

Use descriptive labels for tracking:

```
✅ "John Doe - Operations Lead"
✅ "Marketing Dashboard - Q1 2025"
❌ "key1"
❌ "admin"
```

### 3. Access Control

- Create **separate keys** for different team members
- Set **expiration dates** for temporary access
- Review active keys monthly

### 4. Monitoring

Regularly check:

```sql
-- Recently used keys
SELECT label, last_used_at 
FROM admin_keys 
ORDER BY last_used_at DESC;

-- Expired keys
SELECT label, expires_at 
FROM admin_keys 
WHERE expires_at < NOW();

-- Recent admin actions
SELECT action, resource_type, timestamp 
FROM admin_audit 
ORDER BY timestamp DESC 
LIMIT 50;
```

## Troubleshooting

### "Invalid admin key"

- Verify you're entering the correct key (case-sensitive)
- Check if the key has expired
- Ensure rate limiting hasn't locked your IP

### "Token expired"

- Your session lasted > 1 hour
- Login again with your admin key

### "Too many attempts"

- Wait 15 minutes before trying again
- Check if you're using the correct key

## Database Schema

### admin_keys Table

```sql
- id: UUID (primary key)
- key_hash: TEXT (SHA-256 hash of key)
- label: TEXT (human-readable identifier)
- created_by: TEXT (who created this key)
- expires_at: TIMESTAMP (optional expiration)
- created_at: TIMESTAMP
- last_used_at: TIMESTAMP
```

### admin_audit Table

```sql
- id: UUID (primary key)
- admin_key_id: UUID (foreign key)
- action: TEXT (action performed)
- resource_type: TEXT (e.g., "product", "order")
- resource_id: TEXT (ID of affected resource)
- before: JSONB (state before change)
- after: JSONB (state after change)
- timestamp: TIMESTAMP
```

## Migration from Email-Based Auth

The old email-based admin system (`imsridhar26@gmail.com`) has been **removed** and replaced with API key authentication. If you had admin access via email previously, you now need to:

1. Use the initial master key to login
2. Create a personal admin key for yourself
3. Store it securely (password manager recommended)
4. Delete or rotate the master key

## Support

For issues or questions:

1. Check the `admin_audit` logs for action history
2. Verify edge function logs in Supabase dashboard
3. Review network requests in browser DevTools

---

**Security Reminder**: Never commit admin keys to version control or share them in plaintext!
