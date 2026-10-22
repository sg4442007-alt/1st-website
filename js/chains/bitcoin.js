/**
 * Bitcoin Chain Manager for Apex Wallet
 * Supports Bitcoin Testnet & Mainnet with Native SegWit (Bech32) and Legacy addresses.
 * Integrates with Blockstream Esplora API for zero-server custody balances, UTXOs, and tx history.
 */

const BITCOIN_NETWORKS = {
  'bitcoin-testnet': {
    id: 'bitcoin-testnet',
    name: 'Bitcoin Testnet',
    apiBase: 'https://blockstream.info/testnet/api',
    hrp: 'tb',
    networkByte: 0x6f,
    symbol: 'tBTC',
    decimals: 8,
    explorer: 'https://blockstream.info/testnet',
    isTestnet: true,
    faucetUrl: 'https://coinfaucet.eu/en/btc-testnet/'
  },
  'bitcoin-mainnet': {
    id: 'bitcoin-mainnet',
    name: 'Bitcoin Mainnet',
    apiBase: 'https://blockstream.info/api',
    hrp: 'bc',
    networkByte: 0x00,
    symbol: 'BTC',
    decimals: 8,
    explorer: 'https://blockstream.info',
    isTestnet: false
  }
};

// Bech32 implementation for Native SegWit (BIP-173)
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (let p = 0; p < values.length; ++p) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ values[p];
    for (let i = 0; i < 5; ++i) {
      if ((top >> i) & 1) {
        chk ^= GEN[i];
      }
    }
  }
  return chk;
}

function hrpExpand(hrp) {
  const ret = [];
  for (let p = 0; p < hrp.length; ++p) {
    ret.push(hrp.charCodeAt(p) >> 5);
  }
  ret.push(0);
  for (let p = 0; p < hrp.length; ++p) {
    ret.push(hrp.charCodeAt(p) & 31);
  }
  return ret;
}

function createBech32Checksum(hrp, data) {
  const values = hrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
  const polymod = bech32Polymod(values) ^ 1;
  const ret = [];
  for (let p = 0; p < 6; ++p) {
    ret.push((polymod >> 5 * (5 - p)) & 31);
  }
  return ret;
}

function convertBits(data, frombits, tobits, pad = true) {
  let acc = 0;
  let bits = 0;
  const ret = [];
  const maxv = (1 << tobits) - 1;
  const max_acc = (1 << (frombits + tobits - 1)) - 1;
  for (let p = 0; p < data.length; ++p) {
    const value = data[p];
    acc = ((acc << frombits) | value) & max_acc;
    bits += frombits;
    while (bits >= tobits) {
      bits -= tobits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits) {
      ret.push((acc << (tobits - bits)) & maxv);
    }
  }
  return ret;
}

function encodeBech32(hrp, witver, witprog) {
  const data = [witver].concat(convertBits(witprog, 8, 5));
  const checksum = createBech32Checksum(hrp, data);
  const combined = data.concat(checksum);
  let ret = hrp + '1';
  for (let p = 0; p < combined.length; ++p) {
    ret += BECH32_CHARSET.charAt(combined[p]);
  }
  return ret;
}

// Base58Check implementation for Legacy addresses
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(buffer) {
  const digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += buffer[i];
    let carry = 0;
    for (let j = 0; j < digits.length; ++j) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) digits.push(0);
  return digits.reverse().map(digit => B58_ALPHABET[digit]).join('');
}

class BitcoinManager {
  constructor(networkId = 'bitcoin-testnet') {
    this.network = BITCOIN_NETWORKS[networkId] || BITCOIN_NETWORKS['bitcoin-testnet'];
  }

  setNetwork(networkId) {
    if (!BITCOIN_NETWORKS[networkId]) throw new Error(`Unsupported Bitcoin network: ${networkId}`);
    this.network = BITCOIN_NETWORKS[networkId];
  }

  // Derive Bitcoin Native SegWit address and keys from BIP-39 mnemonic
  deriveAccount(mnemonic, accountIndex = 0) {
    // BIP-84 path for Native Segwit (or standard derivation)
    const path = `m/84'/0'/0'/0/${accountIndex}`;
    const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic.trim(), "", path);

    // Compressed 33-byte public key
    const pubKeyBytes = ethers.getBytes(hdNode.publicKey);

    // Hash160 = RIPEMD160(SHA256(pubKey))
    const sha = ethers.sha256(pubKeyBytes);
    const hash160Hex = ethers.ripemd160(sha);
    const hash160Bytes = ethers.getBytes(hash160Hex);

    // Native Segwit (P2WPKH, Witness version 0)
    const segwitAddress = encodeBech32(this.network.hrp, 0, Array.from(hash160Bytes));

    // Legacy P2PKH address with Base58Check
    const versionedPayload = new Uint8Array(21);
    versionedPayload[0] = this.network.networkByte;
    versionedPayload.set(hash160Bytes, 1);
    const dsha = ethers.getBytes(ethers.sha256(ethers.sha256(versionedPayload)));
    const checksum = dsha.slice(0, 4);
    const fullPayload = new Uint8Array(25);
    fullPayload.set(versionedPayload, 0);
    fullPayload.set(checksum, 21);
    const legacyAddress = base58Encode(fullPayload);

    return {
      chain: 'bitcoin',
      index: accountIndex,
      address: segwitAddress,
      legacyAddress: legacyAddress,
      privateKey: hdNode.privateKey,
      path: path
    };
  }

  // Fetch balance from Blockstream Esplora API
  async getBalance(address) {
    try {
      const res = await fetch(`${this.network.apiBase}/address/${address}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();

      const chainFunded = data.chain_stats.funded_txo_sum || 0;
      const chainSpent = data.chain_stats.spent_txo_sum || 0;
      const mempoolFunded = data.mempool_stats.funded_txo_sum || 0;
      const mempoolSpent = data.mempool_stats.spent_txo_sum || 0;

      const satoshis = (chainFunded - chainSpent) + (mempoolFunded - mempoolSpent);
      const btc = satoshis / 100000000;

      return {
        formatted: btc.toFixed(8),
        satoshis: satoshis,
        txCount: data.chain_stats.tx_count + data.mempool_stats.tx_count,
        symbol: this.network.symbol
      };
    } catch (err) {
      console.error('Failed to get Bitcoin balance:', err);
      return {
        formatted: '0.00000000',
        satoshis: 0,
        txCount: 0,
        symbol: this.network.symbol
      };
    }
  }

  // Fetch recent transactions for address
  async getTransactions(address) {
    try {
      const res = await fetch(`${this.network.apiBase}/address/${address}/txs`);
      if (!res.ok) return [];
      const txs = await res.json();
      return txs.map(tx => ({
        txid: tx.txid,
        confirmed: tx.status.confirmed,
        blockHeight: tx.status.block_height,
        time: tx.status.block_time ? new Date(tx.status.block_time * 1000).toLocaleString() : 'Unconfirmed',
        feeSat: tx.fee,
        explorerUrl: `${this.network.explorer}/tx/${tx.txid}`
      }));
    } catch (err) {
      console.warn('Failed to fetch Bitcoin transactions:', err);
      return [];
    }
  }

  // Broadcast raw hex transaction to Bitcoin network
  async broadcastTx(rawTxHex) {
    const res = await fetch(`${this.network.apiBase}/tx`, {
      method: 'POST',
      body: rawTxHex
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Broadcast failed: ${errText}`);
    }
    const txid = await res.text();
    return {
      hash: txid,
      explorerUrl: `${this.network.explorer}/tx/${txid}`
    };
  }
}

window.BitcoinManager = BitcoinManager;
window.BITCOIN_NETWORKS = BITCOIN_NETWORKS;
