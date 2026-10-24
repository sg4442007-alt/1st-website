# Apex Decentralized Multi-Chain Crypto Wallet 🛡️

A sleek, self-custodial multi-chain cryptocurrency wallet web application. Built strictly adhering to decentralized, non-custodial principles: **your private keys and recovery seed phrases are generated and encrypted locally in your browser memory and never leave your machine**.

---

## 🚀 Key Features

### 1. True Non-Custodial & Decentralized Architecture
- **Zero Server-Side Custody**: No database or central backend holds your credentials.
- **Client-Side AES-256-GCM Vault**: Wallet keys and metadata are encrypted locally in `localStorage` using a master password derived via PBKDF2 (100,000 iterations, SHA-256, unique 16-byte salt and 12-byte IV).
- **Session Auto-Lock**: Vault locks in RAM on demand, requiring master password re-entry.
- **Encrypted Keystore Backup**: Export and restore your wallet using encrypted `.json` backup files.

### 2. Multi-Chain Ecosystem Support
- **Ethereum & EVM Chains**:
  - Networks: **Sepolia Testnet** (default), **Ethereum Mainnet**, **Polygon PoS**, **Arbitrum One**, **BNB Smart Chain**.
  - Derivation Path: `m/44'/60'/0'/0/i` (Standard BIP-44).
  - Balance lookups, real-time gas estimation, local signing, and JSON-RPC broadcasting.
  - ERC-20 token tracking & custom token imports.
- **Solana**:
  - Networks: **Solana Devnet**, **Solana Mainnet-Beta**.
  - Derivation: Ed25519 deterministic keypair from BIP-39 seed.
  - Native SOL balance lookups and 1-click Devnet airdrop faucet integration.
  - Local transaction creation, signing, and confirmation via `@solana/web3.js`.
- **Bitcoin**:
  - Networks: **Bitcoin Testnet**, **Bitcoin Mainnet**.
  - Address Formats: **Native SegWit (Bech32 `tb1q...` / `bc1q...`)** and **Legacy (Base58Check `m...` / `1...`)**.
  - Real-time balance and UTXO aggregation via Blockstream Esplora API.

### 3. Full Wallet Functionality
- **BIP-39 Mnemonic Seed Generation**: 12-word cryptographic seed phrase generated with browser CSPRNG (`crypto.getRandomValues`).
- **Seed Verification & Backup**: Clean visual word cards and 1-click copy.
- **HD Multi-Account Management**: Add derived accounts (`Account 1`, `Account 2`, etc.) all under the same master recovery phrase.
- **Send & Receive**:
  - Send modal with address validation, available balance, "Max" calculation, and live signing animation.
  - Receive modal with crisp interactive QR code generator (`qrcode.js`) and 1-click address copy.
- **Built-in Faucet Integration**: Direct 1-click links to free faucets for Sepolia ETH, Solana Devnet, and Bitcoin Testnet for risk-free testing.
- **Activity Log**: Local transaction history with clickable block explorer links (Etherscan, Solscan, Mempool).

---

## 📁 Project Structure

```
decentralized-crypto-wallet/
├── index.html          # Main Web3 responsive interface (Tailwind CSS, Lucide icons)
├── style.css           # Glassmorphism panels, glow effects, animations, dark mode
├── server.py           # Zero-dependency local Python HTTP launcher
├── README.md           # Documentation and guide
└── js/
    ├── app.js          # UI controller, routing, event listeners, state management
    ├── crypto-core.js  # Non-custodial AES-256-GCM & PBKDF2 Web Crypto vault
    └── chains/
        ├── evm.js      # Ethers.js v6 EVM provider, gas estimation, send & ERC-20
        ├── solana.js   # Solana Web3.js Ed25519 key derivation, RPC & airdrops
        └── bitcoin.js  # Bitcoin Bech32 SegWit derivation & Blockstream Esplora API
```

---

## ⚡ Quick Start

### Running the Wallet

Open your terminal in the project directory and run:

```bash
python server.py
```

The launcher will start a local server at `http://localhost:5173` and automatically open your default browser.

> Alternatively, you can open `index.html` directly in modern web browsers (Chrome, Brave, Edge, Firefox, Opera).

---

## 🧪 Testing with Free Testnet Faucets

Apex Wallet defaults to **Ethereum Sepolia** and supports **Solana Devnet** and **Bitcoin Testnet**. You can test transactions without spending real money:

1. **Sepolia ETH**:
   - Click the **Faucet** button in the dashboard to open the Sepolia faucet (`https://sepoliafaucet.com`).
   - Paste your `0x...` address to receive test ETH.
2. **Solana Devnet SOL**:
   - Switch network to **Solana Devnet**.
   - Click the **Faucet** button for an instant 1-click 1 SOL airdrop directly into your wallet.
3. **Bitcoin Testnet**:
   - Switch network to **Bitcoin Testnet**.
   - Copy your `tb1q...` SegWit address and use any testnet faucet (`https://coinfaucet.eu/en/btc-testnet/`).

---

## 🔒 Security Best Practices

1. **Recovery Phrase is King**: Anyone with your 12-word recovery phrase can access all your funds across every chain. Write it down offline and never share it.
2. **Master Password**: Your master password protects your local encrypted vault. If forgotten, you will need to re-import your wallet using your 12-word seed phrase.
3. **Production Use**: For high-value mainnet funds, hardware wallets (e.g. Ledger, Trezor) are recommended.
