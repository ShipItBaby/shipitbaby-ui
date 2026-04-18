'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import BetaSignupCard from '@/components/BetaSignupCard';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import { PhantomIcon, SolflareIcon, GithubIcon } from '@/components/icons';
import { isValidEmailInput, sanitizeEmailInput } from '@/lib/email';
import {
    clearWalletSession,
    ensureWalletSession,
} from '@/lib/walletAuthClient';

const DEVNET_RPC = 'https://api.devnet.solana.com';
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

const SHORT_ADDRESS_START = 4;
const SHORT_ADDRESS_END = 4;

function shortenAddress(address) {
    if (!address) return '';
    return `${address.slice(0, SHORT_ADDRESS_START)}...${address.slice(-SHORT_ADDRESS_END)}`;
}

function formatDateTime(value) {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleString();
}

export default function Profile() {
    const router = useRouter();
    const [walletAddress, setWalletAddress] = useState(null);
    const [walletType, setWalletType] = useState(null);
    const [githubUsername, setGithubUsername] = useState(null);
    const [isBeta, setIsBeta] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isUnlinking, setIsUnlinking] = useState(false);
    const [showLaunchModal, setShowLaunchModal] = useState(false);
    const [launchForm, setLaunchForm] = useState({ name: '', symbol: '', uri: '' });
    const [isLaunching, setIsLaunching] = useState(false);
    const [launchError, setLaunchError] = useState(null);
    const [launchSuccess, setLaunchSuccess] = useState(null);
    const [deployedTokens, setDeployedTokens] = useState([]);
    const [isLoadingTokens, setIsLoadingTokens] = useState(false);
    const [tokensError, setTokensError] = useState(null);
    const [isBetaSignupSubmitting, setIsBetaSignupSubmitting] = useState(false);
    const [betaSignupFeedback, setBetaSignupFeedback] = useState('');
    const [betaSignupFeedbackTone, setBetaSignupFeedbackTone] = useState('muted');
    const launchInFlightRef = useRef(false);

    const getWalletProvider = useCallback(() => {
        if (walletType === 'phantom') return window?.solana;
        if (walletType === 'solflare') return window?.solflare;
        return null;
    }, [walletType]);

    const fetchDeployedTokens = useCallback(async (wallet) => {
        if (!wallet) {
            setDeployedTokens([]);
            setTokensError(null);
            setIsLoadingTokens(false);
            return;
        }

        setIsLoadingTokens(true);
        setTokensError(null);

        try {
            const res = await fetch(`/api/tokens?wallet=${wallet}`);
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || 'Failed to load deployed tokens');
            }

            setDeployedTokens(Array.isArray(data.tokens) ? data.tokens : []);
        } catch (err) {
            setTokensError(err?.message || 'Failed to load deployed tokens');
        } finally {
            setIsLoadingTokens(false);
        }
    }, []);

    async function handleLaunch() {
        if (launchInFlightRef.current || isLaunching) return;
        launchInFlightRef.current = true;
        setIsLaunching(true);
        setLaunchError(null);
        setLaunchSuccess(null);

        try {
            const walletProvider = getWalletProvider();
            if (!walletProvider) throw new Error('Wallet not connected');
            await ensureWalletSession(walletProvider, walletAddress);

            // 1. Fetch IDL + contract address from beta-protected API
            const idlRes = await fetch('/api/launch/idl');
            if (!idlRes.ok) {
                const errData = await idlRes.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to fetch IDL');
            }
            const { idl, contractAddress } = await idlRes.json();

            // 2. Build Anchor provider from the connected wallet
            const connection = new Connection(DEVNET_RPC, 'confirmed');
            const provider = new AnchorProvider(
                connection,
                walletProvider,
                { preflightCommitment: 'confirmed' }
            );

            // 3. Create program instance
            // Anchor v0.32 reads the program id from `idl.address`.
            const normalizedIdl = { ...idl, address: contractAddress };
            const program = new Program(normalizedIdl, provider);
            if (!provider.publicKey) throw new Error('Provider public key missing');

            const tokenMint = Keypair.generate();
            const [tokenMetadataAccount] = PublicKey.findProgramAddressSync(
                [
                    new TextEncoder().encode('metadata'),
                    METADATA_PROGRAM_ID.toBytes(),
                    tokenMint.publicKey.toBytes(),
                ],
                METADATA_PROGRAM_ID
            );

            // 4. Call the launch instruction
            const tx = await program.methods
                .launch(launchForm.name, launchForm.symbol, launchForm.uri)
                .accounts({
                    creator: provider.publicKey,
                    tokenMint: tokenMint.publicKey,
                    tokenMetadataAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    metadataProgram: METADATA_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .signers([tokenMint])
                .rpc();

            const tokenAddress = tokenMint.publicKey.toBase58();
            const syncRes = await fetch('/api/tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token_address: tokenAddress,
                    ticker: launchForm.symbol,
                    description: launchForm.name,
                    metadata_link: launchForm.uri,
                    deployment_tx: tx,
                }),
            });
            if (!syncRes.ok) {
                const syncData = await syncRes.json().catch(() => ({}));
                throw new Error(syncData.error || 'Token deployed, but failed to save launch in database');
            }

            setLaunchSuccess(tx);
            await fetchDeployedTokens(walletAddress);
            console.log('Launch tx:', tx);
        } catch (err) {
            console.error('Launch error:', err);
            setLaunchError(err?.message || 'Launch failed');
        } finally {
            setIsLaunching(false);
            launchInFlightRef.current = false;
        }
    }

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
        if (!walletAddress) return;

        let cancelled = false;

        async function establishWalletSession() {
            try {
                const walletProvider = getWalletProvider();
                if (!walletProvider) return;
                await ensureWalletSession(walletProvider, walletAddress);
            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to establish wallet session', err);
                }
            }
        }

        establishWalletSession();

        return () => {
            cancelled = true;
        };
    }, [getWalletProvider, walletAddress]);

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
                    setIsBeta(user?.is_beta === true);
                }
            } catch (err) {
                console.error("Failed to fetch user details", err);
            }
        }
        fetchUserDetails();
    }, [walletAddress]);

    useEffect(() => {
        fetchDeployedTokens(walletAddress);
    }, [fetchDeployedTokens, walletAddress]);

    async function handleLogout() {
        try {
            await clearWalletSession();
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
            setDeployedTokens([]);
            setIsLoadingTokens(false);
            setTokensError(null);
            router.push('/');
        }
    }

    async function handleUnlinkGithub() {
        if (!walletAddress) return;
        setIsUnlinking(true);
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: walletAddress, github_username: null }),
            });
            if (res.ok) {
                setGithubUsername(null);
            } else {
                console.error('Failed to unlink GitHub');
            }
        } catch (err) {
            console.error('Failed to unlink GitHub', err);
        } finally {
            setIsUnlinking(false);
        }
    }

    async function handleConnectGithub() {
        if (!walletAddress) return;
        setIsUpdating(true);
        // Redirect completely to our brand new Github Auth API endpoint!
        window.location.href = `/api/github/login?wallet=${walletAddress}`;
    }

    async function handleBetaSignupSubmit(email) {
        const sanitizedEmail = sanitizeEmailInput(email);
        if (!isValidEmailInput(sanitizedEmail)) {
            setBetaSignupFeedbackTone('error');
            setBetaSignupFeedback('Enter a valid email address.');
            return false;
        }

        setIsBetaSignupSubmitting(true);
        setBetaSignupFeedback('');
        setBetaSignupFeedbackTone('muted');

        try {
            if (walletAddress) {
                const walletProvider = getWalletProvider();
                if (!walletProvider) {
                    setBetaSignupFeedbackTone('error');
                    setBetaSignupFeedback('Wallet provider not available. Reconnect wallet and try again.');
                    return false;
                }

                try {
                    await ensureWalletSession(walletProvider, walletAddress);
                } catch {
                    setBetaSignupFeedbackTone('error');
                    setBetaSignupFeedback('Wallet session verification failed. Please reconnect and try again.');
                    return false;
                }
            }

            const response = await fetch('/api/beta-signups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: sanitizedEmail }),
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                setBetaSignupFeedbackTone('error');
                setBetaSignupFeedback(data.error || 'Could not submit email right now.');
                return false;
            }

            setBetaSignupFeedbackTone('success');
            setBetaSignupFeedback(
                data.already_joined
                    ? 'Already on the beta list.'
                    : 'Joined beta. We will email you updates.'
            );
            return true;
        } catch {
            setBetaSignupFeedbackTone('error');
            setBetaSignupFeedback('Could not submit email right now.');
            return false;
        } finally {
            setIsBetaSignupSubmitting(false);
        }
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 'max-content', width: '100%' }}>
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

                        {!isBeta && (
                            <div style={{ width: '100%', maxWidth: 420 }}>
                                <BetaSignupCard
                                    onSubmit={handleBetaSignupSubmit}
                                    isSubmitting={isBetaSignupSubmitting}
                                    feedback={betaSignupFeedback}
                                    feedbackTone={betaSignupFeedbackTone}
                                />
                            </div>
                        )}

                        {isBeta && (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 24,
                                width: '100%',
                                background: 'rgba(20,20,30,0.45)',
                                border: '1px solid #1e1e30',
                                padding: '20px',
                                borderRadius: '4px',
                            }}>
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
                                    {!githubUsername ? (
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
                                    ) : (
                                        <button
                                            onClick={handleUnlinkGithub}
                                            disabled={isUnlinking}
                                            className="font-mono"
                                            style={{
                                                padding: '10px 20px', fontSize: '0.8rem', cursor: isUnlinking ? 'not-allowed' : 'pointer',
                                                background: 'transparent', color: '#ef4444', border: '1px solid #ef4444',
                                                textTransform: 'uppercase', letterSpacing: '0.05em',
                                                opacity: isUnlinking ? 0.7 : 1, transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={e => { if (!isUnlinking) e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                                            onMouseLeave={e => { if (!isUnlinking) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            {isUnlinking ? 'Unlinking...' : 'Unlink'}
                                        </button>
                                    )}
                                </div>

                                {/* Launch App */}
                                <button
                                    onClick={() => setShowLaunchModal(true)}
                                    className="font-mono"
                                    style={{
                                        padding: '14px 28px', fontSize: '0.9rem', cursor: 'pointer',
                                        background: '#06d6a0', color: '#0a0a0f', border: 'none',
                                        textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
                                        transition: 'all 0.2s', boxShadow: '4px 4px 0px rgba(0,0,0,0.4)',
                                        alignSelf: 'flex-start',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#05c490'; e.currentTarget.style.boxShadow = '4px 4px 0px rgba(6,214,160,0.3)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#06d6a0'; e.currentTarget.style.boxShadow = '4px 4px 0px rgba(0,0,0,0.4)'; }}
                                >
                                    🚀 Launch App
                                </button>

                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 12,
                                    background: 'rgba(20,20,30,0.6)',
                                    border: '1px solid #1e1e30',
                                    padding: '20px',
                                    borderRadius: '4px',
                                    width: '100%',
                                }}>
                                    <div className="font-mono" style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Deployed Tokens
                                    </div>

                                    {isLoadingTokens && (
                                        <div className="font-mono" style={{ color: '#64748b', fontSize: '0.82rem' }}>
                                            Loading tokens...
                                        </div>
                                    )}

                                    {!isLoadingTokens && tokensError && (
                                        <div className="font-mono" style={{ color: '#ef4444', fontSize: '0.82rem' }}>
                                            {tokensError}
                                        </div>
                                    )}

                                    {!isLoadingTokens && !tokensError && deployedTokens.length === 0 && (
                                        <div className="font-mono" style={{ color: '#475569', fontSize: '0.82rem' }}>
                                            No deployed tokens yet.
                                        </div>
                                    )}

                                    {!isLoadingTokens && !tokensError && deployedTokens.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {deployedTokens.map((token) => (
                                                <div
                                                    key={token.id}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: 12,
                                                        padding: '12px',
                                                        background: '#13131f',
                                                        border: '1px solid #1e1e30',
                                                    }}
                                                >
                                                    <div style={{ minWidth: 0 }}>
                                                        <div className="font-mono" style={{ color: '#e2e8f0', fontSize: '0.95rem', textTransform: 'uppercase', marginBottom: 4 }}>
                                                            {token.ticker}
                                                        </div>
                                                        <div className="font-mono" style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: 2 }}>
                                                            {token.description || 'No description'}
                                                        </div>
                                                        <div className="font-mono" style={{ color: '#64748b', fontSize: '0.72rem', marginBottom: 2 }}>
                                                            {shortenAddress(token.token_address)}
                                                        </div>
                                                        <div className="font-mono" style={{ color: '#475569', fontSize: '0.7rem' }}>
                                                            {formatDateTime(token.created_at)}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                                                        <button
                                                            onClick={() => router.push(`/token/${token.token_address}`)}
                                                            className="font-mono"
                                                            style={{
                                                                padding: '8px 12px',
                                                                fontSize: '0.72rem',
                                                                background: '#7c3aed',
                                                                color: '#fff',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.05em',
                                                            }}
                                                        >
                                                            Open
                                                        </button>
                                                        {token.deployment_tx && (
                                                            <a
                                                                href={`https://solscan.io/tx/${token.deployment_tx}?cluster=devnet`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="font-mono"
                                                                style={{ color: '#06d6a0', fontSize: '0.7rem', textAlign: 'center', textDecoration: 'none' }}
                                                            >
                                                                Tx
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
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

            {/* Launch Modal */}
            {showLaunchModal && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1000,
                        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 24,
                    }}
                    onClick={() => { if (!isLaunching) setShowLaunchModal(false); }}
                >
                    <div
                        style={{
                            background: '#0f0f1a', border: '1px solid #1e1e30',
                            padding: 32, width: '100%', maxWidth: 460,
                            boxShadow: '8px 8px 0px rgba(0,0,0,0.5)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                            <h2 className="font-pixel" style={{ fontSize: '1.6rem', color: '#e2e8f0', margin: 0 }}>
                                🚀 Launch App
                            </h2>
                            <button
                                onClick={() => { if (!isLaunching) setShowLaunchModal(false); }}
                                className="font-mono"
                                style={{
                                    background: 'transparent', border: 'none', color: '#64748b',
                                    fontSize: '1.2rem', cursor: isLaunching ? 'not-allowed' : 'pointer',
                                    padding: '4px 8px', lineHeight: 1,
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <form
                            onSubmit={e => {
                                e.preventDefault();
                                handleLaunch();
                            }}
                            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
                        >
                            {/* Name */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label className="font-mono" style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    App Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={launchForm.name}
                                    onChange={e => setLaunchForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="My Awesome App"
                                    className="font-mono"
                                    style={{
                                        padding: '10px 14px', fontSize: '0.9rem',
                                        background: '#13131f', border: '1px solid #1e1e30', color: '#e2e8f0',
                                        outline: 'none', transition: 'border-color 0.2s',
                                    }}
                                    onFocus={e => { e.currentTarget.style.borderColor = '#06d6a0'; }}
                                    onBlur={e => { e.currentTarget.style.borderColor = '#1e1e30'; }}
                                />
                            </div>

                            {/* Symbol */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label className="font-mono" style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Ticker Symbol
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={launchForm.symbol}
                                    onChange={e => setLaunchForm(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                                    placeholder="APP"
                                    className="font-mono"
                                    style={{
                                        padding: '10px 14px', fontSize: '0.9rem',
                                        background: '#13131f', border: '1px solid #1e1e30', color: '#e2e8f0',
                                        outline: 'none', transition: 'border-color 0.2s',
                                        textTransform: 'uppercase',
                                    }}
                                    onFocus={e => { e.currentTarget.style.borderColor = '#06d6a0'; }}
                                    onBlur={e => { e.currentTarget.style.borderColor = '#1e1e30'; }}
                                />
                            </div>

                            {/* URI */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label className="font-mono" style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Metadata URI
                                </label>
                                <input
                                    type="url"
                                    required
                                    value={launchForm.uri}
                                    onChange={e => setLaunchForm(prev => ({ ...prev, uri: e.target.value }))}
                                    placeholder="https://arweave.net/..."
                                    className="font-mono"
                                    style={{
                                        padding: '10px 14px', fontSize: '0.9rem',
                                        background: '#13131f', border: '1px solid #1e1e30', color: '#e2e8f0',
                                        outline: 'none', transition: 'border-color 0.2s',
                                    }}
                                    onFocus={e => { e.currentTarget.style.borderColor = '#06d6a0'; }}
                                    onBlur={e => { e.currentTarget.style.borderColor = '#1e1e30'; }}
                                />
                                <span className="font-mono" style={{ fontSize: '0.65rem', color: '#475569' }}>
                                    Link to JSON metadata (image, description, etc.)
                                </span>
                            </div>

                            {/* Error */}
                            {launchError && (
                                <div className="font-mono" style={{
                                    padding: '10px 14px', fontSize: '0.78rem',
                                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                    color: '#ef4444', wordBreak: 'break-word',
                                }}>
                                    {launchError}
                                </div>
                            )}

                            {/* Success */}
                            {launchSuccess && (
                                <div className="font-mono" style={{
                                    padding: '10px 14px', fontSize: '0.78rem',
                                    background: 'rgba(6,214,160,0.1)', border: '1px solid rgba(6,214,160,0.3)',
                                    color: '#06d6a0', wordBreak: 'break-all',
                                }}>
                                    Launched! Tx: {launchSuccess}
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isLaunching}
                                className="font-mono"
                                style={{
                                    padding: '14px 28px', fontSize: '0.9rem',
                                    cursor: isLaunching ? 'not-allowed' : 'pointer',
                                    background: isLaunching ? 'rgba(6,214,160,0.4)' : '#06d6a0',
                                    color: '#0a0a0f', border: 'none',
                                    textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
                                    transition: 'all 0.2s', boxShadow: '4px 4px 0px rgba(0,0,0,0.4)',
                                    marginTop: 4,
                                }}
                                onMouseEnter={e => { if (!isLaunching) e.currentTarget.style.background = '#05c490'; }}
                                onMouseLeave={e => { if (!isLaunching) e.currentTarget.style.background = '#06d6a0'; }}
                            >
                                {isLaunching ? 'Launching...' : 'Launch Token'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
