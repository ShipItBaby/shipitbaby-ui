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
import {
    createEmptySentimentCounts,
    normalizeSentiment,
    SENTIMENT_OPTIONS,
    toSentimentCounts,
} from '@/lib/projectSentiment';
import { getProjectCategoryTagStyle } from '@/lib/projectCategories';

const DEVNET_RPC = 'https://api.devnet.solana.com';
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const GLOBAL_CONFIG_SEED = new TextEncoder().encode('global-config');
const FEE_VAULT_SEED = new TextEncoder().encode('fee-vault');
const BONDING_CURVE_SEED = new TextEncoder().encode('bonding-curve');
const BUILDER_FEE_VAULT_SEED = new TextEncoder().encode('builder-fee-vault');
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

function toNonNullBigInt(value) {
    const asBigInt = toBigIntValue(value);
    return asBigInt === null ? 0n : asBigInt;
}

function isU64IntegerString(value) {
    return /^[0-9]+$/.test(value);
}

function formatLamportsToSol(lamportsLike, maxFractionDigits = 6) {
    const lamports = toNonNullBigInt(lamportsLike);
    return `${formatUnits(lamports.toString(), SOL_DECIMALS, maxFractionDigits)} SOL`;
}

function createEmptyBuilderClaimOverview() {
    return {
        initialized: false,
        builder: '',
        accruedBuilderFees: '0',
        builderFeeVaultLamports: '0',
        builderFeeVaultWithdrawable: '0',
        claimableBuilderFees: '0',
        totalClaimedBuilderFees: null,
        canWalletClaim: false,
    };
}

function deriveBuilderClaimAccounts(programId, tokenMint) {
    const [bondingCurve] = PublicKey.findProgramAddressSync(
        [BONDING_CURVE_SEED, tokenMint.toBytes()],
        programId
    );
    const [builderFeeVault] = PublicKey.findProgramAddressSync(
        [BUILDER_FEE_VAULT_SEED, tokenMint.toBytes()],
        programId
    );

    return {
        bondingCurve,
        builderFeeVault,
    };
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
    const { bondingCurve, builderFeeVault } = deriveBuilderClaimAccounts(programId, tokenMint);
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
        builderFeeVault,
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

const MATURITY_STAGE_ORDER = ['idea', 'proof', 'shipping', 'usage', 'graduated'];

function getStageTagClass(stage) {
    const normalizedStage = (stage || '').toLowerCase();
    if (normalizedStage === 'shipping') return 'tag-green';
    if (normalizedStage === 'proof') return 'tag-yellow';
    if (normalizedStage === 'idea') return 'tag-purple';
    if (normalizedStage === 'usage') return 'tag';
    if (normalizedStage === 'graduated') return 'tag-red';
    return 'tag';
}

function formatDateTime(value) {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';

    return new Intl.DateTimeFormat('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(parsed);
}

function formatCompactNumber(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatLaunchType(value) {
    if (!value || typeof value !== 'string') return 'open';
    const normalized = value.replaceAll('_', ' ').replaceAll('-', ' ').trim();
    if (!normalized) return 'open';
    return normalized;
}

function formatStageLabel(stage) {
    if (!stage || typeof stage !== 'string') return 'Unknown';
    return stage
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
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
    const [projectStatus, setProjectStatus] = useState('idle');
    const [projectError, setProjectError] = useState(null);
    const [projectRow, setProjectRow] = useState({ project: null, repo: null });
    const [sentimentCounts, setSentimentCounts] = useState(createEmptySentimentCounts);
    const [userSentiment, setUserSentiment] = useState(null);
    const [sentimentVoteStatus, setSentimentVoteStatus] = useState('idle');
    const [sentimentVoteError, setSentimentVoteError] = useState(null);
    const [showSentimentLoginPopup, setShowSentimentLoginPopup] = useState(false);

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
    const [builderClaimOverview, setBuilderClaimOverview] = useState(createEmptyBuilderClaimOverview);
    const [builderClaimStatus, setBuilderClaimStatus] = useState('idle');
    const [builderClaimError, setBuilderClaimError] = useState(null);
    const [builderClaimTx, setBuilderClaimTx] = useState(null);
    const [isClaimingBuilderFees, setIsClaimingBuilderFees] = useState(false);
    const [claimedSinceLoadLamports, setClaimedSinceLoadLamports] = useState('0');
    const quoteRequestIdRef = useRef(0);

    const validTokenAddress = useMemo(() => {
        try {
            return new PublicKey(tokenAddress).toBase58();
        } catch {
            return null;
        }
    }, [tokenAddress]);

    const project = projectRow.project;
    const repo = projectRow.repo;
    const projectLogoUrl = typeof project?.logo_url === 'string' ? project.logo_url.trim() : '';
    const hasProjectLogo = projectLogoUrl.length > 0;
    const tokenTicker = typeof project?.ticker === 'string' && project.ticker.trim().length > 0
        ? project.ticker.trim().toUpperCase()
        : 'TOKEN';

    const projectStageTagClass = useMemo(
        () => getStageTagClass(project?.stage),
        [project?.stage]
    );
    const projectCategoryTagStyle = useMemo(
        () => getProjectCategoryTagStyle(project?.category),
        [project?.category]
    );

    const repoCommitsCount = Number.isFinite(repo?.total_commits_count)
        ? repo.total_commits_count
        : 0;

    const reactionItems = useMemo(() => (
        SENTIMENT_OPTIONS.map((item) => ({
            ...item,
            count: sentimentCounts[item.key] ?? 0,
            isSelected: userSentiment === item.key,
        }))
    ), [sentimentCounts, userSentiment]);

    const getWalletProvider = useCallback(() => {
        if (walletType === 'phantom') return window?.solana;
        if (walletType === 'solflare') return window?.solflare;
        return null;
    }, [walletType]);

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

    const canClaimBuilderFees = useMemo(() => {
        if (builderClaimStatus !== 'ready') return false;
        if (!builderClaimOverview.initialized || !builderClaimOverview.canWalletClaim) return false;
        if (isClaimingBuilderFees) return false;

        try {
            return BigInt(builderClaimOverview.claimableBuilderFees) > 0n;
        } catch {
            return false;
        }
    }, [
        builderClaimOverview.canWalletClaim,
        builderClaimOverview.claimableBuilderFees,
        builderClaimOverview.initialized,
        builderClaimStatus,
        isClaimingBuilderFees,
    ]);
    const showBuilderFeesPanel = builderClaimOverview.canWalletClaim;

    useEffect(() => {
        setProjectStatus('idle');
        setProjectError(null);
        setProjectRow({ project: null, repo: null });
        setSentimentCounts(createEmptySentimentCounts());
        setUserSentiment(null);
        setSentimentVoteStatus('idle');
        setSentimentVoteError(null);
        setShowSentimentLoginPopup(false);
        setTokenDecimals(null);
        setTokenMintStatus('idle');
        setTokenMintError(null);
        setWalletTokenBalanceStatus('idle');
        setWalletTokenBalanceError(null);
        setWalletTokenBalanceParsed('0');
        setWalletSolBalanceStatus('idle');
        setWalletSolBalanceError(null);
        setWalletSolBalanceParsed('0');
        setBuilderClaimOverview(createEmptyBuilderClaimOverview());
        setBuilderClaimStatus('idle');
        setBuilderClaimError(null);
        setBuilderClaimTx(null);
        setIsClaimingBuilderFees(false);
        setClaimedSinceLoadLamports('0');
    }, [validTokenAddress]);

    const refreshBuilderClaimOverview = useCallback(async (options = {}) => {
        const { silent = false } = options;

        if (
            accessStatus !== 'granted'
            || !walletAddress
            || !validTokenAddress
            || !programConfig?.idl
            || !programConfig?.contractAddress
        ) {
            setBuilderClaimOverview(createEmptyBuilderClaimOverview());
            setBuilderClaimStatus('idle');
            setBuilderClaimError(null);
            return;
        }

        setBuilderClaimStatus('loading');
        if (!silent) {
            setBuilderClaimError(null);
            setBuilderClaimTx(null);
        }

        try {
            const walletProvider = getWalletProvider();
            if (!walletProvider) throw new Error('Wallet provider not found');

            const connection = new Connection(DEVNET_RPC, 'confirmed');
            const provider = new AnchorProvider(
                connection,
                walletProvider,
                { preflightCommitment: 'confirmed' }
            );

            const normalizedIdl = {
                ...programConfig.idl,
                address: programConfig.contractAddress,
            };
            const program = new Program(normalizedIdl, provider);
            const tokenMint = new PublicKey(validTokenAddress);
            const claimAccounts = deriveBuilderClaimAccounts(program.programId, tokenMint);

            const curveAccount = await program.account.bondingCurve.fetch(claimAccounts.bondingCurve);

            const builder = curveAccount.builder?.toBase58
                ? curveAccount.builder.toBase58()
                : String(curveAccount.builder || '');
            const accruedBuilderFees = toNonNullBigInt(
                curveAccount.accruedBuilderFees ?? curveAccount.accrued_builder_fees ?? 0
            );
            const totalClaimedBuilderFees = readCurveFieldAsBigInt(curveAccount, [
                'totalClaimedBuilderFees',
                'total_claimed_builder_fees',
                'claimedBuilderFees',
                'claimed_builder_fees',
                'builderFeesClaimed',
                'builder_fees_claimed',
            ]);

            const builderFeeVaultInfo = await connection.getAccountInfo(claimAccounts.builderFeeVault, 'confirmed');
            const builderFeeVaultLamports = toNonNullBigInt(builderFeeVaultInfo?.lamports ?? 0);
            const rentExemptMinimum = toNonNullBigInt(
                await connection.getMinimumBalanceForRentExemption(builderFeeVaultInfo?.data?.length ?? 0)
            );
            const builderFeeVaultWithdrawable =
                builderFeeVaultLamports > rentExemptMinimum
                    ? builderFeeVaultLamports - rentExemptMinimum
                    : 0n;
            const claimableBuilderFees =
                accruedBuilderFees < builderFeeVaultWithdrawable
                    ? accruedBuilderFees
                    : builderFeeVaultWithdrawable;
            const canWalletClaim = walletAddress === builder;

            setBuilderClaimOverview({
                initialized: true,
                builder,
                accruedBuilderFees: accruedBuilderFees.toString(),
                builderFeeVaultLamports: builderFeeVaultLamports.toString(),
                builderFeeVaultWithdrawable: builderFeeVaultWithdrawable.toString(),
                claimableBuilderFees: claimableBuilderFees.toString(),
                totalClaimedBuilderFees: totalClaimedBuilderFees === null ? null : totalClaimedBuilderFees.toString(),
                canWalletClaim,
            });
            setBuilderClaimStatus('ready');
        } catch (err) {
            setBuilderClaimStatus('error');
            if (!silent) {
                setBuilderClaimError(err?.message || 'Failed to load builder claim overview');
            }
        }
    }, [accessStatus, getWalletProvider, programConfig, validTokenAddress, walletAddress]);

    useEffect(() => {
        refreshBuilderClaimOverview({ silent: true });
    }, [refreshBuilderClaimOverview, swapTx, builderClaimTx]);

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

                const res = await fetch('/api/launch/idl', { cache: 'no-store' });
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
        if (!validTokenAddress || accessStatus !== 'granted') {
            setProjectStatus('idle');
            setProjectError(null);
            setProjectRow({ project: null, repo: null });
            setSentimentCounts(createEmptySentimentCounts());
            setUserSentiment(null);
            setSentimentVoteStatus('idle');
            setSentimentVoteError(null);
            return;
        }

        let cancelled = false;

        async function loadProjectDetails() {
            setProjectStatus('loading');
            setProjectError(null);

            try {
                const response = await fetch(`/api/projects/${encodeURIComponent(validTokenAddress)}`);
                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to load project details');
                }

                if (cancelled) return;

                setProjectRow({
                    project: data?.project || null,
                    repo: data?.repo || null,
                });
                setSentimentCounts(toSentimentCounts(data?.sentiment_counts));
                setUserSentiment(normalizeSentiment(data?.user_sentiment));
                setSentimentVoteStatus('idle');
                setSentimentVoteError(null);
                setProjectStatus('ready');
            } catch (err) {
                if (cancelled) return;
                setProjectStatus('error');
                setProjectError(err?.message || 'Failed to load project details');
            }
        }

        loadProjectDetails();

        return () => {
            cancelled = true;
        };
    }, [accessStatus, validTokenAddress]);

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
                    builderFeeVault: swapAccounts.builderFeeVault,
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

    async function handleClaimBuilderFees() {
        if (!canClaimBuilderFees) return;
        setIsClaimingBuilderFees(true);
        setBuilderClaimError(null);
        setBuilderClaimTx(null);

        try {
            const claimAmount = String(builderClaimOverview.claimableBuilderFees || '0');
            if (!isU64IntegerString(claimAmount) || claimAmount === '0') {
                throw new Error('No claimable builder fees available');
            }
            if (!validTokenAddress) {
                throw new Error('Invalid token address');
            }
            if (!programConfig?.idl || !programConfig?.contractAddress) {
                throw new Error('Program config is not loaded');
            }

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

            const tokenMint = new PublicKey(validTokenAddress);
            const claimAccounts = deriveBuilderClaimAccounts(program.programId, tokenMint);
            const tx = await program.methods
                .claimBuilderFees(new BN(claimAmount))
                .accounts({
                    builder: provider.publicKey,
                    tokenMint,
                    bondingCurve: claimAccounts.bondingCurve,
                    builderFeeVault: claimAccounts.builderFeeVault,
                    systemProgram: SystemProgram.programId,
                })
                .rpc({
                    skipPreflight: true,
                    preflightCommitment: 'confirmed',
                    commitment: 'confirmed',
                    maxRetries: 5,
                });

            setBuilderClaimTx(tx);
            setClaimedSinceLoadLamports((previous) => {
                try {
                    return (BigInt(previous || '0') + BigInt(claimAmount)).toString();
                } catch {
                    return previous || '0';
                }
            });
            await refreshBuilderClaimOverview({ silent: true });
        } catch (err) {
            setBuilderClaimError(err?.message || 'Claim failed');
        } finally {
            setIsClaimingBuilderFees(false);
        }
    }

    async function handleSentimentVote(nextSentiment) {
        const normalizedSentiment = normalizeSentiment(nextSentiment);
        if (!normalizedSentiment) return;
        if (!validTokenAddress) return;
        if (sentimentVoteStatus === 'submitting') return;

        setSentimentVoteStatus('submitting');
        setSentimentVoteError(null);

        try {
            const response = await fetch(`/api/projects/${encodeURIComponent(validTokenAddress)}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sentiment: normalizedSentiment }),
            });
            const data = await response.json().catch(() => ({}));

            if (response.status === 401) {
                setShowSentimentLoginPopup(true);
                setSentimentVoteStatus('idle');
                return;
            }

            if (!response.ok) {
                throw new Error(data?.error || 'Failed to submit sentiment vote');
            }

            setSentimentCounts(toSentimentCounts(data?.sentiment_counts));
            setUserSentiment(normalizeSentiment(data?.user_sentiment) || normalizedSentiment);
            setSentimentVoteStatus('idle');
        } catch (err) {
            setSentimentVoteStatus('idle');
            setSentimentVoteError(err?.message || 'Failed to submit sentiment vote');
        }
    }

    const claimableBuilderFeesSol = useMemo(
        () => formatLamportsToSol(builderClaimOverview.claimableBuilderFees, 6),
        [builderClaimOverview.claimableBuilderFees]
    );

    const totalClaimedBuilderFeesSol = useMemo(() => {
        if (builderClaimOverview.totalClaimedBuilderFees !== null) {
            return formatLamportsToSol(builderClaimOverview.totalClaimedBuilderFees, 6);
        }
        return formatLamportsToSol(claimedSinceLoadLamports, 6);
    }, [builderClaimOverview.totalClaimedBuilderFees, claimedSinceLoadLamports]);

    return (
        <div className="grid-bg scanlines" style={{ minHeight: '100vh', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <Navbar />

            <main style={{ flex: 1, padding: '80px 32px', maxWidth: 1240, margin: '0 auto', width: '100%' }}>
                <h1 className="font-pixel" style={{ fontSize: '2.2rem', color: '#e2e8f0', marginBottom: 12 }}>
                    {project?.ticker ? `$${project.ticker}` : 'Project'}
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
                    <div className="project-view-grid">
                        <section className="project-left-column">
                            {projectStatus === 'loading' && (
                                <div className="card" style={{ color: '#64748b', padding: 20 }}>
                                    Loading project details...
                                </div>
                            )}

                            {projectStatus === 'error' && (
                                <div className="card" style={{ color: '#ef4444', padding: 20 }}>
                                    {projectError}
                                </div>
                            )}

                            {projectStatus === 'ready' && !project && (
                                <div className="card" style={{ color: '#ef4444', padding: 20 }}>
                                    Project not found for this token.
                                </div>
                            )}

                            {projectStatus === 'ready' && project && (
                                <>
                                    <div
                                        className="card"
                                        style={{
                                            padding: 24,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 16,
                                            background: 'linear-gradient(180deg, rgba(16,16,30,0.96) 0%, rgba(12,14,26,0.96) 100%)',
                                            borderColor: '#26324a',
                                        }}
                                    >

                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', gap: 14, minWidth: 0, flex: 1 }}>
                                                <div
                                                    style={{
                                                        width: 84,
                                                        height: 84,
                                                        border: '1px solid #334155',
                                                        background: '#0f0f1a',
                                                        overflow: 'hidden',
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {hasProjectLogo ? (
                                                        <img
                                                            src={projectLogoUrl}
                                                            alt={`${project?.ticker || 'Project'} logo`}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                        />
                                                    ) : null}
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className="font-pixel" style={{ fontSize: '2.1rem', color: '#e2e8f0', lineHeight: 1 }}>
                                                        ${project.ticker || 'N/A'}
                                                    </div>
                                                    <p className="font-mono" style={{ color: '#94a3b8', fontSize: '0.92rem', marginTop: 8, lineHeight: 1.6 }}>
                                                        {project.short_description || 'No project description yet.'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                <span className={`tag ${projectStageTagClass}`}>
                                                    {project.stage || 'unknown'}
                                                </span>
                                                <span className={`tag ${project?.is_live ? 'tag-green' : 'tag-red'}`}>
                                                    {project?.is_live ? 'live' : 'not live'}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <span className="tag" style={projectCategoryTagStyle}>{project.category || 'uncategorized'}</span>
                                            <span className="tag" style={{ color: '#94a3b8', borderColor: '#334155' }}>
                                                {formatLaunchType(project.launch_type)}
                                            </span>
                                            <span className="tag" style={{ color: '#38bdf8', borderColor: '#38bdf8' }}>
                                                {repoCommitsCount} commits
                                            </span>
                                        </div>

                                        <div style={{ marginTop: 2, paddingTop: 12, borderTop: '1px solid #26324a', display: 'grid', gap: 8 }}>
                                            <div className="font-mono" style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                                                Repo: {repo?.url ? (
                                                    <a
                                                        href={repo.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: '#a78bfa', textDecoration: 'none', wordBreak: 'break-all' }}
                                                    >
                                                        {repo.url}
                                                    </a>
                                                ) : (
                                                    <span style={{ color: '#64748b' }}>—</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        <p className="font-mono" style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Community Sentiment
                                        </p>
                                        {sentimentVoteError && (
                                            <p className="font-mono" style={{ fontSize: '0.74rem', color: '#ef4444', marginTop: -2 }}>
                                                {sentimentVoteError}
                                            </p>
                                        )}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                                            {reactionItems.map((item) => (
                                                <button
                                                    key={item.label}
                                                    type="button"
                                                    disabled={sentimentVoteStatus === 'submitting'}
                                                    onClick={() => handleSentimentVote(item.key)}
                                                    style={{
                                                        border: item.isSelected ? `1px solid ${item.color}` : `1px solid ${item.color}44`,
                                                        background: '#0f0f1a',
                                                        padding: '9px 12px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: 10,
                                                        cursor: sentimentVoteStatus === 'submitting' ? 'not-allowed' : 'pointer',
                                                        opacity: sentimentVoteStatus === 'submitting' && !item.isSelected ? 0.7 : 1,
                                                    }}
                                                >
                                                    <span className="font-mono" style={{ fontSize: '0.78rem', color: item.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        {item.label}
                                                    </span>
                                                    <span className="font-pixel" style={{ fontSize: '1.2rem', color: '#e2e8f0' }}>
                                                        {item.count}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </section>

                        <aside className="project-right-column">
                            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 24 }}>
                                <p className="font-mono" style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    About
                                </p>
                                <div className="font-mono" style={{ display: 'grid', gap: 8, fontSize: '0.82rem', color: '#94a3b8' }}>
                                    <div style={{ wordBreak: 'break-all' }}>
                                        Metadata: {project?.metadata_link ? (
                                            <a
                                                href={project.metadata_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#a78bfa', textDecoration: 'none' }}
                                            >
                                                {project.metadata_link}
                                            </a>
                                        ) : '—'}
                                    </div>
                                    <div>Created: {formatDateTime(project?.created_at)}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                    <p className="font-mono" style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Swap
                                    </p>
                                    <label className="font-mono" style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        Slippage
                                        <select
                                            value={String(slippageBps)}
                                            onChange={(event) => {
                                                const next = Number.parseInt(event.target.value, 10);
                                                if (Number.isFinite(next)) {
                                                    setSlippageBps(next);
                                                }
                                            }}
                                            className="font-mono"
                                            style={{
                                                background: '#13131f',
                                                border: '1px solid #1e1e30',
                                                color: '#e2e8f0',
                                                padding: '6px 8px',
                                                fontSize: '0.72rem',
                                            }}
                                        >
                                            {SLIPPAGE_OPTIONS.map(option => (
                                                <option key={option.bps} value={option.bps}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <div style={{ border: '1px solid #1e1e30', background: '#0f0f1a', padding: 12, display: 'grid', gap: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                                        <span className="font-mono" style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                            You Pay
                                        </span>
                                        <span className="font-mono" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                            {swapForm.side === 'buy' ? `Balance: ${walletSolBalanceParsed} SOL` : `Balance: ${walletTokenBalanceParsed} ${tokenTicker}`}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <input
                                            required
                                            type="text"
                                            placeholder="0.0"
                                            value={swapForm.amount}
                                            onChange={e => setSwapForm(prev => ({ ...prev, amount: e.target.value }))}
                                            className="font-mono"
                                            style={{
                                                flex: 1,
                                                padding: '12px',
                                                background: '#13131f',
                                                border: '1px solid #1e1e30',
                                                color: '#e2e8f0',
                                                fontSize: '1rem',
                                            }}
                                        />
                                        <span
                                            className="font-mono"
                                            style={{
                                                padding: '7px 10px',
                                                border: '1px solid #334155',
                                                background: '#13131f',
                                                color: '#cbd5e1',
                                                fontSize: '0.75rem',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            {swapForm.side === 'buy' ? 'SOL' : tokenTicker}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <button
                                        type="button"
                                        onClick={() => setSwapForm(prev => ({ ...prev, side: prev.side === 'buy' ? 'sell' : 'buy' }))}
                                        className="font-mono"
                                        style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 999,
                                            border: '1px solid #334155',
                                            background: '#13131f',
                                            color: '#94a3b8',
                                            cursor: 'pointer',
                                            fontSize: '0.95rem',
                                            lineHeight: 1,
                                        }}
                                        aria-label="Switch swap direction"
                                    >
                                        ⇅
                                    </button>
                                </div>

                                <div style={{ border: '1px solid #1e1e30', background: '#0f0f1a', padding: 12, display: 'grid', gap: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                                        <span className="font-mono" style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                            You Receive
                                        </span>
                                        <span className="font-mono" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                            Est.
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <div
                                            className="font-mono"
                                            style={{
                                                flex: 1,
                                                padding: '12px',
                                                background: '#13131f',
                                                border: '1px solid #1e1e30',
                                                color: quoteOutDisplay ? '#e2e8f0' : '#64748b',
                                                fontSize: '1rem',
                                            }}
                                        >
                                            {quoteOutDisplay || '—'}
                                        </div>
                                        <span
                                            className="font-mono"
                                            style={{
                                                padding: '7px 10px',
                                                border: '1px solid #334155',
                                                background: '#13131f',
                                                color: '#cbd5e1',
                                                fontSize: '0.75rem',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            {swapForm.side === 'buy' ? tokenTicker : 'SOL'}
                                        </span>
                                    </div>
                                </div>

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

                                {walletSolBalanceStatus === 'error' && walletSolBalanceError && (
                                    <p className="font-mono" style={{ fontSize: '0.72rem', color: '#ef4444' }}>
                                        {walletSolBalanceError}
                                    </p>
                                )}

                                {quoteStatus === 'loading' && (
                                    <p className="font-mono" style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                        Calculating quote...
                                    </p>
                                )}

                                {quoteStatus === 'ready' && minOutDisplay && (
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
                                        Minimum received ({(slippageBps / 100).toFixed(2)}%): {minOutDisplay} {swapForm.side === 'buy' ? tokenTicker : 'SOL'}
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
                                        width: '100%',
                                        justifyContent: 'center',
                                        opacity: (isSwapping || tokenMintStatus !== 'ready' || quoteStatus !== 'ready' || !minOutRaw) ? 0.6 : 1,
                                    }}
                                >
                                    {isSwapping ? 'Swapping...' : 'Swap'}
                                </button>
                            </form>

                            {showBuilderFeesPanel && (
                                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
                                    <p className="font-mono" style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                        Builder Fees
                                    </p>

                                    {builderClaimStatus === 'loading' && (
                                        <p className="font-mono" style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            Loading builder fee state...
                                        </p>
                                    )}

                                    {builderClaimStatus === 'error' && builderClaimError && (
                                        <p className="font-mono" style={{ fontSize: '0.85rem', color: '#ef4444' }}>
                                            {builderClaimError}
                                        </p>
                                    )}

                                    {builderClaimStatus === 'ready' && (
                                        <>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                                                <div style={{ border: '1px solid rgba(6,214,160,0.45)', background: 'rgba(6,214,160,0.08)', padding: '14px 14px' }}>
                                                    <div className="font-mono" style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                                                        Available To Claim
                                                    </div>
                                                    <div className="font-pixel" style={{ fontSize: '2.2rem', color: '#06d6a0', lineHeight: 1 }}>
                                                        {claimableBuilderFeesSol}
                                                    </div>
                                                </div>
                                                <div style={{ border: '1px solid #334155', background: '#0f0f1a', padding: '14px 14px' }}>
                                                    <div className="font-mono" style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                                                        All-Time Claimed
                                                    </div>
                                                    <div className="font-pixel" style={{ fontSize: '2.2rem', color: '#e2e8f0', lineHeight: 1 }}>
                                                        {totalClaimedBuilderFeesSol}
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                disabled={!canClaimBuilderFees}
                                                onClick={handleClaimBuilderFees}
                                                className="btn-pixel btn-pixel-secondary"
                                                style={{
                                                    width: '100%',
                                                    justifyContent: 'center',
                                                    fontSize: '0.9rem',
                                                    opacity: canClaimBuilderFees ? 1 : 0.55,
                                                    cursor: canClaimBuilderFees ? 'pointer' : 'not-allowed',
                                                }}
                                            >
                                                {isClaimingBuilderFees ? 'Claiming...' : 'Claim Builder Fees'}
                                            </button>

                                            {builderClaimTx && (
                                                <div className="font-mono" style={{ color: '#06d6a0', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                                                    Builder claim tx: {builderClaimTx}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </aside>
                    </div>
                )}
            </main>

            {showSentimentLoginPopup && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        background: 'rgba(0,0,0,0.72)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 24,
                    }}
                    onClick={() => setShowSentimentLoginPopup(false)}
                >
                    <div
                        style={{
                            width: '100%',
                            maxWidth: 420,
                            background: '#0f0f1a',
                            border: '1px solid #1e1e30',
                            boxShadow: '8px 8px 0px rgba(0,0,0,0.45)',
                            padding: 24,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 14,
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <p className="font-pixel" style={{ margin: 0, fontSize: '1.45rem', color: '#e2e8f0' }}>
                            Login Required
                        </p>
                        <p className="font-mono" style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>
                            Connect your wallet to vote on community sentiment.
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <Link
                                href="/profile"
                                className="btn-pixel btn-pixel-secondary"
                                onClick={() => setShowSentimentLoginPopup(false)}
                            >
                                Go To Login
                            </Link>
                            <button
                                type="button"
                                className="btn-pixel"
                                onClick={() => setShowSentimentLoginPopup(false)}
                                style={{
                                    border: '1px solid #334155',
                                    color: '#cbd5e1',
                                    background: 'transparent',
                                    boxShadow: 'none',
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
}
