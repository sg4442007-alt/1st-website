/**
 * Apex Decentralized Crypto Wallet - Cryptographic Core & Vault
 * Non-custodial AES-256-GCM encryption using Web Crypto API.
 * Private keys and mnemonics never leave the client unencrypted.
 */

class CryptoVault {
  constructor() {
    this.STORAGE_KEY = 'apex_wallet_vault';
    this.sessionVault = null; // Stored in RAM only while unlocked
  }

  // Check if a vault exists in local storage
  hasVault() {
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }

  // Clear session from memory
  lock() {
    this.sessionVault = null;
  }

  isUnlocked() {
    return this.sessionVault !== null;
  }

  // Derive AES-256-GCM key from password and salt using PBKDF2
  async deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt data object with user password
  async encryptVault(dataObject, password) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(password, salt);

    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(dataObject));

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encodedData
    );

    const payload = {
      salt: this.bytesToBase64(salt),
      iv: this.bytesToBase64(iv),
      ciphertext: this.bytesToBase64(new Uint8Array(ciphertextBuffer)),
      version: 1,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
    this.sessionVault = dataObject;
    return payload;
  }

  // Decrypt vault using user password
  async unlock(password) {
    const rawVault = localStorage.getItem(this.STORAGE_KEY);
    if (!rawVault) {
      throw new Error('No wallet found. Please create or import one.');
    }

    let payload;
    try {
      payload = JSON.parse(rawVault);
    } catch (e) {
      throw new Error('Corrupted wallet storage.');
    }

    const salt = this.base64ToBytes(payload.salt);
    const iv = this.base64ToBytes(payload.iv);
    const ciphertext = this.base64ToBytes(payload.ciphertext);

    const key = await this.deriveKey(password, salt);

    try {
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        ciphertext
      );

      const dec = new TextDecoder();
      const dataObject = JSON.parse(dec.decode(decryptedBuffer));
      this.sessionVault = dataObject;
      return dataObject;
    } catch (err) {
      throw new Error('Incorrect password. Failed to decrypt vault.');
    }
  }

  // Export raw encrypted keystore payload for backup download
  getEncryptedKeystore() {
    return localStorage.getItem(this.STORAGE_KEY);
  }

  // Import encrypted keystore JSON file
  importKeystore(jsonString) {
    const payload = JSON.parse(jsonString);
    if (!payload.salt || !payload.iv || !payload.ciphertext) {
      throw new Error('Invalid keystore file format.');
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
  }

  // Update session vault and re-save
  async saveCurrentSession(password) {
    if (!this.sessionVault) throw new Error('Wallet is currently locked.');
    return this.encryptVault(this.sessionVault, password);
  }

  // Wipe all wallet data from local storage
  wipe() {
    localStorage.removeItem(this.STORAGE_KEY);
    this.sessionVault = null;
  }

  // Utilities for byte array <-> base64
  bytesToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  base64ToBytes(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
}

window.CryptoVault = CryptoVault;
