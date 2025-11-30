import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Test payment page for Shiprocket test mode
serve(async (req: Request) => {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');
  const orderId = url.searchParams.get('order_id');
  const amount = url.searchParams.get('amount');

  // Simple HTML page to simulate payment
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Test Payment - Shiprocket</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 40px;
          max-width: 500px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
          color: #333;
          margin-top: 0;
          font-size: 24px;
        }
        .info {
          background: #f7f7f7;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 10px 0;
          padding: 8px 0;
          border-bottom: 1px solid #e0e0e0;
        }
        .info-row:last-child {
          border-bottom: none;
          font-weight: bold;
          font-size: 18px;
        }
        .label {
          color: #666;
        }
        .value {
          color: #333;
          font-weight: 500;
        }
        .buttons {
          display: flex;
          gap: 12px;
          margin-top: 30px;
        }
        button {
          flex: 1;
          padding: 14px 24px;
          font-size: 16px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s;
        }
        .success {
          background: #10b981;
          color: white;
        }
        .success:hover {
          background: #059669;
          transform: translateY(-2px);
        }
        .fail {
          background: #ef4444;
          color: white;
        }
        .fail:hover {
          background: #dc2626;
          transform: translateY(-2px);
        }
        .badge {
          display: inline-block;
          background: #fbbf24;
          color: #78350f;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          margin-left: 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🧪 Test Payment Gateway<span class="badge">TEST MODE</span></h1>
        <p style="color: #666; margin-bottom: 20px;">
          This is a simulated Shiprocket payment page for testing purposes.
        </p>
        
        <div class="info">
          <div class="info-row">
            <span class="label">Order ID:</span>
            <span class="value">${orderId?.substring(0, 8)}...</span>
          </div>
          <div class="info-row">
            <span class="label">Session ID:</span>
            <span class="value">${sessionId?.substring(0, 16)}...</span>
          </div>
          <div class="info-row">
            <span class="label">Amount:</span>
            <span class="value">₹${amount}</span>
          </div>
        </div>

        <div class="buttons">
          <button class="success" onclick="simulateSuccess()">
            ✓ Simulate Success
          </button>
          <button class="fail" onclick="simulateFail()">
            ✗ Simulate Failure
          </button>
        </div>
      </div>

      <script>
        function simulateSuccess() {
          // Call webhook with success status
          fetch(window.location.origin + '/functions/v1/shiprocket-webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              order_id: '${orderId}',
              cart_data: { items: [] },
              status: 'SUCCESS',
              payment_type: 'TEST',
              total_amount_payable: ${amount},
              test_mode: true
            })
          }).then(() => {
            window.location.href = window.location.origin + '/order-history?payment=success';
          });
        }

        function simulateFail() {
          // Call webhook with failure status
          fetch(window.location.origin + '/functions/v1/shiprocket-webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              order_id: '${orderId}',
              cart_data: { items: [] },
              status: 'FAILED',
              payment_type: 'TEST',
              total_amount_payable: ${amount},
              test_mode: true
            })
          }).then(() => {
            window.location.href = window.location.origin + '/order-history?payment=failed';
          });
        }
      </script>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
});
