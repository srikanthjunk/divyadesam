#!/usr/bin/env node

/**
 * API Key Encryption Utility
 * Encrypts API keys using XOR cipher with base64 encoding
 */

// Simple XOR encryption function (matches the one in HTML)
function encryptDecrypt(text, key = 'divyadesam2024') {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
}

// Encrypt API key
function encryptKey(plaintext) {
    const encrypted = encryptDecrypt(plaintext);
    return Buffer.from(encrypted).toString('base64');
}

// Test decryption (verify)
function decryptKey(encryptedBase64) {
    try {
        const encrypted = Buffer.from(encryptedBase64, 'base64').toString();
        return encryptDecrypt(encrypted);
    } catch (e) {
        console.error('Decryption failed');
        return null;
    }
}

// Main function
function main() {
    console.log('🔐 API Key Encryption Utility');
    console.log('================================\n');
    
    // Replace with your actual API keys
    const HERE_API_KEY = 'YOUR_NEW_HERE_API_KEY';
    const GOOGLE_API_KEY = 'YOUR_NEW_GOOGLE_API_KEY';
    
    if (HERE_API_KEY === 'YOUR_NEW_HERE_API_KEY') {
        console.log('❌ Please replace the placeholder keys with your actual API keys in this script');
        console.log('\n📝 Steps:');
        console.log('1. Get new API keys from HERE Maps and Google Cloud Console');
        console.log('2. Replace the placeholder keys in this script');
        console.log('3. Run: node encrypt-keys.js');
        console.log('4. Copy the encrypted keys to the HTML file');
        return;
    }
    
    console.log('🔑 Encrypting API Keys...\n');
    
    // Encrypt the keys
    const encryptedHere = encryptKey(HERE_API_KEY);
    const encryptedGoogle = encryptKey(GOOGLE_API_KEY);
    
    console.log('✅ Encrypted Keys:');
    console.log('==================');
    console.log(`HERE_API_KEY (encrypted): ${encryptedHere}`);
    console.log(`GOOGLE_API_KEY (encrypted): ${encryptedGoogle}`);
    
    console.log('\n🔍 Verification (decrypted):');
    console.log('=============================');
    console.log(`HERE_API_KEY: ${decryptKey(encryptedHere)}`);
    console.log(`GOOGLE_API_KEY: ${decryptKey(encryptedGoogle)}`);
    
    console.log('\n📋 Copy these to your HTML file:');
    console.log('=================================');
    console.log('const ENCRYPTED_KEYS = {');
    console.log(`    here: '${encryptedHere}',`);
    console.log(`    google: '${encryptedGoogle}'`);
    console.log('};');
    
    console.log('\n⚠️  Security Notes:');
    console.log('==================');
    console.log('• XOR encryption provides basic obfuscation, not military-grade security');
    console.log('• Keys can still be extracted by determined users viewing source code');
    console.log('• Rate limiting (100 calls/day) is your main protection against abuse');
    console.log('• Consider server-side API proxy for production applications');
}

// Export for use as module
if (require.main === module) {
    main();
} else {
    module.exports = { encryptKey, decryptKey };
}