export const metadata = {
    title: 'FAQ',
    description:
        'Everything you need to know about ShipIt — how it works, fee structure, what builders earn, and how to launch your app as a tradable Solana token.',

    alternates: {
        canonical: '/faq',
    },

    openGraph: {
        type: 'website',
        url: 'https://shipit.baby/faq',
        title: 'FAQ | ShipIt',
        description:
            'Free to launch. 0.75% trade fee. Builders earn 0.25% of every trade. Learn how ShipIt works.',
    },

    twitter: {
        card: 'summary_large_image',
        title: 'FAQ | ShipIt',
        description:
            'Free to launch. 0.75% trade fee. Builders earn 0.25% of every trade. Learn how ShipIt works.',
    },
};

export default function FAQLayout({ children }) {
    return children;
}
