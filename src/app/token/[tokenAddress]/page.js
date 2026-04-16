'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { AnchorProvider, BN, Program } from '@coral-xyz/anchor';
import {
    Connection,
    PublicKey,
    SystemProgram,
} from '@solana/web3.js';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ensureWalletSession } from '@/lib/walletAuthClient';

const DEVNET_RPC = 'https://api.devnet.solana.com';
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const GLOBAL_CONFIG_SEED = new TextEncoder().encode('global-config');
const FEE_VAULT_SEED = new TextEncoder().encode('fee-vault');
const BONDING_CURVE_SEED = new TextEncoder().encode('bonding-curve');
const BUY_DIRECTION = 0;
const SELL_DIRECTION = 1;
const SOL_DECIMALS = 9;
const U64_MAX = BigInt('18446744073709551615');
const TOKEN_DECIMALS_RETRY_ATTEMPTS = 6;
const TOKEN_DECIMALS_RETRY_DELAY_MS = 1200;
const BPS_DENOMINATOR = 10_000n;
const TOTAL_TRADE_FEE_BPS = 75n;
const SLIPPAGE_OPTIONS = [
    { label: '0.5%', bps: 50 },
    { label: '1%', bps: 100 },
    { label: '2%', bps: 200 },
    { label: '5%', bps: 500 },
];

const SHORT_ADDRESS_START = 4;
const SHORT_ADDRESS_END = 4;

function shortenAddress(address) {
    if (!address) return '';
    return `${address.slice(0, SHORT_ADDRESS_START)}...${address.slice(-SHORT_ADDRESS_END)}`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatUnits(rawAmount, decimals, maxFractionDigits = 6) {
    const raw = BigInt(rawAmount);
    if (decimals === 0) return raw.toString();

    const divisor = 10n ** BigInt(decimals);
    const whole = raw / divisor;
    const fraction = raw % divisor;

    if (fraction === 0n) return whole.toString();

    const fractionFull = fraction.toString().padStart(decimals, '0');
    const clipped = fractionFull.slice(0, Math.min(decimals, maxFractionDigits));
    const trimmed = clipped.replace(/0+$/, '');

    if (!trimmed) return whole.toString();
    return `${whole.toString()}.${trimmed}`;
}

function deriveSwapAccounts(programId, user, tokenMint) {
    const [globalConfig] = PublicKey.findProgramAddressSync(
        [GLOBAL_CONFIG_SEED],
        programId
    );
    const [feeVault] = PublicKey.findProgramAddressSync(
        [FEE_VAULT_SEED],
        programId
    );
    const [bondingCurve] = PublicKey.findProgramAddressSync(
        [BONDING_CURVE_SEED, tokenMint.toBytes()],
        programId
    );
    const [curveTokenAccount] = PublicKey.findProgramAddressSync(
        [bondingCurve.toBytes(), TOKEN_PROGRAM_ID.toBytes(), tokenMint.toBytes()],
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const [userTokenAccount] = PublicKey.findProgramAddressSync(
        [user.toBytes(), TOKEN_PROGRAM_ID.toBytes(), tokenMint.toBytes()],
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    return {
        globalConfig,
        feeVault,
        bondingCurve,
        curveTokenAccount,
        userTokenAccount,
    };
}

function toBigIntValue(value) {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(value);
    if (typeof value === 'string') return BigInt(value);
    if (value && typeof value.toString === 'function') return BigInt(value.toString());
    return null;
}

function readCurveFieldAsBigInt(curveAccount, keys) {
    for (const key of keys) {
        if (key in curveAccount) {
            const asBigInt = toBigIntValue(curveAccount[key]);
            if (asBigInt !== null) return asBigInt;
        }
    }
    return null;
}

function decimalToU64Units(value, decimals, fieldName) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '.') {
        throw new Error(`${fieldName} is required`);
    }
    if (!/^\d*(\.\d*)?$/.test(trimmed)) {
        throw new Error(`${fieldName} must be a valid number`);
    }

    const [wholeRaw, fractionalRaw = ''] = trimmed.split('.');
    const whole = wholeRaw || '0';
    const fractional = fractionalRaw || '';

    if (fractional.length > decimals) {
        throw new Error(`${fieldName} supports up to ${decimals} decimals`);
    }

    const combined = `${whole}${fractional.padEnd(decimals, '0')}`;
    const normalized = combined.replace(/^0+(?=\d)/, '') || '0';
    const asBigInt = BigInt(normalized);

    if (asBigInt <= 0n) {
        throw new Error(`${fieldName} must be greater than zero`);
    }
    if (asBigInt > U64_MAX) {
        throw new Error(`${fieldName} exceeds u64 limit`);
    }

    return normalized;
}

export default function TokenDetailsPage() {
    const params = useParams();
    const tokenAddress = typeof params?.tokenAddress === 'string' ? params.tokenAddress : '';

    const [walletAddress, setWalletAddress] = useState(null);
    const [walletType, setWalletType] = useState(null);
    const [walletStatus, setWalletStatus] = useState('checking');
    const [accessStatus, setAccessStatus] = useState('idle');
    const [accessError, setAccessError] = useState(null);
    const [programConfig, setProgramConfig] = useState(null);

    const [swapForm, setSwapForm] = useState({
        side: 'buy',
        amount: '',
    });
    const [slippageBps, setSlippageBps] = useState(100);
    const [tokenDecimals, setTokenDecimals] = useState(null);
    const [tokenMintStatus, setTokenMintStatus] = useState('idle');
    const [tokenMintError, setTokenMintError] = useState(null);
    const [walletTokenBalanceStatus, setWalletTokenBalanceStatus] = useState('idle');
    const [walletTokenBalanceError, setWalletTokenBalanceError] = useState(null);
    const [walletTokenBalanceParsed, setWalletTokenBalanceParsed] = useState('0');
    const [walletSolBalanceStatus, setWalletSolBalanceStatus] = useState('idle');
    const [walletSolBalanceError, setWalletSolBalanceError] = useState(null);
    const [walletSolBalanceParsed, setWalletSolBalanceParsed] = useState('0');
    const [isSwapping, setIsSwapping] = useState(false);
    const [swapError, setSwapError] = useState(null);
    const [swapTx, setSwapTx] = useState(null);
    const [quoteStatus, setQuoteStatus] = useState('idle');
    const [quoteError, setQuoteError] = useState(null);
    const [quoteOutRaw, setQuoteOutRaw] = useState(null);
    const quoteRequestIdRef = useRef(0);

    const validTokenAddress = useMemo(() => {
        try {
            return new PublicKey(tokenAddress).toBase58();
        } catch {
            return null;
        }
    }, [tokenAddress]);

    const getWalletProvider = useCallback(() => {
        if (walletType === 'phantom') return window?.solana;
        if (walletType === 'solflare') return window?.solflare;
        return null;
    }, [walletType]);

    const amountPreview = useMemo(() => {
        if (!swapForm.amount) return null;

        try {
            const decimals = swapForm.side === 'buy' ? SOL_DECIMALS : tokenDecimals;
            if (decimals === null) return null;
            return decimalToU64Units(
                swapForm.amount,
                decimals,
                swapForm.side === 'buy' ? 'SOL amount' : 'Token amount'
            );
        } catch {
            return null;
        }
    }, [swapForm.amount, swapForm.side, tokenDecimals]);

    const quoteOutDisplay = useMemo(() => {
        if (quoteStatus !== 'ready' || !quoteOutRaw) return null;

        const isBuy = swapForm.side === 'buy';
        const outDecimals = isBuy ? tokenDecimals : SOL_DECIMALS;
        if (outDecimals === null) return null;

        return formatUnits(quoteOutRaw, outDecimals, 6);
    }, [quoteOutRaw, quoteStatus, swapForm.side, tokenDecimals]);

    const minOutRaw = useMemo(() => {
        if (quoteStatus !== 'ready' || !quoteOutRaw) return null;

        const quote = BigInt(quoteOutRaw);
        const denominator = 10_000n;
        const bps = BigInt(slippageBps);
        if (bps >= denominator) return '0';

        const minOut = (quote * (denominator - bps)) / denominator;
        return minOut.toString();
    }, [quoteOutRaw, quoteStatus, slippageBps]);

    const minOutDisplay = useMemo(() => {
        if (!minOutRaw) return null;
        const isBuy = swapForm.side === 'buy';
        const outDecimals = isBuy ? tokenDecimals : SOL_DECIMALS;
        if (outDecimals === null) return null;

        return formatUnits(minOutRaw, outDecimals, 6);
    }, [minOutRaw, swapForm.side, tokenDecimals]);

    useEffect(() => {
        setTokenDecimals(null);
        setTokenMintStatus('idle');
        setTokenMintError(null);
        setWalletTokenBalanceStatus('idle');
        setWalletTokenBalanceError(null);
        setWalletTokenBalanceParsed('0');
        setWalletSolBalanceStatus('idle');
        setWalletSolBalanceError(null);
        setWalletSolBalanceParsed('0');
    }, [validTokenAddress]);

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
        if (!validTokenAddress) {
            setAccessStatus('error');
            setAccessError('Invalid token address');
            return;
        }

        if (walletStatus !== 'connected' || !walletAddress) return;

        let cancelled = false;

        async function verifyBeta() {
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

                setProgramConfig({
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

        verifyBeta();

        return () => {
            cancelled = true;
        };
    }, [getWalletProvider, validTokenAddress, walletAddress, walletStatus]);

    useEffect(() => {
        if (!validTokenAddress || accessStatus !== 'granted') return;
        if (tokenDecimals !== null) return;

        let cancelled = false;

        async function loadTokenDecimals() {
            setTokenDecimals(null);
            setTokenMintStatus('loading');
            setTokenMintError(null);

            const connection = new Connection(DEVNET_RPC, 'confirmed');
            const mint = new PublicKey(validTokenAddress);

            for (let attempt = 1; attempt <= TOKEN_DECIMALS_RETRY_ATTEMPTS; attempt += 1) {
                try {
                    const accountInfo = await connection.getParsedAccountInfo(mint, 'confirmed');
                    const account = accountInfo.value;

                    if (!account) {
                        if (attempt < TOKEN_DECIMALS_RETRY_ATTEMPTS) {
                            await sleep(TOKEN_DECIMALS_RETRY_DELAY_MS);
                            continue;
                        }

                        if (!cancelled) {
                            setTokenDecimals(null);
                            setTokenMintStatus('error');
                            setTokenMintError('Token mint not found on devnet');
                        }
                        return;
                    }

                    if (account.owner.toBase58() !== TOKEN_PROGRAM_ID.toBase58()) {
                        if (!cancelled) {
                            setTokenDecimals(null);
                            setTokenMintStatus('error');
                            setTokenMintError('Address is not a token mint for this launcher');
                        }
                        return;
                    }

                    const data = account.data;
                    const parsed = data && typeof data === 'object' && 'parsed' in data ? data.parsed : null;

                    if (!parsed || parsed.type !== 'mint') {
                        if (!cancelled) {
                            setTokenDecimals(null);
                            setTokenMintStatus('error');
                            setTokenMintError('Address is not a token mint');
                        }
                        return;
                    }

                    const decimals = parsed.info?.decimals;
                    if (!Number.isInteger(decimals)) {
                        if (!cancelled) {
                            setTokenDecimals(null);
                            setTokenMintStatus('error');
                            setTokenMintError('Unable to read token mint decimals');
                        }
                        return;
                    }

                    if (!cancelled) {
                        setTokenDecimals(decimals);
                        setTokenMintStatus('ready');
                    }
                    return;
                } catch {
                    if (attempt < TOKEN_DECIMALS_RETRY_ATTEMPTS) {
                        await sleep(TOKEN_DECIMALS_RETRY_DELAY_MS);
                        continue;
                    }

                    if (!cancelled) {
                        setTokenDecimals(null);
                        setTokenMintStatus('error');
                        setTokenMintError('Failed to validate token mint on devnet');
                    }
                }
            }
        }

        loadTokenDecimals();

        return () => {
            cancelled = true;
        };
    }, [accessStatus, tokenDecimals, validTokenAddress]);

    useEffect(() => {
        if (
            accessStatus !== 'granted'
            || tokenMintStatus !== 'ready'
            || !walletAddress
            || !validTokenAddress
        ) {
            setWalletTokenBalanceStatus('idle');
            setWalletTokenBalanceError(null);
            setWalletTokenBalanceParsed('0');
            return;
        }

        let cancelled = false;

        async function loadWalletTokenBalance() {
            setWalletTokenBalanceStatus('loading');
            setWalletTokenBalanceError(null);

            try {
                const connection = new Connection(DEVNET_RPC, 'confirmed');
                const user = new PublicKey(walletAddress);
                const tokenMint = new PublicKey(validTokenAddress);
                const [userTokenAccount] = PublicKey.findProgramAddressSync(
                    [user.toBytes(), TOKEN_PROGRAM_ID.toBytes(), tokenMint.toBytes()],
                    ASSOCIATED_TOKEN_PROGRAM_ID
                );

                let rawAmount = '0';
                let parsedAmount = '0';

                try {
                    const balance = await connection.getTokenAccountBalance(userTokenAccount, 'confirmed');
                    rawAmount = balance.value.amount;
                    parsedAmount = balance.value.uiAmountString ?? formatUnits(rawAmount, balance.value.decimals, 6);
                } catch (err) {
                    const msg = err?.message || '';
                    const missingAccount =
                        msg.includes('could not find account')
                        || msg.includes('Invalid param: could not find account')
                        || msg.includes('Account does not exist');

                    if (!missingAccount) {
                        throw err;
                    }
                }

                if (cancelled) return;

                setWalletTokenBalanceParsed(parsedAmount);
                setWalletTokenBalanceStatus('ready');
            } catch (err) {
                if (cancelled) return;
                setWalletTokenBalanceStatus('error');
                setWalletTokenBalanceError(err?.message || 'Failed to load wallet token balance');
            }
        }

        loadWalletTokenBalance();

        return () => {
            cancelled = true;
        };
    }, [accessStatus, tokenMintStatus, validTokenAddress, walletAddress, swapTx]);

    useEffect(() => {
        if (accessStatus !== 'granted' || !walletAddress) {
            setWalletSolBalanceStatus('idle');
            setWalletSolBalanceError(null);
            setWalletSolBalanceParsed('0');
            return;
        }

        let cancelled = false;

        async function loadWalletSolBalance() {
            setWalletSolBalanceStatus('loading');
            setWalletSolBalanceError(null);

            try {
                const connection = new Connection(DEVNET_RPC, 'confirmed');
                const lamports = await connection.getBalance(new PublicKey(walletAddress), 'confirmed');
                const parsed = formatUnits(lamports.toString(), SOL_DECIMALS, 6);

                if (cancelled) return;

                setWalletSolBalanceParsed(parsed);
                setWalletSolBalanceStatus('ready');
            } catch (err) {
                if (cancelled) return;
                setWalletSolBalanceStatus('error');
                setWalletSolBalanceError(err?.message || 'Failed to load wallet SOL balance');
            }
        }

        loadWalletSolBalance();

        return () => {
            cancelled = true;
        };
    }, [accessStatus, walletAddress, swapTx]);

    useEffect(() => {
        if (accessStatus !== 'granted' || tokenMintStatus !== 'ready' || !swapForm.amount.trim()) {
            setQuoteStatus('idle');
            setQuoteError(null);
            setQuoteOutRaw(null);
            return;
        }

        let cancelled = false;
        const requestId = quoteRequestIdRef.current + 1;
        quoteRequestIdRef.current = requestId;

        const timeoutId = setTimeout(async () => {
            try {
                setQuoteStatus('loading');
                setQuoteError(null);
                setQuoteOutRaw(null);

                if (!validTokenAddress) throw new Error('Invalid token address');
                if (!programConfig?.idl || !programConfig?.contractAddress) {
                    throw new Error('Program config is not loaded');
                }

                const walletProvider = getWalletProvider();
                if (!walletProvider) throw new Error('Wallet provider not found');

                const isBuy = swapForm.side === 'buy';
                const direction = isBuy ? BUY_DIRECTION : SELL_DIRECTION;
                const inputDecimals = isBuy ? SOL_DECIMALS : tokenDecimals;
                if (inputDecimals === null) throw new Error('Token decimals not loaded yet');

                const amount = decimalToU64Units(
                    swapForm.amount,
                    inputDecimals,
                    isBuy ? 'SOL amount' : 'Token amount'
                );

                const provider = new AnchorProvider(
                    new Connection(DEVNET_RPC, 'confirmed'),
                    walletProvider,
                    { preflightCommitment: 'confirmed' }
                );
                if (!provider.publicKey) throw new Error('Provider public key missing');

                const normalizedIdl = {
                    ...programConfig.idl,
                    address: programConfig.contractAddress,
                };
                const program = new Program(normalizedIdl, provider);

                const user = provider.publicKey;
                const tokenMint = new PublicKey(validTokenAddress);
                const swapAccounts = deriveSwapAccounts(program.programId, user, tokenMint);

                const curveAccount = await program.account.bondingCurve.fetch(swapAccounts.bondingCurve);
                const virtualTokenReserves = readCurveFieldAsBigInt(curveAccount, ['virtualTokenReserves', 'virtual_token_reserves']);
                const virtualSolReserves = readCurveFieldAsBigInt(curveAccount, ['virtualSolReserves', 'virtual_sol_reserves']);
                const realTokenReserves = readCurveFieldAsBigInt(curveAccount, ['realTokenReserves', 'real_token_reserves']);
                const realSolReserves = readCurveFieldAsBigInt(curveAccount, ['realSolReserves', 'real_sol_reserves']);

                if (
                    virtualTokenReserves === null
                    || virtualSolReserves === null
                    || realTokenReserves === null
                    || realSolReserves === null
                ) {
                    throw new Error('Failed to read bonding curve reserves');
                }

                const amountIn = BigInt(amount);
                let quoteOut = 0n;

                if (direction === BUY_DIRECTION) {
                    const totalFee = (amountIn * TOTAL_TRADE_FEE_BPS) / BPS_DENOMINATOR;
                    const amountInAfterFee = amountIn - totalFee;
                    if (amountInAfterFee <= 0n) {
                        throw new Error('Amount too low after fee');
                    }

                    const product = virtualSolReserves * virtualTokenReserves;
                    const newVirtualSol = virtualSolReserves + amountInAfterFee;
                    if (newVirtualSol <= 0n) {
                        throw new Error('Invalid curve state');
                    }
                    const newVirtualToken = product / newVirtualSol;
                    const tokensReceived = virtualTokenReserves - newVirtualToken;

                    if (tokensReceived <= 0n) {
                        throw new Error('Output too small');
                    }
                    if (tokensReceived > realTokenReserves) {
                        throw new Error('Amount too high for current token liquidity');
                    }

                    quoteOut = tokensReceived;
                } else {
                    const product = virtualSolReserves * virtualTokenReserves;
                    const newVirtualToken = virtualTokenReserves + amountIn;
                    if (newVirtualToken <= 0n) {
                        throw new Error('Invalid curve state');
                    }
                    const newVirtualSol = product / newVirtualToken;
                    const grossOut = virtualSolReserves - newVirtualSol;

                    if (grossOut <= 0n) {
                        throw new Error('Output too small');
                    }
                    if (grossOut > realSolReserves) {
                        throw new Error('Amount too high for current SOL liquidity');
                    }

                    const totalFee = (grossOut * TOTAL_TRADE_FEE_BPS) / BPS_DENOMINATOR;
                    const netOut = grossOut - totalFee;
                    if (netOut <= 0n) {
                        throw new Error('Output too small after fee');
                    }

                    quoteOut = netOut;
                }

                if (cancelled || requestId !== quoteRequestIdRef.current) return;
                setQuoteOutRaw(quoteOut.toString());
                setQuoteStatus('ready');
            } catch (err) {
                if (cancelled || requestId !== quoteRequestIdRef.current) return;
                setQuoteStatus('error');
                setQuoteOutRaw(null);
                setQuoteError(err?.message || 'Failed to calculate quote');
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [
        accessStatus,
        getWalletProvider,
        programConfig,
        swapForm.amount,
        swapForm.side,
        tokenDecimals,
        tokenMintStatus,
        validTokenAddress,
    ]);

    async function handleSwap(event) {
        event.preventDefault();
        if (isSwapping) return;

        setIsSwapping(true);
        setSwapError(null);
        setSwapTx(null);

        try {
            if (!validTokenAddress) throw new Error('Invalid token address');
            if (!programConfig?.idl || !programConfig?.contractAddress) {
                throw new Error('Program config is not loaded');
            }
            if (tokenMintStatus !== 'ready') {
                throw new Error(tokenMintError || 'Token mint is not ready yet');
            }
            if (quoteStatus !== 'ready' || !quoteOutRaw || !minOutRaw) {
                throw new Error('Quote is not ready yet');
            }

            const isBuy = swapForm.side === 'buy';
            const direction = isBuy ? BUY_DIRECTION : SELL_DIRECTION;
            const decimals = isBuy ? SOL_DECIMALS : tokenDecimals;
            if (!isBuy && decimals === null) {
                throw new Error('Token decimals not loaded yet');
            }

            const amount = decimalToU64Units(
                swapForm.amount,
                decimals,
                isBuy ? 'SOL amount' : 'Token amount'
            );

            const walletProvider = getWalletProvider();
            if (!walletProvider) throw new Error('Wallet provider not found');

            const connection = new Connection(DEVNET_RPC, 'confirmed');
            const provider = new AnchorProvider(
                connection,
                walletProvider,
                { preflightCommitment: 'confirmed' }
            );
            if (!provider.publicKey) throw new Error('Provider public key missing');

            const normalizedIdl = {
                ...programConfig.idl,
                address: programConfig.contractAddress,
            };
            const program = new Program(normalizedIdl, provider);

            const user = provider.publicKey;
            const tokenMint = new PublicKey(validTokenAddress);
            const swapAccounts = deriveSwapAccounts(program.programId, user, tokenMint);

            const tx = await program.methods
                .swap(new BN(amount), direction, new BN(minOutRaw))
                .accounts({
                    user,
                    globalConfig: swapAccounts.globalConfig,
                    feeVault: swapAccounts.feeVault,
                    bondingCurve: swapAccounts.bondingCurve,
                    tokenMint,
                    curveTokenAccount: swapAccounts.curveTokenAccount,
                    userTokenAccount: swapAccounts.userTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc({
                    skipPreflight: true,
                    commitment: 'confirmed',
                    maxRetries: 5,
                });

            setSwapTx(tx);
        } catch (err) {
            const msg = err?.message || 'Swap failed';
            if (msg.includes('already been processed')) {
                setSwapError('Transaction already processed. Check wallet activity or explorer for the signature.');
            } else {
                setSwapError(msg);
            }
        } finally {
            setIsSwapping(false);
        }
    }

    return (
        <div className="grid-bg scanlines" style={{ minHeight: '100vh', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <Navbar />

            <main style={{ flex: 1, padding: '80px 32px', maxWidth: 820, margin: '0 auto', width: '100%' }}>
                <h1 className="font-pixel" style={{ fontSize: '2.2rem', color: '#e2e8f0', marginBottom: 12 }}>
                    Token
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
                        <p style={{ color: '#e2e8f0' }}>Connect a wallet first to view token page.</p>
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
                        <Link href="/token" className="btn-pixel btn-pixel-secondary" style={{ width: 'fit-content' }}>
                            Back To Launch
                        </Link>
                    </div>
                )}

                {walletStatus === 'connected' && accessStatus === 'error' && (
                    <div className="card" style={{ color: '#ef4444', padding: 20 }}>
                        {accessError}
                    </div>
                )}

                {walletStatus === 'connected' && accessStatus === 'granted' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 24 }}>
                            <p className="font-mono" style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Deployed token mint
                            </p>
                            <p className="font-mono" style={{ color: '#e2e8f0', fontSize: '0.95rem', wordBreak: 'break-all' }}>
                                {validTokenAddress}
                            </p>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <Link href="/token" className="btn-pixel btn-pixel-secondary">
                                    Launch Another
                                </Link>
                                <a
                                    href={`https://solscan.io/token/${validTokenAddress}?cluster=devnet`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-pixel btn-pixel-primary"
                                >
                                    View On Solscan
                                </a>
                            </div>
                        </div>

                        <form onSubmit={handleSwap} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24 }}>
                            <p className="font-mono" style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Swap
                            </p>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                    type="button"
                                    onClick={() => setSwapForm(prev => ({ ...prev, side: 'buy' }))}
                                    className="btn-pixel"
                                    style={{
                                        background: swapForm.side === 'buy' ? '#06d6a0' : 'transparent',
                                        color: swapForm.side === 'buy' ? '#0a0a0f' : '#06d6a0',
                                        border: '1px solid #06d6a0',
                                        boxShadow: 'none',
                                    }}
                                >
                                    Buy Token
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSwapForm(prev => ({ ...prev, side: 'sell' }))}
                                    className="btn-pixel"
                                    style={{
                                        background: swapForm.side === 'sell' ? '#ef4444' : 'transparent',
                                        color: swapForm.side === 'sell' ? '#0a0a0f' : '#ef4444',
                                        border: '1px solid #ef4444',
                                        boxShadow: 'none',
                                    }}
                                >
                                    Sell Token
                                </button>
                            </div>

                            <input
                                required
                                type="text"
                                placeholder={swapForm.side === 'buy' ? 'Amount in SOL' : 'Amount in token'}
                                value={swapForm.amount}
                                onChange={e => setSwapForm(prev => ({ ...prev, amount: e.target.value }))}
                                className="font-mono"
                                style={{ padding: '12px', background: '#13131f', border: '1px solid #1e1e30', color: '#e2e8f0' }}
                            />

                            {tokenMintStatus === 'loading' && (
                                <p className="font-mono" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                    Checking token mint on devnet...
                                </p>
                            )}

                            {tokenMintStatus === 'error' && tokenMintError && (
                                <p className="font-mono" style={{ fontSize: '0.72rem', color: '#ef4444' }}>
                                    {tokenMintError}
                                </p>
                            )}


                            {walletTokenBalanceStatus === 'loading' && (
                                <p className="font-mono" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                    Loading wallet token balance...
                                </p>
                            )}

                            {walletTokenBalanceStatus === 'ready' && (
                                <p className="font-mono" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                    Wallet token balance: {walletTokenBalanceParsed}
                                </p>
                            )}

                            {walletTokenBalanceStatus === 'error' && walletTokenBalanceError && (
                                <p className="font-mono" style={{ fontSize: '0.72rem', color: '#ef4444' }}>
                                    {walletTokenBalanceError}
                                </p>
                            )}

                            {walletSolBalanceStatus === 'loading' && (
                                <p className="font-mono" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                    Loading wallet SOL balance...
                                </p>
                            )}

                            {walletSolBalanceStatus === 'ready' && (
                                <p className="font-mono" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                    Wallet SOL balance: {walletSolBalanceParsed}
                                </p>
                            )}

                            {walletSolBalanceStatus === 'error' && walletSolBalanceError && (
                                <p className="font-mono" style={{ fontSize: '0.72rem', color: '#ef4444' }}>
                                    {walletSolBalanceError}
                                </p>
                            )}

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span className="font-mono" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                    Slippage
                                </span>
                                {SLIPPAGE_OPTIONS.map(option => (
                                    <button
                                        key={option.bps}
                                        type="button"
                                        onClick={() => setSlippageBps(option.bps)}
                                        className="font-mono"
                                        style={{
                                            padding: '5px 10px',
                                            fontSize: '0.72rem',
                                            border: `1px solid ${slippageBps === option.bps ? '#06d6a0' : '#334155'}`,
                                            background: slippageBps === option.bps ? 'rgba(6,214,160,0.12)' : 'transparent',
                                            color: slippageBps === option.bps ? '#06d6a0' : '#94a3b8',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>


                            {quoteStatus === 'loading' && (
                                <p className="font-mono" style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                    Calculating quote...
                                </p>
                            )}

                            {quoteStatus === 'ready' && quoteOutDisplay && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div
                                        className="font-mono"
                                        style={{
                                            fontSize: '0.82rem',
                                            color: '#06d6a0',
                                            border: '1px solid rgba(6,214,160,0.35)',
                                            background: 'rgba(6,214,160,0.06)',
                                            padding: '10px 12px',
                                        }}
                                    >
                                        You receive ≈ {quoteOutDisplay} {swapForm.side === 'buy' ? 'TOKEN' : 'SOL'}
                                    </div>
                                    {minOutDisplay && (
                                        <div
                                            className="font-mono"
                                            style={{
                                                fontSize: '0.78rem',
                                                color: '#94a3b8',
                                                border: '1px solid #334155',
                                                background: 'rgba(51,65,85,0.12)',
                                                padding: '8px 12px',
                                            }}
                                        >
                                            Minimum received ({(slippageBps / 100).toFixed(2)}% slippage): {minOutDisplay} {swapForm.side === 'buy' ? 'TOKEN' : 'SOL'}
                                        </div>
                                    )}
                                </div>
                            )}

                            {quoteStatus === 'error' && quoteError && (
                                <p className="font-mono" style={{ fontSize: '0.72rem', color: '#ef4444' }}>
                                    {quoteError}
                                </p>
                            )}

                            {swapError && (
                                <div className="font-mono" style={{ color: '#ef4444', fontSize: '0.8rem', wordBreak: 'break-word' }}>
                                    {swapError}
                                </div>
                            )}

                            {swapTx && (
                                <div className="font-mono" style={{ color: '#06d6a0', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                                    Swap tx: {swapTx}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSwapping || tokenMintStatus !== 'ready' || quoteStatus !== 'ready' || !minOutRaw}
                                className="btn-pixel btn-pixel-secondary"
                                style={{
                                    width: 'fit-content',
                                    opacity: (isSwapping || tokenMintStatus !== 'ready' || quoteStatus !== 'ready' || !minOutRaw) ? 0.6 : 1,
                                }}
                            >
                                {isSwapping ? 'Swapping...' : swapForm.side === 'buy' ? 'Buy' : 'Sell'}
                            </button>
                        </form>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
