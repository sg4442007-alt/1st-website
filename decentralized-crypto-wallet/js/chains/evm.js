/**
 * EVM Chain Manager for Apex Wallet
 * Supports Ethereum Sepolia, Mainnet, Polygon, Arbitrum, BSC.
 * Uses ethers.js v6 for client-side signing and JSON-RPC broadcasting.
 */

const EVM_NETWORKS = {
  sepolia: {
    id: 'sepolia',
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    rpcUrls: [
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://sepolia.drpc.org',
      'https://1rpc.io/sepolia'
    ],
    symbol: 'ETH',
    decimals: 18,
    explorer: 'https://sepolia.etherscan.io',
    isTestnet: true,
    faucetUrl: 'https://sepoliafaucet.com'
  },
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrls: [
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
      'https://1rpc.io/eth'
    ],
    symbol: 'ETH',
    decimals: 18,
    explorer: 'https://etherscan.io',
    isTestnet: false
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon PoS',
    chainId: 137,
    rpcUrls: [
      'https://polygon-bor-rpc.publicnode.com',
      'https://polygon.drpc.org',
      'https://1rpc.io/matic'
    ],
    symbol: 'POL',
    decimals: 18,
    explorer: 'https://polygonscan.com',
    isTestnet: false
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum One',
    chainId: 42161,
    rpcUrls: [
      'https://arbitrum-one-rpc.publicnode.com',
      'https://arbitrum.drpc.org'
    ],
    symbol: 'ETH',
    decimals: 18,
    explorer: 'https://arbiscan.io',
    isTestnet: false
  },
  bsc: {
    id: 'bsc',
    name: 'BNB Smart Chain',
    chainId: 56,
    rpcUrls: [
      'https://bsc-rpc.publicnode.com',
      'https://bsc.drpc.org'
    ],
    symbol: 'BNB',
    decimals: 18,
    explorer: 'https://bscscan.com',
    isTestnet: false
  }
};

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)'
];

class EvmManager {
  constructor(networkId = 'sepolia') {
    this.network = EVM_NETWORKS[networkId] || EVM_NETWORKS.sepolia;
    this.provider = this.createProvider(this.network);
  }

  setNetwork(networkId) {
    if (!EVM_NETWORKS[networkId]) throw new Error(`Unsupported EVM network: ${networkId}`);
    this.network = EVM_NETWORKS[networkId];
    this.provider = this.createProvider(this.network);
  }

  createProvider(network) {
    // Uses fallback / primary RPC
    return new ethers.JsonRpcProvider(network.rpcUrls[0]);
  }

  // Derive account from mnemonic at index
  deriveAccount(mnemonic, accountIndex = 0) {
    const path = `m/44'/60'/0'/0/${accountIndex}`;
    const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic.trim(), "", path);
    return {
      chain: 'evm',
      index: accountIndex,
      address: hdNode.address,
      privateKey: hdNode.privateKey,
      path: path
    };
  }

  // Import single account from raw private key
  fromPrivateKey(privateKeyHex) {
    let cleanKey = privateKeyHex.trim();
    if (!cleanKey.startsWith('0x')) cleanKey = '0x' + cleanKey;
    const wallet = new ethers.Wallet(cleanKey);
    return {
      chain: 'evm',
      isImported: true,
      address: wallet.address,
      privateKey: wallet.privateKey
    };
  }

  // Fetch native balance
  async getBalance(address) {
    try {
      const balanceWei = await this.provider.getBalance(address);
      const balanceFormatted = ethers.formatEther(balanceWei);
      return {
        formatted: parseFloat(balanceFormatted).toFixed(4),
        raw: balanceWei,
        symbol: this.network.symbol
      };
    } catch (err) {
      console.warn('Primary RPC failed, attempting secondary RPC...', err);
      if (this.network.rpcUrls.length > 1) {
        const fallbackProvider = new ethers.JsonRpcProvider(this.network.rpcUrls[1]);
        const balanceWei = await fallbackProvider.getBalance(address);
        return {
          formatted: parseFloat(ethers.formatEther(balanceWei)).toFixed(4),
          raw: balanceWei,
          symbol: this.network.symbol
        };
      }
      throw err;
    }
  }

  // Estimate gas and total fee
  async estimateTransferFee(privateKey, toAddress, amount) {
    const wallet = new ethers.Wallet(privateKey, this.provider);
    const value = ethers.parseEther(amount.toString());
    const feeData = await this.provider.getFeeData();
    const gasLimit = await wallet.estimateGas({
      to: toAddress,
      value: value
    });

    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');
    const totalFeeWei = gasLimit * gasPrice;
    return {
      gasLimit: gasLimit.toString(),
      gasPriceGwei: ethers.formatUnits(gasPrice, 'gwei'),
      estimatedFeeEther: ethers.formatEther(totalFeeWei)
    };
  }

  // Sign and broadcast transaction
  async sendTransaction(privateKey, toAddress, amount) {
    if (!ethers.isAddress(toAddress)) {
      throw new Error('Invalid EVM destination address');
    }

    const wallet = new ethers.Wallet(privateKey, this.provider);
    const value = ethers.parseEther(amount.toString());

    // Nonce & Gas
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: value
    });

    return {
      hash: tx.hash,
      network: this.network.name,
      explorerUrl: `${this.network.explorer}/tx/${tx.hash}`,
      wait: () => tx.wait(1)
    };
  }

  // ERC-20 token metadata and balance
  async getTokenDetails(tokenAddress, userAddress) {
    if (!ethers.isAddress(tokenAddress)) throw new Error('Invalid token contract address.');
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);

    const [symbol, name, decimals, rawBalance] = await Promise.all([
      contract.symbol(),
      contract.name(),
      contract.decimals(),
      contract.balanceOf(userAddress)
    ]);

    const formatted = ethers.formatUnits(rawBalance, decimals);
    return {
      address: tokenAddress,
      name,
      symbol,
      decimals: Number(decimals),
      balance: parseFloat(formatted).toFixed(4),
      rawBalance: rawBalance.toString()
    };
  }

  // Send ERC-20 Token
  async sendToken(privateKey, tokenAddress, toAddress, amount, decimals = 18) {
    const wallet = new ethers.Wallet(privateKey, this.provider);
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const parsedAmount = ethers.parseUnits(amount.toString(), decimals);

    const tx = await contract.transfer(toAddress, parsedAmount);
    return {
      hash: tx.hash,
      explorerUrl: `${this.network.explorer}/tx/${tx.hash}`,
      wait: () => tx.wait(1)
    };
  }
}

window.EvmManager = EvmManager;
window.EVM_NETWORKS = EVM_NETWORKS;
