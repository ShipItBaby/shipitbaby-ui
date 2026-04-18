'use client';

import { useState } from 'react';
import { isValidEmailInput, sanitizeEmailInput } from '@/lib/email';

export default function BetaSignupCard({
    title = 'Coming soon.',
    subtitle = 'Join beta for early access.',
    placeholder = 'you@example.com',
    buttonLabel = 'Join beta',
    onSubmit,
    isSubmitting = false,
    feedback = '',
    feedbackTone = 'muted',
}) {
    const [localError, setLocalError] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;

        if (typeof onSubmit !== 'function') return;

        const formData = new FormData(form);
        const rawEmail = String(formData.get('email') || '');
        const email = sanitizeEmailInput(rawEmail);
        if (!isValidEmailInput(email)) {
            setLocalError('Enter a valid email address.');
            return;
        }

        setLocalError('');
        const emailField = form.elements.namedItem('email');
        if (emailField && 'value' in emailField) {
            emailField.value = email;
        }

        try {
            const submitted = await onSubmit(email);
            if (submitted === true) {
                form.reset();
            }
        } catch (error) {
            setLocalError(error?.message || 'Could not submit email.');
        }
    };

    const feedbackColor = feedbackTone === 'error'
        ? '#ef4444'
        : feedbackTone === 'success'
            ? '#06d6a0'
            : '#64748b';

    return (
        <div style={{
            width: '100%',
            maxWidth: 420,
            padding: 24,
            border: '1px solid #1e1e30',
            background: 'linear-gradient(180deg, rgba(19, 19, 31, 0.96) 0%, rgba(10, 10, 15, 0.96) 100%)',
        }}>
            <p className="font-pixel" style={{
                fontSize: 'clamp(2rem, 4vw, 3.2rem)',
                lineHeight: 1.05,
                color: '#e2e8f0',
                margin: 0,
            }}>
                {title}
            </p>
            <p className="font-mono" style={{
                marginTop: 12,
                fontSize: '0.95rem',
                color: '#64748b',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
            }}>
                {subtitle}
            </p>

            <form onSubmit={handleSubmit} style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input
                    type="email"
                    name="email"
                    required
                    placeholder={placeholder}
                    aria-label="Email address"
                    disabled={isSubmitting}
                    onChange={() => {
                        if (localError) setLocalError('');
                    }}
                    style={{
                        flex: '1 1 220px',
                        minWidth: 0,
                        height: 44,
                        padding: '0 12px',
                        border: '1px solid #334155',
                        background: '#0f172a',
                        color: '#e2e8f0',
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: '0.92rem',
                        outline: 'none',
                    }}
                />
                <button
                    type="submit"
                    className="btn-pixel btn-pixel-primary"
                    disabled={isSubmitting}
                    style={{
                        height: 44,
                        padding: '0 18px',
                        opacity: isSubmitting ? 0.75 : 1,
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    }}
                >
                    {isSubmitting ? 'Submitting...' : buttonLabel}
                </button>
            </form>
            {localError && (
                <p className="font-mono" style={{ marginTop: 12, fontSize: '0.82rem', color: '#ef4444' }}>
                    {localError}
                </p>
            )}
            {!localError && feedback && (
                <p className="font-mono" style={{ marginTop: 12, fontSize: '0.82rem', color: feedbackColor }}>
                    {feedback}
                </p>
            )}
        </div>
    );
}
