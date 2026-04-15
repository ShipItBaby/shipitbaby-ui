'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import { PhantomIcon, SolflareIcon, GithubIcon } from '@/components/icons';

const SHORT_ADDRESS_START = 4;
const SHORT_ADDRESS_END = 4;

function shortenAddress(address) {
    if (!address) return '';
    return `${address.slice(0, SHORT_ADDRESS_START)}...${address.slice(-SHORT_ADDRESS_END)}`;
}

export default function Profile() {
    const router = useRouter();
    const [walletAddress, setWalletAddress] = useState(null);
    const [walletType, setWalletType] = useState(null);
    const [githubUsername, setGithubUsername] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        async function fetchWallet() {
            const autoConnect = localStorage.getItem('autoConnect');
            if (!autoConnect) return;

            if (autoConnect === 'phantom') {
                try {
                    const phantom = window?.solana;
                    if (phantom?.isPhantom) {
                        const response = await phantom.connect({ onlyIfTrusted: true });
                        setWalletAddress(response.publicKey.toString());
                        setWalletType('phantom');
                        return;
                    }
                } catch {
                    // Not connected previously
                }
            } else if (autoConnect === 'solflare') {
                try {
                    const solflare = window?.solflare;
                    if (solflare?.isSolflare) {
                        await solflare.connect();
                        if (solflare.isConnected) {
                            setWalletAddress(solflare.publicKey.toString());
                            setWalletType('solflare');
                        }
                    }
                } catch {
                    // Not connected previously
                }
            }
        }
        fetchWallet();
    }, []);

    useEffect(() => {
        async function fetchUserDetails() {
            if (!walletAddress) return;
            try {
                const res = await fetch(`/api/users?wallet=${walletAddress}`);
                if (res.ok) {
                    const { user } = await res.json();
                    if (user?.github_username) {
                        setGithubUsername(user.github_username);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch user details", err);
            }
        }
        fetchUserDetails();
    }, [walletAddress]);

    async function handleLogout() {
        try {
            if (walletType === 'phantom' && window?.solana) {
                await window.solana.disconnect();
            } else if (walletType === 'solflare' && window?.solflare) {
                await window.solflare.disconnect();
            }
        } catch (error) {
            console.error('Disconnection error:', error);
        } finally {
            localStorage.removeItem('autoConnect');
            setWalletAddress(null);
            setWalletType(null);
            setGithubUsername(null);
            router.push('/');
        }
    }

    async function handleConnectGithub() {
        if (!walletAddress) return;
        setIsUpdating(true);
        // Redirect completely to our brand new Github Auth API endpoint!
        window.location.href = `/api/github/login?wallet=${walletAddress}`;
    }

    return (
        <div className="grid-bg scanlines" style={{ minHeight: '100vh', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            
            <main style={{ flex: 1, padding: '80px 32px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                    <h1 className="font-pixel" style={{ fontSize: '2.5rem', color: '#e2e8f0', margin: 0 }}>
                        Profile
                    </h1>
                    {walletAddress && (
                        <button
                            onClick={handleLogout}
                            className="font-mono"
                            style={{ 
                                padding: '10px 24px', 
                                fontSize: '0.85rem', 
                                cursor: 'pointer',
                                background: 'transparent',
                                border: '1px solid #ef4444',
                                color: '#ef4444',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(239,68,68,0.2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                            Disconnect
                        </button>
                    )}
                </div>

                {walletAddress ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 'max-content' }}>
                        {/* Wallet Identity Card */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 16,
                            background: 'rgba(20,20,30,0.6)', border: '1px solid #1e1e30',
                            padding: '24px', borderRadius: '4px',
                            boxShadow: '4px 4px 0px rgba(0,0,0,0.2)'
                        }}>
                            <div style={{
                                width: 54, height: 54, borderRadius: '50%',
                                background: '#13131f', border: '1px solid #1e1e30',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: `inset 0 0 10px ${walletType === 'phantom' ? 'rgba(124,58,237,0.1)' : 'rgba(255,239,70,0.1)'}`
                            }}>
                                {walletType === 'solflare' ? (
                                    <SolflareIcon size={28} />
                                ) : (
                                    <PhantomIcon size={28} color="#ab9ff2" />
                                )}
                            </div>
                            <div>
                                <div className="font-mono" style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                                    Connected Wallet
                                </div>
                                <div className="font-mono" style={{ fontSize: '1.2rem', color: '#e2e8f0', letterSpacing: '0.02em' }}>
                                    {shortenAddress(walletAddress)}
                                </div>
                            </div>
                        </div>

                        {/* GitHub Identity Card */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32,
                            background: 'rgba(20,20,30,0.4)', border: '1px dashed #1e1e30',
                            padding: '24px', borderRadius: '4px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: '50%',
                                    background: '#13131f', border: '1px solid #1e1e30',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <GithubIcon width={22} height={22} color="#a78bfa" />
                                </div>
                                <div>
                                    <div className="font-mono" style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                                        GitHub Identity
                                    </div>
                                    <div className="font-mono" style={{ fontSize: '1.2rem', color: githubUsername ? '#e2e8f0' : '#475569', letterSpacing: '0.02em' }}>
                                        {githubUsername ? `@${githubUsername}` : 'Not Connected'}
                                    </div>
                                </div>
                            </div>
                            {!githubUsername && (
                                <button
                                    onClick={handleConnectGithub}
                                    disabled={isUpdating}
                                    className="font-mono"
                                    style={{
                                        padding: '10px 20px', fontSize: '0.8rem', cursor: isUpdating ? 'not-allowed' : 'pointer',
                                        background: '#7c3aed', color: '#fff', border: 'none',
                                        textTransform: 'uppercase', letterSpacing: '0.05em',
                                        opacity: isUpdating ? 0.7 : 1, transition: 'all 0.2s',
                                        boxShadow: '2px 2px 0px rgba(0,0,0,0.5)'
                                    }}
                                    onMouseEnter={e => { if (!isUpdating) e.currentTarget.style.background = '#6d28d9'; }}
                                    onMouseLeave={e => { if (!isUpdating) e.currentTarget.style.background = '#7c3aed'; }}
                                >
                                    {isUpdating ? 'Linking...' : 'Link GitHub'}
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{
                        padding: '40px', background: 'rgba(20,20,30,0.4)', 
                        border: '1px dashed #1e1e30', textAlign: 'center'
                    }}>
                        <p className="font-mono" style={{ color: '#64748b', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                            Connect your wallet to view profile details
                        </p>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
