import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const getRandom = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateSmoothPath = (points, width, height) => {
    if (!points || points.length < 2) return `M 0 ${height}`;
    const xStep = width / (points.length - 1);
    const pathData = points.map((point, i) => [
        i * xStep,
        height - (point / 100) * (height * 0.8) - (height * 0.1),
    ]);
    let path = `M ${pathData[0][0]} ${pathData[0][1]}`;
    for (let i = 0; i < pathData.length - 1; i++) {
        const [x1, y1] = pathData[i];
        const [x2, y2] = pathData[i + 1];
        const midX = (x1 + x2) / 2;
        path += ` C ${midX},${y1} ${midX},${y2} ${x2},${y2}`;
    }
    return path;
};

const StatsWidget = () => {
    const [stats, setStats] = useState({
        amount: 283,
        change: 36,
        chartData: [30, 55, 45, 75, 60, 85, 70],
    });
    const linePathRef = useRef(null);
    const areaPathRef = useRef(null);

    const updateStats = () => {
        setStats({
            amount: getRandom(100, 999),
            change: getRandom(-50, 100),
            chartData: Array.from({ length: 7 }, () => getRandom(10, 90)),
        });
    };

    useEffect(() => {
        const id = setInterval(updateStats, 3000);
        return () => clearInterval(id);
    }, []);

    const svgWidth = 150;
    const svgHeight = 60;

    const linePath = useMemo(
        () => generateSmoothPath(stats.chartData, svgWidth, svgHeight),
        [stats.chartData]
    );

    const areaPath = useMemo(() => {
        if (!linePath.startsWith('M')) return '';
        return `${linePath} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`;
    }, [linePath]);

    useEffect(() => {
        const path = linePathRef.current;
        const area = areaPathRef.current;
        if (path && area) {
            const length = path.getTotalLength();
            path.style.transition = 'none';
            path.style.strokeDasharray = `${length} ${length}`;
            path.style.strokeDashoffset = String(length);
            area.style.transition = 'none';
            area.style.opacity = '0';
            path.getBoundingClientRect();
            path.style.transition = 'stroke-dashoffset 0.8s ease-in-out, stroke 0.5s ease';
            path.style.strokeDashoffset = '0';
            area.style.transition = 'opacity 0.8s ease-in-out 0.2s, fill 0.5s ease';
            area.style.opacity = '1';
        }
    }, [linePath]);

    const isPositive = stats.change >= 0;
    const strokeColor = isPositive ? '#22c55e' : '#f97316';
    const gradientId = isPositive ? 'gradSuccess' : 'gradDestructive';

    return (
        <div className="w-full max-w-md bg-card text-card-foreground rounded-2xl p-5 border border-border">
            <div className="flex justify-between items-center gap-4">
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                        <span>This Week</span>
                        <span className={cn(
                            'flex items-center gap-0.5 font-semibold text-xs',
                            isPositive ? 'text-emerald-500' : 'text-orange-500'
                        )}>
                            {Math.abs(stats.change)}%
                            {isPositive
                                ? <ArrowUp size={12} strokeWidth={2.5} />
                                : <ArrowDown size={12} strokeWidth={2.5} />
                            }
                        </span>
                    </div>
                    <p className="text-3xl font-bold text-foreground mt-1 font-mono">
                        {stats.amount}
                    </p>
                </div>

                <div className="w-[150px] h-[60px] shrink-0">
                    <svg
                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                        className="w-full h-full"
                        preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="gradSuccess" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gradDestructive" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <path ref={areaPathRef} d={areaPath} fill={`url(#${gradientId})`} />
                        <path
                            ref={linePathRef}
                            d={linePath}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round" />
                    </svg>
                </div>
            </div>
        </div>
    );
};

export function Component() {
    return (
        <div className="w-full min-h-screen flex flex-col items-center justify-center p-4 bg-background">
            <StatsWidget />
        </div>
    );
}
