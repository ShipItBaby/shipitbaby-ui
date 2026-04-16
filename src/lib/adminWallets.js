export function getAdminWalletAllowlist() {
    const raw = process.env.SHIPIT_ADMIN_WALLET || '';
    return raw
        .split(',')
        .map((wallet) => wallet.trim())
        .filter(Boolean);
}

export function isAdminWallet(wallet) {
    if (!wallet || typeof wallet !== 'string') return false;
    const allowlist = getAdminWalletAllowlist();
    return allowlist.includes(wallet.trim());
}
