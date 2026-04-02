# RESO TLS CA Setup

This document describes how to keep RESO media sync secure without disabling TLS verification.

## Problem

In some runtime environments, requests to:

- `https://admin.resoleasing.com/api/sales-catalog`

may fail with:

- `UNABLE_TO_VERIFY_LEAF_SIGNATURE`

The root cause is usually a missing intermediate CA certificate in the runtime trust chain.

## Repository Assets

- Extra CA file for RESO endpoint:
  - `backend/certs/reso-extra-ca.pem`

## Railway Configuration

Set environment variable for the backend service:

- `NODE_EXTRA_CA_CERTS=/app/backend/certs/reso-extra-ca.pem`

After setting the variable, redeploy the service.

## Verification

Run inside the Railway container:

```bash
node -e "fetch('https://admin.resoleasing.com/api/sales-catalog?vin=LGJ509EZPPR000290').then(async r=>console.log(r.status,(await r.text()).slice(0,120))).catch(e=>console.error(e.message,e.cause?.code))"
```

Expected result:

- HTTP `200` and JSON payload (not TLS error).

## Security Note

Do not use `NODE_TLS_REJECT_UNAUTHORIZED=0` as a permanent solution.
It disables TLS certificate verification globally for the process and increases MITM risk.
