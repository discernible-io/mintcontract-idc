import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Contract } from './near-interface';
import { Wallet } from './near-wallet';
import { cryptoUtils } from '../sdk/frontend/rodit_fe.js';

// Add Buffer polyfill
window.Buffer = cryptoUtils.Buffer;

// Environment variable check
if (!process.env.REACT_APP_NEAR_CONTRACT_ID) {
    throw new Error('REACT_APP_NEAR_CONTRACT_ID environment variable is not set');
}

// NEAR wallet setup
const wallet = new Wallet({ createAccessKeyFor: process.env.REACT_APP_NEAR_CONTRACT_ID });

// Contract setup
const roditForge = new Contract({
    contractId: process.env.REACT_APP_NEAR_CONTRACT_ID,
    walletToUse: wallet,
});

// Application initialization
const initializeApp = async () => {
    try {
        const isSignedIn = await wallet.startUp();
        const root = createRoot(document.getElementById('root'));
        root.render(
            <React.StrictMode>
                <App
                    isSignedIn={isSignedIn}
                    roditForge={roditForge}
                    wallet={wallet}
                />
            </React.StrictMode>
        );
    } catch (error) {
        console.error('Failed to initialize the app:', error);
    }
};

// Setup on page load
window.addEventListener('load', initializeApp);