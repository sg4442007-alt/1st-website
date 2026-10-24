/**
 * Solana Chain Manager for Apex Wallet
 * Supports Solana Devnet and Mainnet-Beta using @solana/web3.js.
 * Client-side Ed25519 key derivation, balance lookup, testnet airdrops, and transfers.
 */

const SOLANA_NETWORKS = {
  'solana-devnet': {
    id: 'solana-devnet',
    name: 'Solana Devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    symbol: 'SOL',
    decimals: 9,
    explorer: 'https://explorer.solana.com/?cluster=devnet',
    isTestnet: true,
    faucetUrl: 'https://faucet.solana.com'
  },
  'solana-mainnet': {
    id: 'solana-mainnet',
    name: 'Solana Mainnet',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    symbol: 'SOL',
    decimals: 9,
    explorer: 'https://explorer.solana.com',
    isTestnet: false
  }
};

class SolanaManager {
  constructor(networkId = 'solana-devnet') {
    this.network = SOLANA_NETWORKS[networkId] || SOLANA_NETWORKS['solana-devnet'];
    this.connection = new solanaWeb3.Connection(this.network.rpcUrl, 'confirmed');
  }

  setNetwork(networkId) {
    if (!SOLANA_NETWORKS[networkId]) throw new Error(`Unsupported Solana network: ${networkId}`);
    this.network = SOLANA_NETWORKS[networkId];
    this.connection = new solanaWeb3.Connection(this.network.rpcUrl, 'confirmed');
  }

  // Derive Ed25519 Keypair from BIP-39 mnemonic
  deriveAccount(mnemonic, accountIndex = 0) {
    const seedHex = ethers.Mnemonic.fromPhrase(mnemonic.trim()).computeSeed();
    const seedBytes = ethers.getBytes(seedHex);

    // Derive deterministic 32-byte Ed25519 seed for account index
    const accountSeed = ethers.getBytes(
      ethers.keccak256(ethers.concat([seedBytes, ethers.toBeArray(accountIndex)]))
    ).slice(0, 32);

    const keypair = solanaWeb3.Keypair.fromSeed(accountSeed);
    const pubkey = keypair.publicKey.toBase58();

    // Export private key as base58 string or hex
    const secretKeyHex = ethers.hexlify(keypair.secretKey);

    return {
      chain: 'solana',
      index: accountIndex,
      address: pubkey,
      privateKey: secretKeyHex,
      keypair: keypair
    };
  }

  // Import from existing 64-byte secret key hex
  fromPrivateKey(secretKeyHex) {
    let clean = secretKeyHex.trim();
    if (clean.startsWith('0x')) clean = clean.slice(2);
    const secretBytes = ethers.getBytes('0x' + clean);
    const keypair = solanaWeb3.Keypair.fromSecretKey(secretBytes);
    return {
      chain: 'solana',
      isImported: true,
      address: keypair.publicKey.toBase58(),
      privateKey: '0x' + clean,
      keypair: keypair
    };
  }

  // Fetch SOL balance
  async getBalance(addressString) {
    try {
      const pubkey = new solanaWeb3.PublicKey(addressString);
      const lamports = await this.connection.getBalance(pubkey);
      const sol = lamports / solanaWeb3.LAMPORTS_PER_SOL;
      return {
        formatted: sol.toFixed(4),
        raw: lamports,
        symbol: this.network.symbol
      };
    } catch (err) {
      console.error('Failed to get Solana balance:', err);
      throw err;
    }
  }

  // Request free airdrop on Devnet
  async requestAirdrop(addressString, amountSol = 1) {
    if (!this.network.isTestnet) throw new Error('Airdrop is only available on Devnet.');
    const pubkey = new solanaWeb3.PublicKey(addressString);
    const signature = await this.connection.requestAirdrop(
      pubkey,
      amountSol * solanaWeb3.LAMPORTS_PER_SOL
    );
    await this.connection.confirmTransaction(signature, 'confirmed');
    return signature;
  }

  // Transfer SOL
  async sendTransaction(secretKeyHex, toAddressString, amountSol) {
    let clean = secretKeyHex.trim();
    if (clean.startsWith('0x')) clean = clean.slice(2);
    const secretBytes = ethers.getBytes('0x' + clean);
    const fromKeypair = solanaWeb3.Keypair.fromSecretKey(secretBytes);

    const toPubkey = new solanaWeb3.PublicKey(toAddressString);
    const lamports = Math.floor(amountSol * solanaWeb3.LAMPORTS_PER_SOL);

    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPubkey,
        lamports: lamports
      })
    );

    const signature = await solanaWeb3.sendAndConfirmTransaction(
      this.connection,
      transaction,
      [fromKeypair]
    );

    const explorerUrl = this.network.isTestnet
      ? `https://explorer.solana.com/tx/${signature}?cluster=devnet`
      : `https://explorer.solana.com/tx/${signature}`;

    return {
      hash: signature,
      network: this.network.name,
      explorerUrl: explorerUrl
    };
  }
}

window.SolanaManager = SolanaManager;
window.SOLANA_NETWORKS = SOLANA_NETWORKS;
