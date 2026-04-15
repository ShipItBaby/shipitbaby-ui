'use client';

import { useState, useEffect, useRef } from 'react';
import { PhantomIcon } from './icons';

const SHORT_ADDRESS_START = 4;
const SHORT_ADDRESS_END = 4;

function shortenAddress(address) {
    return `${address.slice(0, SHORT_ADDRESS_START)}...${address.slice(-SHORT_ADDRESS_END)}`;
}

async function syncUserWithDB(wallet) {
    try {
        await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallet }),
        });
    } catch (err) {
        console.error('Failed to sync user with DB:', err);
    }
}

export default function Navbar() {
    const [walletAddress, setWalletAddress] = useState(null);
    const [showPopup, setShowPopup] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const popupRef = useRef(null);

    // Silently restore session if user already approved this site
    useEffect(() => {
        async function tryAutoConnect() {
            try {
                const phantom = window?.solana;
                if (!phantom?.isPhantom) return;
                const response = await phantom.connect({ onlyIfTrusted: true });
                const address = response.publicKey.toString();
                setWalletAddress(address);
                syncUserWithDB(address);
            } catch {
                // Not previously connected — do nothing
            }
        }
        tryAutoConnect();
    }, []);

    useEffect(() => {
        function handleClickOutside(e) {
            if (popupRef.current && !popupRef.current.contains(e.target)) {
                setShowPopup(false);
            }
        }
        if (showPopup) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showPopup]);

    async function connectPhantom() {
        try {
            const phantom = window?.solana;
            if (!phantom?.isPhantom) {
                window.open('https://phantom.app/', '_blank');
                return;
            }
            setConnecting(true);
            const response = await phantom.connect();
            const address = response.publicKey.toString();
            setWalletAddress(address);
            setShowPopup(false);
            syncUserWithDB(address);
        } catch (err) {
            console.error('Phantom connection error:', err);
        } finally {
            setConnecting(false);
        }
    }

    function disconnect() {
        window?.solana?.disconnect();
        setWalletAddress(null);
    }

    return (
        <nav style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 32px', borderBottom: '1px solid #1e1e30',
            background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(10px)',
            position: 'sticky', top: 0, zIndex: 100,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="font-pixel" style={{ fontSize: '1.6rem', color: '#7c3aed', textShadow: '0 0 20px rgba(124,58,237,0.8)' }}>
                    ShipIt.Baby
                </span>
                <span style={{
                    fontSize: '0.6rem', fontFamily: 'Share Tech Mono', textTransform: 'uppercase',
                    color: '#475569', letterSpacing: '0.1em', marginTop: 4,
                }}>
                    beta
                </span>
            </div>

            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                <a
                    href="/about"
                    className="font-mono"
                    style={{ fontSize: '0.78rem', color: '#64748b', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                    onMouseEnter={e => e.target.style.color = '#a78bfa'}
                    onMouseLeave={e => e.target.style.color = '#64748b'}
                >
                    How it works
                </a>

                <div style={{ position: 'relative' }} ref={popupRef}>
                    {walletAddress ? (
                        <button
                            onClick={disconnect}
                            className="btn-pixel btn-pixel-primary font-mono"
                            style={{ padding: '6px 18px', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#06d6a0', display: 'inline-block', marginRight: 6 }} />
                            {shortenAddress(walletAddress)}
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowPopup(prev => !prev)}
                            className="btn-pixel btn-pixel-primary font-mono"
                            style={{ padding: '6px 18px', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                            Connect
                        </button>
                    )}

                    {showPopup && (
                        <div style={{
                            position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                            background: '#13131f', border: '1px solid #1e1e30',
                            boxShadow: '4px 4px 0px #3b0764, 0 0 30px rgba(124,58,237,0.2)',
                            minWidth: 220, zIndex: 200, padding: '12px',
                        }}>
                            <p className="font-mono" style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                                Select Wallet
                            </p>

                            <button
                                onClick={connectPhantom}
                                disabled={connecting}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    width: '100%', background: 'transparent',
                                    border: '1px solid #1e1e30', padding: '10px 12px',
                                    cursor: connecting ? 'not-allowed' : 'pointer',
                                    transition: 'border-color 0.15s, background 0.15s',
                                    opacity: connecting ? 0.6 : 1,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e1e30'; e.currentTarget.style.background = 'transparent'; }}
                            >
                                <PhantomIcon size={22} color="#ab9ff2" />
                                <span className="font-mono" style={{ fontSize: '0.78rem', color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {connecting ? 'Connecting…' : 'Phantom'}
                                </span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
