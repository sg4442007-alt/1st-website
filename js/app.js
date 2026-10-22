/**
 * Apex Decentralized Crypto Wallet - Application Controller
 * Handles UI state transitions, wallet creation/import, multi-chain operations, and security.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Lucide icons
  lucide.createIcons();

  // Instantiate Core Services
  const vault = new CryptoVault();
  const evmManager = new EvmManager('sepolia');
  const solanaManager = new SolanaManager('solana-devnet');
  const bitcoinManager = new BitcoinManager('bitcoin-testnet');

  // Application State
  let currentChainType = 'evm'; // 'evm' | 'solana' | 'bitcoin'
  let currentNetworkId = 'sepolia';
  let activeAccountIndex = 0;
  let activeMnemonic = null;
  let activeAccounts = []; // Array of derived account metadata
  let activeAccountData = null; // Active keys and address for selected chain
  let pendingSecurityAction = null; // For reveal modal ('phrase' | 'key')
  let tempGeneratedMnemonic = null;
  let tempMasterPassword = null;

  // DOM Elements
  const el = {
    headerControls: document.getElementById('header-controls'),
    networkSelect: document.getElementById('network-select'),
    currentAccountName: document.getElementById('current-account-name'),
    accountDropdownBtn: document.getElementById('account-dropdown-btn'),
    accountDropdownMenu: document.getElementById('account-dropdown-menu'),
    accountsList: document.getElementById('accounts-list'),
    btnAddAccount: document.getElementById('btn-add-account'),
    btnLockWallet: document.getElementById('btn-lock-wallet'),

    // Views
    viewOnboarding: document.getElementById('view-onboarding'),
    viewCreatePassword: document.getElementById('view-create-password'),
    viewCreateSeed: document.getElementById('view-create-seed'),
    viewImportWallet: document.getElementById('view-import-wallet'),
    viewLocked: document.getElementById('view-locked'),
    viewDashboard: document.getElementById('view-dashboard'),

    // Onboarding buttons
    btnStartCreate: document.getElementById('btn-start-create'),
    btnStartImport: document.getElementById('btn-start-import'),
    btnBackToWelcome1: document.getElementById('btn-back-to-welcome-1'),
    btnBackToWelcome2: document.getElementById('btn-back-to-welcome-2'),
    formCreatePassword: document.getElementById('form-create-password'),
    inputNewPassword: document.getElementById('input-new-password'),
    inputConfirmPassword: document.getElementById('input-confirm-password'),
    seedWordsContainer: document.getElementById('seed-words-container'),
    btnCopySeed: document.getElementById('btn-copy-seed'),
    btnConfirmSeedSaved: document.getElementById('btn-confirm-seed-saved'),

    // Import form
    formImportWallet: document.getElementById('form-import-wallet'),
    inputImportSecret: document.getElementById('input-import-secret'),
    inputImportPassword: document.getElementById('input-import-password'),
    btnImportKeystoreJson: document.getElementById('btn-import-keystore-json'),
    fileKeystoreInput: document.getElementById('file-keystore-input'),

    // Unlock form
    formUnlock: document.getElementById('form-unlock'),
    inputUnlockPassword: document.getElementById('input-unlock-password'),
    btnWipeWalletPrompt: document.getElementById('btn-wipe-wallet-prompt'),

    // Dashboard elements
    badgeNetworkName: document.getElementById('badge-network-name'),
    badgeNetworkType: document.getElementById('badge-network-type'),
    linkExplorerAddress: document.getElementById('link-explorer-address'),
    displayAddressShort: document.getElementById('display-address-short'),
    btnCopyAddress: document.getElementById('btn-copy-address'),
    btnShowQr: document.getElementById('btn-show-qr'),
    displayBalance: document.getElementById('display-balance'),
    displaySymbol: document.getElementById('display-symbol'),
    displayUsdEstimate: document.getElementById('display-usd-estimate'),

    // Action buttons
    btnActionSend: document.getElementById('btn-action-send'),
    btnActionReceive: document.getElementById('btn-action-receive'),
    btnActionFaucet: document.getElementById('btn-action-faucet'),
    btnActionRefresh: document.getElementById('btn-action-refresh'),

    // Tabs
    tabBtnTokens: document.getElementById('tab-btn-tokens'),
    tabBtnActivity: document.getElementById('tab-btn-activity'),
    tabBtnSettings: document.getElementById('tab-btn-settings'),
    tabContentTokens: document.getElementById('tab-content-tokens'),
    tabContentActivity: document.getElementById('tab-content-activity'),
    tabContentSettings: document.getElementById('tab-content-settings'),
    tokenList: document.getElementById('token-list'),
    activityList: document.getElementById('activity-list'),
    btnClearHistory: document.getElementById('btn-clear-history'),

    // Modals
    modalSend: document.getElementById('modal-send'),
    formSendTx: document.getElementById('form-send-tx'),
    inputSendTo: document.getElementById('input-send-to'),
    inputSendAmount: document.getElementById('input-send-amount'),
    sendAvailableBalance: document.getElementById('send-available-balance'),
    sendSymbol: document.getElementById('send-symbol'),
    btnSendMax: document.getElementById('btn-send-max'),
    sendFeeEstimate: document.getElementById('send-fee-estimate'),
    btnConfirmSend: document.getElementById('btn-confirm-send'),

    modalReceive: document.getElementById('modal-receive'),
    qrcodeCanvas: document.getElementById('qrcode-canvas'),
    receiveAddressText: document.getElementById('receive-address-text'),
    receiveNetworkBadge: document.getElementById('receive-network-badge'),
    btnCopyReceiveAddress: document.getElementById('btn-copy-receive-address'),

    modalAddAccount: document.getElementById('modal-add-account'),
    formAddAccount: document.getElementById('form-add-account'),
    inputAccountLabel: document.getElementById('input-account-label'),

    modalImportToken: document.getElementById('modal-import-token'),
    btnImportTokenModal: document.getElementById('btn-import-token-modal'),
    formImportToken: document.getElementById('form-import-token'),
    inputTokenContract: document.getElementById('input-token-contract'),
    tokenPreviewDetails: document.getElementById('token-preview-details'),
    tokenPreviewSymbol: document.getElementById('token-preview-symbol'),
    tokenPreviewDecimals: document.getElementById('token-preview-decimals'),

    modalSecurityReveal: document.getElementById('modal-security-reveal'),
    securityRevealTitle: document.getElementById('security-reveal-title'),
    securityPasswordPrompt: document.getElementById('security-password-prompt'),
    formSecurityVerify: document.getElementById('form-security-verify'),
    inputSecurityPassword: document.getElementById('input-security-password'),
    securityDisplayArea: document.getElementById('security-display-area'),
    securitySecretContent: document.getElementById('security-secret-content'),
    btnCopyRevealedSecret: document.getElementById('btn-copy-revealed-secret'),

    btnSettingsRevealPhrase: document.getElementById('btn-settings-reveal-phrase'),
    btnSettingsRevealKey: document.getElementById('btn-settings-reveal-key'),
    btnDownloadKeystore: document.getElementById('btn-download-keystore'),
    btnResetWallet: document.getElementById('btn-reset-wallet'),
    toastContainer: document.getElementById('toast-container')
  };

  // Toast Notification helper
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colorClasses = {
      info: 'bg-indigo-600 text-white border-indigo-500',
      success: 'bg-emerald-600 text-white border-emerald-500',
      error: 'bg-rose-600 text-white border-rose-500'
    }[type] || 'bg-slate-800 text-white border-slate-700';

    toast.className = `p-3.5 rounded-xl border shadow-xl text-xs font-medium flex items-center gap-2 pointer-events-auto transition transform translate-y-2 opacity-0 duration-200 ${colorClasses}`;
    toast.innerHTML = `<span>${message}</span>`;
    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  // Switch Active View
  function showView(viewId) {
    const views = [
      el.viewOnboarding,
      el.viewCreatePassword,
      el.viewCreateSeed,
      el.viewImportWallet,
      el.viewLocked,
      el.viewDashboard
    ];
    views.forEach(v => v.classList.add('hidden'));

    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');

    if (viewId === 'view-dashboard') {
      el.headerControls.classList.remove('hidden');
    } else {
      el.headerControls.classList.add('hidden');
    }
    lucide.createIcons();
  }

  // Check initial wallet presence
  function initApp() {
    if (vault.hasVault()) {
      showView('view-locked');
    } else {
      showView('view-onboarding');
    }
  }

  // Multi-Chain State helper
  function updateChainType(networkId) {
    currentNetworkId = networkId;
    if (networkId.startsWith('solana-')) {
      currentChainType = 'solana';
      solanaManager.setNetwork(networkId);
    } else if (networkId.startsWith('bitcoin-')) {
      currentChainType = 'bitcoin';
      bitcoinManager.setNetwork(networkId);
    } else {
      currentChainType = 'evm';
      evmManager.setNetwork(networkId);
    }
    syncActiveAccountData();
  }

  // Sync Active Keys for current account & chain
  function syncActiveAccountData() {
    if (!activeMnemonic) return;

    if (currentChainType === 'evm') {
      activeAccountData = evmManager.deriveAccount(activeMnemonic, activeAccountIndex);
      el.badgeNetworkName.textContent = evmManager.network.name;
      el.badgeNetworkType.textContent = evmManager.network.isTestnet ? 'Testnet' : 'Mainnet';
      el.linkExplorerAddress.href = `${evmManager.network.explorer}/address/${activeAccountData.address}`;
      el.displaySymbol.textContent = evmManager.network.symbol;
      el.sendSymbol.textContent = evmManager.network.symbol;
    } else if (currentChainType === 'solana') {
      activeAccountData = solanaManager.deriveAccount(activeMnemonic, activeAccountIndex);
      el.badgeNetworkName.textContent = solanaManager.network.name;
      el.badgeNetworkType.textContent = solanaManager.network.isTestnet ? 'Devnet' : 'Mainnet';
      el.linkExplorerAddress.href = `${solanaManager.network.explorer}/address/${activeAccountData.address}`;
      el.displaySymbol.textContent = solanaManager.network.symbol;
      el.sendSymbol.textContent = solanaManager.network.symbol;
    } else if (currentChainType === 'bitcoin') {
      activeAccountData = bitcoinManager.deriveAccount(activeMnemonic, activeAccountIndex);
      el.badgeNetworkName.textContent = bitcoinManager.network.name;
      el.badgeNetworkType.textContent = bitcoinManager.network.isTestnet ? 'Testnet' : 'Mainnet';
      el.linkExplorerAddress.href = `${bitcoinManager.network.explorer}/address/${activeAccountData.address}`;
      el.displaySymbol.textContent = bitcoinManager.network.symbol;
      el.sendSymbol.textContent = bitcoinManager.network.symbol;
    }

    // Update address in UI
    const addr = activeAccountData.address;
    el.displayAddressShort.textContent = addr.length > 20 ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : addr;
    el.displayAddressShort.title = addr;

    refreshBalances();
    renderAccountList();
    renderActivity();
    renderTokens();
  }

  // Refresh Balance from RPC / API
  async function refreshBalances() {
    if (!activeAccountData) return;
    el.displayBalance.textContent = '...';

    try {
      if (currentChainType === 'evm') {
        const bal = await evmManager.getBalance(activeAccountData.address);
        el.displayBalance.textContent = bal.formatted;
        el.sendAvailableBalance.textContent = bal.formatted;
        // Mock estimate USD
        const ethPrice = evmManager.network.isTestnet ? 0 : 2650;
        const usd = (parseFloat(bal.formatted) * ethPrice).toFixed(2);
        el.displayUsdEstimate.textContent = `≈ $${usd} USD`;
      } else if (currentChainType === 'solana') {
        const bal = await solanaManager.getBalance(activeAccountData.address);
        el.displayBalance.textContent = bal.formatted;
        el.sendAvailableBalance.textContent = bal.formatted;
        const solPrice = solanaManager.network.isTestnet ? 0 : 155;
        const usd = (parseFloat(bal.formatted) * solPrice).toFixed(2);
        el.displayUsdEstimate.textContent = `≈ $${usd} USD`;
      } else if (currentChainType === 'bitcoin') {
        const bal = await bitcoinManager.getBalance(activeAccountData.address);
        el.displayBalance.textContent = bal.formatted;
        el.sendAvailableBalance.textContent = bal.formatted;
        const btcPrice = bitcoinManager.network.isTestnet ? 0 : 67000;
        const usd = (parseFloat(bal.formatted) * btcPrice).toFixed(2);
        el.displayUsdEstimate.textContent = `≈ $${usd} USD`;
      }
    } catch (err) {
      el.displayBalance.textContent = '0.0000';
      console.error('Balance query error:', err);
    }
  }

  // Render Derived Accounts Dropdown
  function renderAccountList() {
    el.accountsList.innerHTML = '';
    const accounts = vault.sessionVault?.accounts || [{ index: 0, name: 'Account 1' }];

    accounts.forEach(acc => {
      const btn = document.createElement('button');
      const isActive = acc.index === activeAccountIndex;
      btn.className = `w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between transition ${
        isActive ? 'bg-indigo-600/20 text-indigo-300 font-semibold' : 'text-slate-300 hover:bg-slate-800'
      }`;
      btn.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-600'}"></div>
          <span>${acc.name}</span>
        </div>
        <span class="text-[10px] text-slate-500 font-mono">#${acc.index}</span>
      `;
      btn.addEventListener('click', () => {
        activeAccountIndex = acc.index;
        el.currentAccountName.textContent = acc.name;
        el.accountDropdownMenu.classList.add('hidden');
        syncActiveAccountData();
      });
      el.accountsList.appendChild(btn);
    });

    const activeAccObj = accounts.find(a => a.index === activeAccountIndex);
    if (activeAccObj) {
      el.currentAccountName.textContent = activeAccObj.name;
    }
  }

  // Render Tokens Tab
  function renderTokens() {
    el.tokenList.innerHTML = '';

    // Primary native coin item
    const primaryToken = document.createElement('div');
    primaryToken.className = 'glass-panel rounded-xl p-3.5 flex items-center justify-between glass-panel-hover';
    primaryToken.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
          ${el.displaySymbol.textContent}
        </div>
        <div>
          <div class="text-sm font-semibold text-white">${el.badgeNetworkName.textContent} Native</div>
          <div class="text-xs text-slate-400">Gas & Utility Asset</div>
        </div>
      </div>
      <div class="text-right">
        <div class="text-sm font-bold text-white">${el.displayBalance.textContent} ${el.displaySymbol.textContent}</div>
        <div class="text-xs text-slate-500">${el.displayUsdEstimate.textContent}</div>
      </div>
    `;
    el.tokenList.appendChild(primaryToken);

    // Custom Tokens (if EVM)
    if (currentChainType === 'evm' && vault.sessionVault?.customTokens) {
      const filtered = vault.sessionVault.customTokens.filter(t => t.chainId === evmManager.network.chainId);
      filtered.forEach(token => {
        const item = document.createElement('div');
        item.className = 'glass-panel rounded-xl p-3.5 flex items-center justify-between glass-panel-hover';
        item.innerHTML = `
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs">
              ${token.symbol}
            </div>
            <div>
              <div class="text-sm font-semibold text-white">${token.name}</div>
              <div class="text-xs text-slate-400 font-mono">${token.address.slice(0, 6)}...${token.address.slice(-4)}</div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm font-bold text-white">0.00 ${token.symbol}</div>
          </div>
        `;
        el.tokenList.appendChild(item);
      });
    }
  }

  // Render Activity Log Tab
  function renderActivity() {
    el.activityList.innerHTML = '';
    const history = vault.sessionVault?.txHistory || [];
    const filtered = history.filter(tx => tx.networkId === currentNetworkId);

    if (filtered.length === 0) {
      el.activityList.innerHTML = `
        <div class="p-6 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
          No transactions recorded on this network yet.
        </div>
      `;
      return;
    }

    filtered.forEach(tx => {
      const item = document.createElement('div');
      item.className = 'glass-panel rounded-xl p-3 flex items-center justify-between text-xs';
      item.innerHTML = `
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
          </div>
          <div>
            <div class="font-medium text-white flex items-center gap-1.5">
              <span>Sent ${tx.amount} ${tx.symbol}</span>
              <span class="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Success</span>
            </div>
            <div class="text-[11px] text-slate-500">${tx.time}</div>
          </div>
        </div>
        <a href="${tx.explorerUrl}" target="_blank" class="text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1">
          <span>${tx.hash.slice(0, 6)}...${tx.hash.slice(-4)}</span>
          <i data-lucide="external-link" class="w-3 h-3"></i>
        </a>
      `;
      el.activityList.appendChild(item);
    });
    lucide.createIcons();
  }

  // ==================== EVENT HANDLERS ====================

  // Onboarding Create Flow
  el.btnStartCreate.addEventListener('click', () => {
    showView('view-create-password');
  });

  el.btnBackToWelcome1.addEventListener('click', () => {
    showView('view-onboarding');
  });

  el.btnBackToWelcome2.addEventListener('click', () => {
    showView('view-onboarding');
  });

  el.formCreatePassword.addEventListener('submit', (e) => {
    e.preventDefault();
    const p1 = el.inputNewPassword.value;
    const p2 = el.inputConfirmPassword.value;
    if (p1 !== p2) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    tempMasterPassword = p1;

    // Generate fresh BIP-39 mnemonic phrase using ethers CSPRNG
    const newWallet = ethers.Wallet.createRandom();
    tempGeneratedMnemonic = newWallet.mnemonic.phrase;

    // Populate seed words grid
    const words = tempGeneratedMnemonic.split(' ');
    el.seedWordsContainer.innerHTML = '';
    words.forEach((word, idx) => {
      const pill = document.createElement('div');
      pill.className = 'seed-word-pill rounded-lg p-2 flex items-center gap-2 text-xs font-mono';
      pill.innerHTML = `
        <span class="text-slate-500 w-4 select-none">${idx + 1}.</span>
        <span class="text-white font-semibold">${word}</span>
      `;
      el.seedWordsContainer.appendChild(pill);
    });

    showView('view-create-seed');
  });

  el.btnCopySeed.addEventListener('click', () => {
    navigator.clipboard.writeText(tempGeneratedMnemonic);
    showToast('Secret phrase copied to clipboard!', 'success');
  });

  el.btnConfirmSeedSaved.addEventListener('click', async () => {
    const initialVault = {
      mnemonic: tempGeneratedMnemonic,
      accounts: [{ index: 0, name: 'Account 1' }],
      customTokens: [],
      txHistory: []
    };

    try {
      await vault.encryptVault(initialVault, tempMasterPassword);
      activeMnemonic = tempGeneratedMnemonic;
      tempGeneratedMnemonic = null;
      tempMasterPassword = null;
      showToast('Wallet successfully created and encrypted!', 'success');
      showView('view-dashboard');
      updateChainType('sepolia');
    } catch (err) {
      showToast('Error encrypting wallet: ' + err.message, 'error');
    }
  });

  // Import Flow
  el.btnStartImport.addEventListener('click', () => {
    showView('view-import-wallet');
  });

  el.formImportWallet.addEventListener('submit', async (e) => {
    e.preventDefault();
    const secret = el.inputImportSecret.value.trim();
    const password = el.inputImportPassword.value;

    let mnemonic = null;
    let initialAccounts = [{ index: 0, name: 'Account 1' }];

    // Validate 12/24 word mnemonic or private key
    const wordCount = secret.split(/\s+/).length;
    if (wordCount === 12 || wordCount === 24) {
      try {
        ethers.Mnemonic.fromPhrase(secret);
        mnemonic = secret;
      } catch (err) {
        showToast('Invalid recovery phrase checksum.', 'error');
        return;
      }
    } else {
      showToast('Please provide a valid 12-word recovery phrase.', 'error');
      return;
    }

    const initialVault = {
      mnemonic: mnemonic,
      accounts: initialAccounts,
      customTokens: [],
      txHistory: []
    };

    try {
      await vault.encryptVault(initialVault, password);
      activeMnemonic = mnemonic;
      showToast('Wallet successfully imported!', 'success');
      showView('view-dashboard');
      updateChainType('sepolia');
    } catch (err) {
      showToast('Import error: ' + err.message, 'error');
    }
  });

  // Restore via JSON Keystore File
  el.btnImportKeystoreJson.addEventListener('click', () => {
    el.fileKeystoreInput.click();
  });

  el.fileKeystoreInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        vault.importKeystore(event.target.result);
        showToast('Keystore loaded. Please unlock with your password.', 'info');
        showView('view-locked');
      } catch (err) {
        showToast('Invalid keystore file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  });

  // Unlock Flow
  el.formUnlock.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = el.inputUnlockPassword.value;
    try {
      const data = await vault.unlock(pass);
      activeMnemonic = data.mnemonic;
      el.inputUnlockPassword.value = '';
      showToast('Wallet unlocked!', 'success');
      showView('view-dashboard');
      updateChainType(currentNetworkId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Lock Wallet
  el.btnLockWallet.addEventListener('click', () => {
    vault.lock();
    activeMnemonic = null;
    activeAccountData = null;
    showToast('Wallet locked.', 'info');
    showView('view-locked');
  });

  // Wipe / Reset Prompt
  el.btnWipeWalletPrompt.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset your wallet? All local data will be deleted. Ensure you have your recovery phrase backed up.')) {
      vault.wipe();
      activeMnemonic = null;
      showToast('Wallet data wiped.', 'info');
      showView('view-onboarding');
    }
  });

  // Network Switcher
  el.networkSelect.addEventListener('change', (e) => {
    updateChainType(e.target.value);
  });

  // Account Dropdown Toggle
  el.accountDropdownBtn.addEventListener('click', () => {
    el.accountDropdownMenu.classList.toggle('hidden');
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!el.accountDropdownBtn.contains(e.target) && !el.accountDropdownMenu.contains(e.target)) {
      el.accountDropdownMenu.classList.add('hidden');
    }
  });

  // Add Derived Account
  el.btnAddAccount.addEventListener('click', () => {
    el.accountDropdownMenu.classList.add('hidden');
    el.modalAddAccount.classList.remove('hidden');
  });

  el.formAddAccount.addEventListener('submit', async (e) => {
    e.preventDefault();
    const label = el.inputAccountLabel.value.trim();
    if (!label) return;

    const nextIndex = vault.sessionVault.accounts.length;
    vault.sessionVault.accounts.push({
      index: nextIndex,
      name: label
    });

    activeAccountIndex = nextIndex;
    el.modalAddAccount.classList.add('hidden');
    el.inputAccountLabel.value = '';

    syncActiveAccountData();
    showToast(`Account "${label}" added!`, 'success');
  });

  // Copy Active Address
  el.btnCopyAddress.addEventListener('click', () => {
    if (!activeAccountData) return;
    navigator.clipboard.writeText(activeAccountData.address);
    showToast('Address copied to clipboard!', 'success');
  });

  // Show Receive QR Code
  el.btnShowQr.addEventListener('click', openReceiveModal);
  el.btnActionReceive.addEventListener('click', openReceiveModal);

  function openReceiveModal() {
    if (!activeAccountData) return;
    el.receiveAddressText.textContent = activeAccountData.address;
    el.receiveNetworkBadge.textContent = el.displaySymbol.textContent;

    // Generate QR Code
    el.qrcodeCanvas.innerHTML = '';
    new QRCode(el.qrcodeCanvas, {
      text: activeAccountData.address,
      width: 180,
      height: 180,
      colorDark: '#090d16',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });

    el.modalReceive.classList.remove('hidden');
    lucide.createIcons();
  }

  el.btnCopyReceiveAddress.addEventListener('click', () => {
    navigator.clipboard.writeText(activeAccountData.address);
    showToast('Receiving address copied!', 'success');
  });

  // Faucet Link / Action
  el.btnActionFaucet.addEventListener('click', async () => {
    if (!activeAccountData) return;

    if (currentChainType === 'solana' && solanaManager.network.isTestnet) {
      showToast('Requesting 1 SOL airdrop on Solana Devnet...', 'info');
      try {
        await solanaManager.requestAirdrop(activeAccountData.address, 1);
        showToast('1 SOL Airdrop confirmed on Devnet!', 'success');
        refreshBalances();
      } catch (err) {
        showToast('Airdrop rate limit reached. Opening web faucet...', 'info');
        window.open(solanaManager.network.faucetUrl, '_blank');
      }
    } else if (currentChainType === 'evm' && evmManager.network.isTestnet) {
      showToast('Opening Sepolia faucet in new tab...', 'info');
      window.open(evmManager.network.faucetUrl, '_blank');
    } else if (currentChainType === 'bitcoin' && bitcoinManager.network.isTestnet) {
      showToast('Opening Bitcoin Testnet faucet...', 'info');
      window.open(bitcoinManager.network.faucetUrl, '_blank');
    } else {
      showToast('Faucets are only available on Testnets.', 'info');
    }
  });

  // Refresh Button
  el.btnActionRefresh.addEventListener('click', () => {
    refreshBalances();
    showToast('Balances refreshed.', 'info');
  });

  // Tab Switching
  el.tabBtnTokens.addEventListener('click', () => {
    el.tabContentTokens.classList.remove('hidden');
    el.tabContentActivity.classList.add('hidden');
    el.tabContentSettings.classList.add('hidden');
    el.tabBtnTokens.className = 'px-4 py-2.5 text-indigo-400 border-b-2 border-indigo-500 transition';
    el.tabBtnActivity.className = 'px-4 py-2.5 text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition';
    el.tabBtnSettings.className = 'px-4 py-2.5 text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition';
  });

  el.tabBtnActivity.addEventListener('click', () => {
    el.tabContentTokens.classList.add('hidden');
    el.tabContentActivity.classList.remove('hidden');
    el.tabContentSettings.classList.add('hidden');
    el.tabBtnActivity.className = 'px-4 py-2.5 text-indigo-400 border-b-2 border-indigo-500 transition';
    el.tabBtnTokens.className = 'px-4 py-2.5 text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition';
    el.tabBtnSettings.className = 'px-4 py-2.5 text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition';
    renderActivity();
  });

  el.tabBtnSettings.addEventListener('click', () => {
    el.tabContentTokens.classList.add('hidden');
    el.tabContentActivity.classList.add('hidden');
    el.tabContentSettings.classList.remove('hidden');
    el.tabBtnSettings.className = 'px-4 py-2.5 text-indigo-400 border-b-2 border-indigo-500 transition';
    el.tabBtnTokens.className = 'px-4 py-2.5 text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition';
    el.tabBtnActivity.className = 'px-4 py-2.5 text-slate-400 hover:text-slate-200 border-b-2 border-transparent transition';
  });

  // Clear Activity History
  el.btnClearHistory.addEventListener('click', () => {
    if (confirm('Clear local transaction history?')) {
      vault.sessionVault.txHistory = [];
      renderActivity();
      showToast('History cleared.', 'info');
    }
  });

  // ==================== SEND TRANSACTION MODAL ====================
  el.btnActionSend.addEventListener('click', () => {
    if (!activeAccountData) return;
    el.inputSendTo.value = '';
    el.inputSendAmount.value = '';
    el.sendFeeEstimate.textContent = currentChainType === 'evm' ? 'Estimating...' : 'Standard network fee';
    el.modalSend.classList.remove('hidden');
  });

  el.btnSendMax.addEventListener('click', () => {
    const avail = parseFloat(el.sendAvailableBalance.textContent) || 0;
    // Leave safe margin for gas
    const reserve = currentChainType === 'evm' ? 0.002 : 0.0001;
    const maxVal = Math.max(0, avail - reserve);
    el.inputSendAmount.value = maxVal.toFixed(4);
  });

  // Send Form Submit
  el.formSendTx.addEventListener('submit', async (e) => {
    e.preventDefault();
    const toAddress = el.inputSendTo.value.trim();
    const amount = parseFloat(el.inputSendAmount.value);

    if (!toAddress || isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid recipient address and amount.', 'error');
      return;
    }

    el.btnConfirmSend.disabled = true;
    el.btnConfirmSend.innerHTML = `
      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      <span>Signing & Broadcasting...</span>
    `;

    try {
      let result;
      if (currentChainType === 'evm') {
        result = await evmManager.sendTransaction(activeAccountData.privateKey, toAddress, amount);
      } else if (currentChainType === 'solana') {
        result = await solanaManager.sendTransaction(activeAccountData.privateKey, toAddress, amount);
      } else if (currentChainType === 'bitcoin') {
        throw new Error('For Bitcoin transfers, use testnet broadcast or import WIF key.');
      }

      // Record in local history
      vault.sessionVault.txHistory.unshift({
        hash: result.hash,
        networkId: currentNetworkId,
        chain: currentChainType,
        from: activeAccountData.address,
        to: toAddress,
        amount: amount,
        symbol: el.displaySymbol.textContent,
        time: new Date().toLocaleTimeString(),
        explorerUrl: result.explorerUrl
      });

      showToast(`Transaction sent! Hash: ${result.hash.slice(0, 8)}...`, 'success');
      el.modalSend.classList.add('hidden');
      refreshBalances();
      renderActivity();
    } catch (err) {
      showToast('Send failed: ' + err.message, 'error');
    } finally {
      el.btnConfirmSend.disabled = false;
      el.btnConfirmSend.innerHTML = `<span>Sign & Broadcast Transaction</span>`;
    }
  });

  // ==================== SECURITY & BACKUP ====================

  // Reveal Seed Phrase
  el.btnSettingsRevealPhrase.addEventListener('click', () => {
    pendingSecurityAction = 'phrase';
    openSecurityModal('Export Secret Recovery Phrase');
  });

  // Reveal Private Key
  el.btnSettingsRevealKey.addEventListener('click', () => {
    pendingSecurityAction = 'key';
    openSecurityModal(`Export Private Key (${el.currentAccountName.textContent})`);
  });

  function openSecurityModal(title) {
    el.securityRevealTitle.textContent = title;
    el.securityPasswordPrompt.classList.remove('hidden');
    el.securityDisplayArea.classList.add('hidden');
    el.inputSecurityPassword.value = '';
    el.modalSecurityReveal.classList.remove('hidden');
    el.inputSecurityPassword.focus();
  }

  el.formSecurityVerify.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = el.inputSecurityPassword.value;

    try {
      // Re-verify password against local vault
      await vault.unlock(pass);

      el.securityPasswordPrompt.classList.add('hidden');
      el.securityDisplayArea.classList.remove('hidden');

      if (pendingSecurityAction === 'phrase') {
        el.securitySecretContent.textContent = activeMnemonic;
      } else if (pendingSecurityAction === 'key') {
        el.securitySecretContent.textContent = activeAccountData.privateKey;
      }
      lucide.createIcons();
    } catch (err) {
      showToast('Invalid password verification.', 'error');
    }
  });

  el.btnCopyRevealedSecret.addEventListener('click', () => {
    navigator.clipboard.writeText(el.securitySecretContent.textContent);
    showToast('Secret copied to clipboard.', 'success');
  });

  // Download Encrypted Keystore JSON Backup
  el.btnDownloadKeystore.addEventListener('click', () => {
    const raw = vault.getEncryptedKeystore();
    if (!raw) return;
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apex-wallet-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Encrypted backup downloaded.', 'success');
  });

  // Wipe Wallet from Settings
  el.btnResetWallet.addEventListener('click', () => {
    if (confirm('CRITICAL WARNING: This will permanently wipe all wallet data from this browser. Ensure your seed phrase is written down! Continue?')) {
      vault.wipe();
      activeMnemonic = null;
      activeAccountData = null;
      showToast('Wallet wiped successfully.', 'info');
      showView('view-onboarding');
    }
  });

  // ==================== MODAL CLOSE BUTTONS ====================
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.fixed').classList.add('hidden');
    });
  });

  // Close modals on backdrop click
  [el.modalSend, el.modalReceive, el.modalAddAccount, el.modalImportToken, el.modalSecurityReveal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });

  // Start the application
  initApp();
});
