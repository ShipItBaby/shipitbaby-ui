'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const SOL_DECIMALS = 9;
const POLL_INTERVAL_MS = 5000;
const CHART_HEIGHT = 320;
const TIMEFRAME_OPTIONS = [
    { label: '5M', value: '5m' },
    { label: '1H', value: '1h' },
    { label: '6H', value: '6h' },
    { label: '1D', value: '1d' },
    { label: '1W', value: '1w' },
    { label: '1M', value: '1m' },
    { label: 'ALL', value: 'all' },
];
const TIMEFRAME_SECONDS = {
    '5m': 5 * 60,
    '1h': 60 * 60,
    '6h': 6 * 60 * 60,
    '1d': 24 * 60 * 60,
    '1w': 7 * 24 * 60 * 60,
    '1m': 30 * 24 * 60 * 60,
};
const TIMEFRAME_BUCKET_SECONDS = {
    '5m': 5,
    '1h': 60,
    '6h': 5 * 60,
    '1d': 15 * 60,
    '1w': 60 * 60,
    '1m': 4 * 60 * 60,
};
const ALL_TIMEFRAME_BUCKET_TARGET = 180;
const ALL_TIMEFRAME_BUCKET_CHOICES = [
    5,
    15,
    30,
    60,
    5 * 60,
    15 * 60,
    60 * 60,
    4 * 60 * 60,
    24 * 60 * 60,
    7 * 24 * 60 * 60,
];

function formatCompactPrice(value) {
    if (!Number.isFinite(value)) return '0';
    if (value === 0) return '0';

    return new Intl.NumberFormat('en-US', {
        maximumSignificantDigits: value < 0.0001 ? 4 : 6,
    }).format(value);
}

function formatTime(unixSeconds) {
    return new Intl.DateTimeFormat('en-GB', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date(unixSeconds * 1000));
}

function formatAxisTime(unixSeconds, timeframe) {
    const date = new Date(unixSeconds * 1000);

    if (timeframe === '5m' || timeframe === '1h' || timeframe === '6h' || timeframe === '1d') {
        return new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(date);
    }

    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
    }).format(date);
}

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function tradeToChartPoint(trade, tokenDecimals, sequence) {
    const virtualSolReserves = toNumber(trade?.virtual_sol_reserves);
    const virtualTokenReserves = toNumber(trade?.virtual_token_reserves);
    const eventTimestamp = toNumber(trade?.event_timestamp);
    const slot = toNumber(trade?.slot);
    const eventIndex = toNumber(trade?.event_index);

    if (
        virtualSolReserves === null
        || virtualTokenReserves === null
        || virtualTokenReserves <= 0
        || eventTimestamp === null
        || !Number.isInteger(tokenDecimals)
    ) {
        return null;
    }

    const solReserves = virtualSolReserves / (10 ** SOL_DECIMALS);
    const tokenReserves = virtualTokenReserves / (10 ** tokenDecimals);
    const value = solReserves / tokenReserves;

    if (!Number.isFinite(value) || value <= 0) return null;

    return {
        time: eventTimestamp,
        value,
        slot: slot ?? 0,
        eventIndex: eventIndex ?? 0,
        sequence,
        trade,
    };
}

function toChartData(trades, tokenDecimals) {
    const points = [];

    for (let index = 0; index < (trades || []).length; index += 1) {
        const point = tradeToChartPoint(trades[index], tokenDecimals, index);
        if (!point) continue;

        points.push(point);
    }

    return points.sort((a, b) => (
        a.time - b.time
        || a.slot - b.slot
        || a.eventIndex - b.eventIndex
        || a.sequence - b.sequence
    ));
}

function getTimeframeWindow(timeframe) {
    const timeframeSeconds = TIMEFRAME_SECONDS[timeframe];
    if (!timeframeSeconds) return null;

    const to = Math.floor(Date.now() / 1000);
    return {
        from: to - timeframeSeconds,
        to,
    };
}

function floorToBucket(time, bucketSeconds) {
    return Math.floor(time / bucketSeconds) * bucketSeconds;
}

function getBucketSeconds(timeframe, chartData, window) {
    const configuredBucketSeconds = TIMEFRAME_BUCKET_SECONDS[timeframe];
    if (configuredBucketSeconds) return configuredBucketSeconds;

    if (!chartData.length) {
        return ALL_TIMEFRAME_BUCKET_CHOICES[0];
    }

    const from = window?.from ?? chartData[0].time;
    const to = window?.to ?? chartData[chartData.length - 1].time;
    const duration = Math.max(to - from, 1);

    return ALL_TIMEFRAME_BUCKET_CHOICES.find(
        (bucketSeconds) => duration / bucketSeconds <= ALL_TIMEFRAME_BUCKET_TARGET
    ) || ALL_TIMEFRAME_BUCKET_CHOICES[ALL_TIMEFRAME_BUCKET_CHOICES.length - 1];
}

function toSeriesData(chartData, timeframe) {
    const window = getTimeframeWindow(timeframe);
    const bucketSeconds = getBucketSeconds(timeframe, chartData, window);
    const firstPoint = chartData[0] || null;
    const lastPoint = chartData[chartData.length - 1] || null;

    if (!window && (!firstPoint || !lastPoint)) return [];

    const rangeFrom = window?.from ?? firstPoint.time;
    const rangeTo = window?.to ?? lastPoint.time;
    const firstBucket = floorToBucket(rangeFrom, bucketSeconds);
    const lastBucket = floorToBucket(rangeTo, bucketSeconds);

    if (lastBucket < firstBucket) return [];

    const bucketByTime = new Map();
    let carriedValue = null;

    for (const point of chartData) {
        if (point.time < firstBucket) {
            carriedValue = point.value;
            continue;
        }
        if (point.time > rangeTo) break;

        const bucketTime = floorToBucket(point.time, bucketSeconds);
        if (bucketTime < firstBucket || bucketTime > lastBucket) continue;

        bucketByTime.set(bucketTime, point.value);
    }

    const seriesData = [];
    for (let bucketTime = firstBucket; bucketTime <= lastBucket; bucketTime += bucketSeconds) {
        if (bucketByTime.has(bucketTime)) {
            carriedValue = bucketByTime.get(bucketTime);
        }

        if (carriedValue === null) {
            seriesData.push({ time: bucketTime });
        } else {
            seriesData.push({ time: bucketTime, value: carriedValue });
        }
    }

    if (rangeTo > lastBucket && carriedValue !== null) {
        seriesData.push({ time: rangeTo, value: carriedValue });
    }

    return seriesData;
}

function countVisibleTrades(chartData, timeframe) {
    const window = getTimeframeWindow(timeframe);
    if (!window) return chartData.length;

    return chartData.filter((point) => point.time >= window.from && point.time <= window.to).length;
}

export default function ProjectTradeChart({ tokenAddress, tokenSymbol, tokenDecimals, refreshKey }) {
    const containerRef = useRef(null);
    const chartRef = useRef(null);
    const seriesRef = useRef(null);
    const tooltipRef = useRef(null);
    const [trades, setTrades] = useState([]);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);
    const [activeTimeframe, setActiveTimeframe] = useState('5m');

    const chartData = useMemo(
        () => toChartData(trades, tokenDecimals),
        [tokenDecimals, trades]
    );
    const latestPoint = chartData[chartData.length - 1] || null;
    const chartTitle = tokenSymbol ? `$${tokenSymbol} Price` : 'Price';
    const isWaitingForTokenDecimals = !Number.isInteger(tokenDecimals);
    const visibleTradeCount = countVisibleTrades(chartData, activeTimeframe);

    useEffect(() => {
        if (!tokenAddress) {
            setTrades([]);
            setStatus('idle');
            setError(null);
            return undefined;
        }

        let cancelled = false;
        let intervalId = null;
        let activeController = null;

        async function loadTrades(options = {}) {
            const { silent = false } = options;
            activeController?.abort();
            activeController = new AbortController();

            if (!silent) {
                setStatus('loading');
                setError(null);
            }

            try {
                const response = await fetch(
                    `/api/projects/${encodeURIComponent(tokenAddress)}/trades?limit=1000&timeframe=${encodeURIComponent(activeTimeframe)}`,
                    {
                        cache: 'no-store',
                        signal: activeController.signal,
                    }
                );
                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(data?.error || 'Failed to load trades');
                }

                if (cancelled) return;
                setTrades(Array.isArray(data?.trades) ? data.trades : []);
                setStatus('ready');
                setError(null);
            } catch (err) {
                if (cancelled || err?.name === 'AbortError') return;
                setStatus('error');
                setError(err?.message || 'Failed to load trades');
            }
        }

        loadTrades();
        intervalId = setInterval(() => {
            void loadTrades({ silent: true });
        }, POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            activeController?.abort();
            clearInterval(intervalId);
        };
    }, [activeTimeframe, refreshKey, tokenAddress]);

    useEffect(() => {
        if (!containerRef.current || chartRef.current) return undefined;

        let disposed = false;

        async function createTradeChart() {
            const {
                AreaSeries,
                ColorType,
                CrosshairMode,
                LineStyle,
                createChart,
            } = await import('lightweight-charts');

            if (disposed || !containerRef.current) return;

            const chart = createChart(containerRef.current, {
                height: CHART_HEIGHT,
                autoSize: true,
                layout: {
                    background: { type: ColorType.Solid, color: '#0f0f1a' },
                    textColor: '#64748b',
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 11,
                },
                grid: {
                    vertLines: { color: 'rgba(51, 65, 85, 0.18)' },
                    horzLines: { color: 'rgba(51, 65, 85, 0.18)' },
                },
                rightPriceScale: {
                    borderColor: '#1e1e30',
                    scaleMargins: { top: 0.12, bottom: 0.18 },
                },
                timeScale: {
                    borderColor: '#1e1e30',
                    timeVisible: true,
                    secondsVisible: false,
                },
                localization: {
                    timeFormatter: (time) => formatTime(time),
                },
                crosshair: {
                    mode: CrosshairMode.Normal,
                    vertLine: {
                        color: 'rgba(167, 139, 250, 0.34)',
                        width: 1,
                        style: LineStyle.Solid,
                        labelVisible: false,
                    },
                    horzLine: {
                        color: 'rgba(167, 139, 250, 0.22)',
                        width: 1,
                        style: LineStyle.Solid,
                        labelVisible: false,
                    },
                },
                handleScale: {
                    axisPressedMouseMove: false,
                },
            });

            const areaSeries = chart.addSeries(AreaSeries, {
                lineColor: '#06d6a0',
                lineWidth: 2,
                topColor: 'rgba(6, 214, 160, 0.28)',
                bottomColor: 'rgba(6, 214, 160, 0.02)',
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
                crosshairMarkerBorderColor: '#0f0f1a',
                crosshairMarkerBackgroundColor: '#06d6a0',
                priceFormat: {
                    type: 'price',
                    precision: 10,
                    minMove: 0.0000000001,
                },
            });

            chart.subscribeCrosshairMove((param) => {
                const tooltip = tooltipRef.current;
                const container = containerRef.current;
                if (!tooltip || !container || !param.point || !param.time) {
                    if (tooltip) tooltip.style.display = 'none';
                    return;
                }

                const seriesData = param.seriesData.get(areaSeries);
                if (!seriesData || !Number.isFinite(seriesData.value)) {
                    tooltip.style.display = 'none';
                    return;
                }

                const price = seriesData.value;
                tooltip.style.display = 'block';
                tooltip.innerHTML = `
                    <div>${formatCompactPrice(price)} SOL</div>
                    <div style="color:#64748b;font-size:0.72rem;margin-top:4px;">${formatTime(param.time)}</div>
                `;

                const tooltipWidth = 128;
                const tooltipHeight = 54;
                const left = Math.min(
                    Math.max(param.point.x + 12, 8),
                    container.clientWidth - tooltipWidth - 8
                );
                const top = Math.min(
                    Math.max(param.point.y - tooltipHeight - 10, 8),
                    CHART_HEIGHT - tooltipHeight - 8
                );

                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${top}px`;
            });

            chartRef.current = chart;
            seriesRef.current = areaSeries;
        }

        createTradeChart();

        return () => {
            disposed = true;
            chartRef.current?.remove();
            chartRef.current = null;
            seriesRef.current = null;
        };
    }, []);

    useEffect(() => {
        const chart = chartRef.current;
        const series = seriesRef.current;
        if (!chart || !series) return;

        series.setData(toSeriesData(chartData, activeTimeframe));
        chart.applyOptions({
            timeScale: {
                tickMarkFormatter: (time) => formatAxisTime(time, activeTimeframe),
            },
        });

        if (activeTimeframe === 'all') {
            if (chartData.length > 0) {
                chart.timeScale().fitContent();
            }
            return;
        }

        const window = getTimeframeWindow(activeTimeframe);
        if (window) {
            chart.timeScale().setVisibleRange({
                from: window.from,
                to: window.to,
            });
        } else if (chartData.length > 0) {
            chart.timeScale().fitContent();
        }
    }, [activeTimeframe, chartData]);

    return (
        <section className="card" style={{ padding: 0, overflow: 'hidden', background: '#0f0f1a', borderColor: '#26324a' }}>
            <div style={{ padding: '16px 18px 0 18px', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                    <p className="font-mono" style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {chartTitle}
                    </p>
                    <div className="font-pixel" style={{ marginTop: 6, fontSize: '2rem', color: '#e2e8f0', lineHeight: 1 }}>
                        {latestPoint
                            ? `${formatCompactPrice(latestPoint.value)} SOL`
                            : isWaitingForTokenDecimals
                                ? 'Loading'
                                : 'No trades'}
                    </div>
                </div>
                <div className="font-mono" style={{ fontSize: '0.72rem', color: status === 'error' ? '#ef4444' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {status === 'loading' || isWaitingForTokenDecimals ? 'Loading' : status === 'error' ? 'Error' : `${visibleTradeCount} trades`}
                </div>
            </div>

            <div
                role="tablist"
                aria-label="Chart timeframe"
                style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    padding: '14px 18px 0 18px',
                }}
            >
                {TIMEFRAME_OPTIONS.map((option) => {
                    const isActive = activeTimeframe === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => setActiveTimeframe(option.value)}
                            className="font-mono"
                            style={{
                                minWidth: 42,
                                height: 28,
                                border: isActive ? '1px solid #06d6a0' : '1px solid #334155',
                                background: isActive ? 'rgba(6, 214, 160, 0.12)' : '#13131f',
                                color: isActive ? '#06d6a0' : '#94a3b8',
                                cursor: 'pointer',
                                fontSize: '0.72rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>

            <div style={{ position: 'relative', height: CHART_HEIGHT, marginTop: 8 }}>
                <div ref={containerRef} style={{ width: '100%', height: CHART_HEIGHT }} />
                <div
                    ref={tooltipRef}
                    className="font-mono"
                    style={{
                        display: 'none',
                        position: 'absolute',
                        width: 128,
                        pointerEvents: 'none',
                        zIndex: 3,
                        border: '1px solid rgba(167,139,250,0.42)',
                        background: 'rgba(15,15,26,0.96)',
                        color: '#e2e8f0',
                        padding: '8px 10px',
                        fontSize: '0.78rem',
                    }}
                />
                {status === 'ready' && chartData.length === 0 && (
                    <div className="font-mono" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#64748b', fontSize: '0.82rem', pointerEvents: 'none' }}>
                        {isWaitingForTokenDecimals ? 'Loading chart...' : 'No trades yet.'}
                    </div>
                )}
                {status === 'error' && (
                    <div className="font-mono" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#ef4444', fontSize: '0.82rem', pointerEvents: 'none', padding: 24, textAlign: 'center' }}>
                        {error}
                    </div>
                )}
            </div>
        </section>
    );
}
