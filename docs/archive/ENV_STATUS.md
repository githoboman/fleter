# Environment Files Status - UPDATED April 6, 2026

## ✅ Issue Examples Fixed

### ✅ backend/ai-agent/.env

**Before:** Had old Starknet variables (STARKNET_RPC_URL, MARKET_CONTRACT_ADDRESS)
**After:** Now has Somnia config (OPENAI_API_KEY, GATEWAY_URL)

### ✅ backend/gateway/.env

**Before:** Missing SOMNIA_RPC_URL (code uses it in streams.ts)
**After:** Added SOMNIA_RPC_URL=https://dream-rpc.somnia.network

---

## 📋 All Services Environment Status

| Service      | File                    | Status        | Notes                                                         |
| ------------ | ----------------------- | ------------- | ------------------------------------------------------------- |
| **Indexer**  | `backend/indexer/.env`  | ✅ Ready      | All vars correct, START_BLOCK filled                          |
| **Gateway**  | `backend/gateway/.env`  | ✅ Ready      | Fixed: Added missing SOMNIA_RPC_URL                           |
| **Keeper**   | `backend/keeper/.env`   | ⏳ Needs TODO | Placeholder: KEEPER_PRIVATE_KEY=`<keeper wallet private key>` |
| **AI Agent** | `backend/ai-agent/.env` | ✅ Ready      | Fixed: Removed Starknet config, added GATEWAY_URL             |
| **Frontend** | `frontend/.env.local`   | ✅ Ready      | No changes needed                                             |

---

## ⏳ Remaining TODOs Before Phase 5

**To complete setup, you need to:**

1. **Generate a keeper wallet** (use Somnia faucet to fund it with ~2 STT)
2. **Update keeper wallet details in two files:**

    **File 1:** `backend/keeper/.env`

    ```env
    KEEPER_PRIVATE_KEY=0x<your 64-char hex key>
    ```

    **File 2:** `backend/gateway/.env`

    ```env
    STREAMS_PUBLISHER_PRIVATE_KEY=0x<same keeper private key>
    STREAMS_PUBLISHER_ADDRESS=0x<keeper address>
    ```

3. **Verify database connection string** (should be correct already):
    ```env
    POSTGRES_CONNECTION_STRING=postgresql://0t41k1@localhost:5432/bitdrum
    ```

    - Adjust username if your local postgres user is different

---

## Reference: Env Var Format Quick Check

✅ **Correct Formats Used:**

- URLs: `https://dream-rpc.somnia.network`
- WS URLs: `wss://api.infra.testnet.somnia.network/ws`
- Addresses: `0x90C70e356540C8b53Bb5cd0BA35B8f2779c9a10c`
- Numbers: `50312`, `350054041`, `3001`
- Booleans: `true`, `false`
- API Keys: Full string, no wrapping quotes in .env
- Database: `postgresql://user@host:port/db`

❌ **Wrong Formats (Don't Use):**

- Quoted strings in backend .env files: `"value"` ← NO
- NEXT_PUBLIC without prefix in frontend: Use `NEXT_PUBLIC_VAR` ← Always
- Only single quotes in frontend: Sometimes OK (Next.js handles both)

---

## Quick Verification Commands

```bash
# Verify each .env file is valid key=value pairs
cd backend/indexer && cat .env | grep -v '^#' | grep '='
cd ../gateway && cat .env | grep -v '^#' | grep '='
cd ../keeper && cat .env | grep -v '^#' | grep '='
cd ../ai-agent && cat .env | grep -v '^#' | grep '='

# Check if any vars are still using placeholder format
grep -r '<.*>' backend/*/.env frontend/.env.local
```

---

## Import Note

⚠️ **The three placeholder vars still in keeper/.env and gateway/.env MUST be filled in before starting Phase 5:**

```
KEEPER_PRIVATE_KEY=<keeper wallet private key>        # backend/keeper/.env
STREAMS_PUBLISHER_PRIVATE_KEY=<keeper wallet private key>   # backend/gateway/.env
STREAMS_PUBLISHER_ADDRESS=<keeper wallet address>     # backend/gateway/.env
```

These are the ONLY placeholders left. Without them, the keeper and streams will fail to start.
