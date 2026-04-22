'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ensureWalletSession } from '@/lib/walletAuthClient';
import { PROJECT_CATEGORY_OPTIONS } from '@/lib/projectCategories';

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

export default function TokenPage() {
    const router = useRouter();
    const [walletAddress, setWalletAddress] = useState(null);
    const [walletType, setWalletType] = useState(null);
    const [walletStatus, setWalletStatus] = useState('checking');

    const [accessStatus, setAccessStatus] = useState('idle');
    const [accessError, setAccessError] = useState(null);
    const [launchConfig, setLaunchConfig] = useState(null);

    const [launchForm, setLaunchForm] = useState({ name: '', symbol: '', category: '', uri: '', logoUrl: '' });
    const [isLaunching, setIsLaunching] = useState(false);
    const [launchError, setLaunchError] = useState(null);
    const [launchSuccess, setLaunchSuccess] = useState(null);
    const launchInFlightRef = useRef(false);

    const getWalletProvider = useCallback(() => {
        if (walletType === 'phantom') return window?.solana;
        if (walletType === 'solflare') return window?.solflare;
        return null;
    }, [walletType]);

    useEffect(() => {
        async function restoreWalletSession() {
            const autoConnect = localStorage.getItem('autoConnect');
            if (!autoConnect) {
                setWalletStatus('missing');
                return;
            }

            if (autoConnect === 'phantom') {
                try {
                    const phantom = window?.solana;
                    if (phantom?.isPhantom) {
                        const response = await phantom.connect({ onlyIfTrusted: true });
                        setWalletAddress(response.publicKey.toString());
                        setWalletType('phantom');
                        setWalletStatus('connected');
                        return;
                    }
                } catch {
                    setWalletStatus('missing');
                    return;
                }
            }

            if (autoConnect === 'solflare') {
                try {
                    const solflare = window?.solflare;
                    if (solflare?.isSolflare) {
                        await solflare.connect();
                        if (solflare.isConnected) {
                            setWalletAddress(solflare.publicKey.toString());
                            setWalletType('solflare');
                            setWalletStatus('connected');
                            return;
                        }
                    }
                } catch {
                    setWalletStatus('missing');
                    return;
                }
            }

            setWalletStatus('missing');
        }

        restoreWalletSession();
    }, []);

    useEffect(() => {
        if (walletStatus !== 'connected' || !walletAddress) return;

        let cancelled = false;

        async function verifyBetaAndLoadConfig() {
            setAccessStatus('checking');
            setAccessError(null);

            try {
                const walletProvider = getWalletProvider();
                if (!walletProvider) throw new Error('Wallet provider not found');

                await ensureWalletSession(walletProvider, walletAddress);

                const res = await fetch('/api/launch/idl');
                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    if (res.status === 401 || res.status === 403 || res.status === 404) {
                        if (!cancelled) setAccessStatus('denied');
                        return;
                    }
                    throw new Error(data.error || 'Failed to verify beta access');
                }

                if (cancelled) return;

                setLaunchConfig({
                    idl: data.idl,
                    contractAddress: data.contractAddress,
                });
                setAccessStatus('granted');
            } catch (err) {
                if (cancelled) return;
                setAccessStatus('error');
                setAccessError(err?.message || 'Failed to verify beta access');
            }
        }

        verifyBetaAndLoadConfig();

        return () => {
            cancelled = true;
        };
    }, [getWalletProvider, walletAddress, walletStatus]);

    async function handleLaunch(event) {
        event.preventDefault();
        if (launchInFlightRef.current || isLaunching) return;
        launchInFlightRef.current = true;

        if (!launchConfig?.idl || !launchConfig?.contractAddress) {
            setLaunchError('Launch config not loaded');
            launchInFlightRef.current = false;
            return;
        }

        setIsLaunching(true);
        setLaunchError(null);
        setLaunchSuccess(null);

        try {
            const walletProvider = getWalletProvider();
            if (!walletProvider) throw new Error('Wallet not connected');
            await ensureWalletSession(walletProvider, walletAddress);

            const connection = new Connection(DEVNET_RPC, 'confirmed');
            const provider = new AnchorProvider(
                connection,
                walletProvider,
                { preflightCommitment: 'confirmed' }
            );

            if (!provider.publicKey) throw new Error('Provider public key missing');

            const normalizedIdl = {
                ...launchConfig.idl,
                address: launchConfig.contractAddress,
            };
            const program = new Program(normalizedIdl, provider);

            const tokenMint = Keypair.generate();
            const [tokenMetadataAccount] = PublicKey.findProgramAddressSync(
                [
                    new TextEncoder().encode('metadata'),
                    METADATA_PROGRAM_ID.toBytes(),
                    tokenMint.publicKey.toBytes(),
                ],
                METADATA_PROGRAM_ID
            );

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
                    category: launchForm.category,
                    short_description: launchForm.name,
                    metadata_link: launchForm.uri,
                    logo_url: launchForm.logoUrl,
                    deployment_tx: tx,
                }),
            });
            if (!syncRes.ok) {
                const syncData = await syncRes.json().catch(() => ({}));
                throw new Error(syncData.error || 'Token deployed, but failed to save launch in database');
            }

            setLaunchSuccess(tx);
            router.push(`/token/${tokenAddress}`);
        } catch (err) {
            setLaunchError(err?.message || 'Launch failed');
        } finally {
            setIsLaunching(false);
            launchInFlightRef.current = false;
        }
    }

    return (
        <div className="grid-bg scanlines" style={{ minHeight: '100vh', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <Navbar />

            <main style={{ flex: 1, padding: '80px 32px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
                <h1 className="font-pixel" style={{ fontSize: '2.2rem', color: '#e2e8f0', marginBottom: 12 }}>
                    Token Launch
                </h1>
                <p className="font-mono" style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 28, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Beta access only
                </p>

                {walletStatus === 'checking' && (
                    <div className="card" style={{ color: '#64748b', padding: 20 }}>
                        Checking wallet session...
                    </div>
                )}

                {walletStatus === 'missing' && (
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <p style={{ color: '#e2e8f0' }}>Connect a wallet first to continue.</p>
                        <Link href="/profile" className="btn-pixel btn-pixel-primary" style={{ width: 'fit-content' }}>
                            Go To Profile
                        </Link>
                    </div>
                )}

                {walletStatus === 'connected' && accessStatus === 'checking' && (
                    <div className="card" style={{ color: '#64748b', padding: 20 }}>
                        Verifying beta access for {shortenAddress(walletAddress)}...
                    </div>
                )}

                {walletStatus === 'connected' && accessStatus === 'denied' && (
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <p style={{ color: '#ef4444' }}>Beta access required for this page.</p>
                        <Link href="/profile" className="btn-pixel btn-pixel-secondary" style={{ width: 'fit-content' }}>
                            Back To Profile
                        </Link>
                    </div>
                )}

                {walletStatus === 'connected' && accessStatus === 'error' && (
                    <div className="card" style={{ color: '#ef4444', padding: 20 }}>
                        {accessError}
                    </div>
                )}

                {walletStatus === 'connected' && accessStatus === 'granted' && (
                    <form onSubmit={handleLaunch} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <p className="font-mono" style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Connected: {shortenAddress(walletAddress)}
                        </p>

                        <input
                            required
                            type="text"
                            placeholder="App Name"
                            value={launchForm.name}
                            onChange={e => setLaunchForm(prev => ({ ...prev, name: e.target.value }))}
                            className="font-mono"
                            style={{ padding: '12px', background: '#13131f', border: '1px solid #1e1e30', color: '#e2e8f0' }}
                        />

                        <input
                            required
                            type="text"
                            placeholder="Ticker Symbol"
                            value={launchForm.symbol}
                            onChange={e => setLaunchForm(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                            className="font-mono"
                            style={{ padding: '12px', background: '#13131f', border: '1px solid #1e1e30', color: '#e2e8f0', textTransform: 'uppercase' }}
                        />

                        <select
                            required
                            value={launchForm.category}
                            onChange={e => setLaunchForm(prev => ({ ...prev, category: e.target.value }))}
                            className="font-mono"
                            style={{ padding: '12px', background: '#13131f', border: '1px solid #1e1e30', color: '#e2e8f0' }}
                        >
                            <option value="" disabled>Select Category</option>
                            {PROJECT_CATEGORY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>

                        <input
                            required
                            type="url"
                            placeholder="Metadata URI"
                            value={launchForm.uri}
                            onChange={e => setLaunchForm(prev => ({ ...prev, uri: e.target.value }))}
                            className="font-mono"
                            style={{ padding: '12px', background: '#13131f', border: '1px solid #1e1e30', color: '#e2e8f0' }}
                        />

                        <input
                            type="url"
                            placeholder="Logo URL"
                            value={launchForm.logoUrl}
                            onChange={e => setLaunchForm(prev => ({ ...prev, logoUrl: e.target.value }))}
                            className="font-mono"
                            style={{ padding: '12px', background: '#13131f', border: '1px solid #1e1e30', color: '#e2e8f0' }}
                        />

                        {launchError && (
                            <div className="font-mono" style={{ color: '#ef4444', fontSize: '0.8rem' }}>
                                {launchError}
                            </div>
                        )}

                        {launchSuccess && (
                            <div className="font-mono" style={{ color: '#06d6a0', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                                Tx: {launchSuccess}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLaunching}
                            className="btn-pixel btn-pixel-secondary"
                            style={{ width: 'fit-content', opacity: isLaunching ? 0.6 : 1 }}
                        >
                            {isLaunching ? 'Launching...' : 'Launch Token'}
                        </button>
                    </form>
                )}
            </main>

            <Footer />
        </div>
    );
}
