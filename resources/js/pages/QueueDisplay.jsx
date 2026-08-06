import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FaBuilding,
    FaClock,
    FaUserTie,
    FaArrowRight,
    FaBell,
    FaHome,
    FaVolumeUp,
    FaVolumeMute,
    FaPlay,
    FaPause,
    FaTag,
    FaSitemap,
    FaScroll,
    FaFilm,
    FaCheckCircle,
    FaInfoCircle
} from 'react-icons/fa';
import useQueueStore from '../store/queueStore';

function playChime() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        gain1.gain.setValueAtTime(0.3, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.6);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, now + 0.25); // E5
        gain2.gain.setValueAtTime(0.3, now + 0.25);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.25);
        osc2.stop(now + 0.85);
    } catch (err) {
        console.warn('Audio chime error:', err);
    }
}

function announceVoice(ticketInput, counterName) {
    if ('speechSynthesis' in window) {
        try {
            window.speechSynthesis.cancel();
            let text = '';
            if (Array.isArray(ticketInput) && ticketInput.length > 0) {
                const formatted = ticketInput.map(t => String(t).replace('-', ' '));
                let ticketListStr = '';
                if (formatted.length === 1) {
                    ticketListStr = formatted[0];
                } else if (formatted.length === 2) {
                    ticketListStr = `${formatted[0]} and ${formatted[1]}`;
                } else {
                    const last = formatted.pop();
                    ticketListStr = `${formatted.join(', ')}, and ${last}`;
                }
                const label = ticketInput.length > 1 ? 'numbers' : 'number';
                text = `Attention please. Ticket ${label} ${ticketListStr}, please proceed to ${counterName || 'assistance counter'}.`;
            } else {
                const formattedTicket = String(ticketInput).replace('-', ' ');
                text = `Attention please. Ticket number ${formattedTicket}, please proceed to ${counterName || 'assistance counter'}.`;
            }
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.88;
            utterance.pitch = 1.0;
            window.speechSynthesis.speak(utterance);
        } catch (err) {
            console.warn('Speech synthesis error:', err);
        }
    }
}

function QueueDisplay() {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [activeCenterTab, setActiveCenterTab] = useState('video'); // 'video' | 'org' | 'charter'
    const [isPlaying, setIsPlaying] = useState(true);

    const queue = useQueueStore((state) => state.queue);
    const currentQueue = useQueueStore((state) => state.currentQueue);
    const servingQueues = useQueueStore((state) => state.servingQueues) || [];
    const lastCalledTrigger = useQueueStore((state) => state.lastCalledTrigger);
    const soundEnabled = useQueueStore((state) => state.soundEnabled);
    const voiceEnabled = useQueueStore((state) => state.voiceEnabled);
    const toggleSound = useQueueStore((state) => state.toggleSound);

    const prevTriggerRef = useRef(lastCalledTrigger);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Auto rotate center panel every 15 seconds if tab is auto-rotating
    useEffect(() => {
        const tabs = ['video', 'org', 'charter'];
        const interval = setInterval(() => {
            setActiveCenterTab((prev) => {
                const nextIdx = (tabs.indexOf(prev) + 1) % tabs.length;
                return tabs[nextIdx];
            });
        }, 15000);
        return () => clearInterval(interval);
    }, []);

    // Handle announcements when ticket is called or recalled
    useEffect(() => {
        if (lastCalledTrigger && lastCalledTrigger !== prevTriggerRef.current && currentQueue) {
            prevTriggerRef.current = lastCalledTrigger;
            if (soundEnabled) {
                playChime();
            }
            if (voiceEnabled) {
                setTimeout(() => {
                    const activeForCounter = servingQueues.filter(q => q.counterId === currentQueue.counterId);
                    if (activeForCounter.length > 1) {
                        const ticketNumbers = activeForCounter.map(q => q.number);
                        announceVoice(ticketNumbers, currentQueue.counterName);
                    } else {
                        announceVoice(currentQueue.number, currentQueue.counterName);
                    }
                }, 600);
            }
        }
    }, [lastCalledTrigger, currentQueue, servingQueues, soundEnabled, voiceEnabled]);

    const formattedDate = currentTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const formattedTime = currentTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const announcements = [
        "Welcome to the Office of the Provincial Procurement Management Officer - Please have your accreditation and division documents ready",
        "Citizen's Charter Guarantee: Standard processing time is within 15 minutes",
        "Please maintain silence while waiting for your ticket number to be called",
        "For Bidding & Sealed Submissions, please proceed to Contracting Division Counter",
        "For Purchase Requisitions & Processing, please proceed to PR Division Counter",
        "For Technical Specifications & Inspection, please proceed to Technical Division Counter",
        "For Administrative Services & General Assistance, please proceed to Admin Division Counter",
        "Thank you for your cooperation and assistance",
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex flex-col justify-between overflow-hidden">
            {/* Header */}
            <header className="bg-slate-900/80 backdrop-blur-xl border-b border-blue-500/20 py-3.5 px-6 shadow-xl">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 border border-blue-300/30">
                            <FaBuilding className="text-2xl text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-wide uppercase font-mono">
                                Office of the Provincial Procurement Management Officer
                            </h1>
                            <p className="text-blue-300 text-xs font-semibold tracking-wider">
                                Public Queue & Citizen's Information Display
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-amber-300 font-mono font-black text-2xl tracking-widest">{formattedTime}</p>
                            <p className="text-blue-200 text-xs font-medium">{formattedDate}</p>
                        </div>

                        <button
                            onClick={toggleSound}
                            className={`p-3 rounded-2xl border transition-all shadow-md ${soundEnabled
                                    ? 'bg-blue-600/30 border-blue-400/40 text-blue-300 hover:bg-blue-600/50'
                                    : 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30'
                                }`}
                            title={soundEnabled ? 'Mute Audio Announcements' : 'Unmute Audio Announcements'}
                        >
                            {soundEnabled ? <FaVolumeUp className="text-xl" /> : <FaVolumeMute className="text-xl" />}
                        </button>

                        <a
                            href="/"
                            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white p-3 rounded-2xl transition-all"
                            title="Back to Kiosk"
                        >
                            <FaHome className="text-xl" />
                        </a>
                    </div>
                </div>
            </header>

            {/* Marquee Ticker */}
            <div className="bg-blue-950 border-y border-blue-500/20 py-2 overflow-hidden shadow-inner">
                <div className="animate-marquee whitespace-nowrap">
                    <span className="text-blue-100 font-semibold text-sm tracking-wide mx-8">
                        {announcements.join(' • ')}
                    </span>
                </div>
            </div>

            {/* 3-Panel Main Layout */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-stretch">

                {/* 1. LEFT PANEL - NEXT TO ASSIST / NOW SERVING MULTIPLE COUNTERS (Cols 1-4) */}
                <motion.div
                    initial={{ opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    className="lg:col-span-4 bg-slate-900/70 backdrop-blur-xl rounded-3xl p-6 border border-blue-500/30 shadow-2xl flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                        <h2 className="text-xl font-black text-white tracking-wider uppercase flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping inline-block" />
                            Next To Assist
                        </h2>
                        <span className="bg-blue-600/30 border border-blue-400/30 text-blue-300 text-xs font-mono font-bold px-3 py-1 rounded-full">
                            {servingQueues.length} ACTIVE COUNTERS
                        </span>
                    </div>

                    <div className="flex-1 flex flex-col gap-4 overflow-y-auto max-h-[520px] pr-1">
                        <AnimatePresence mode="popLayout">
                            {Object.values(
                                (servingQueues || []).reduce((acc, ticket) => {
                                    const cid = ticket.counterId || 'default';
                                    if (!acc[cid]) {
                                        acc[cid] = {
                                            counterId: ticket.counterId,
                                            counterName: ticket.counterName || 'Counter',
                                            staffName: ticket.staffName || 'Officer',
                                            category: ticket.category || 'General',
                                            tickets: [],
                                        };
                                    }
                                    acc[cid].tickets.push(ticket);
                                    return acc;
                                }, {})
                            ).length > 0 ? (
                                Object.values(
                                    (servingQueues || []).reduce((acc, ticket) => {
                                        const cid = ticket.counterId || 'default';
                                        if (!acc[cid]) {
                                            acc[cid] = {
                                                counterId: ticket.counterId,
                                                counterName: ticket.counterName || 'Counter',
                                                staffName: ticket.staffName || 'Officer',
                                                category: ticket.category || 'General',
                                                tickets: [],
                                            };
                                        }
                                        acc[cid].tickets.push(ticket);
                                        return acc;
                                    }, {})
                                ).map((group, idx) => (
                                    <motion.div
                                        key={group.counterId}
                                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                        className={`rounded-2xl p-5 text-center border relative overflow-hidden transition-all ${idx === 0
                                                ? 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 border-blue-300/40 shadow-xl shadow-blue-600/20'
                                                : 'bg-slate-950/80 border-blue-500/20'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="inline-block bg-white/20 backdrop-blur-md px-3 py-0.5 rounded-full text-[11px] font-bold text-blue-100 uppercase tracking-wide">
                                                {group.category}
                                            </span>
                                            <span className="text-[10px] font-mono text-amber-300 bg-amber-400/20 px-2.5 py-0.5 rounded-full font-bold uppercase">
                                                {group.counterName}
                                            </span>
                                        </div>

                                        <p className="text-blue-200 text-[10px] uppercase tracking-widest font-mono font-bold mt-1">
                                            {group.tickets.length > 1 ? `BATCH CALL (${group.tickets.length} VISITORS)` : 'NOW SERVING'}
                                        </p>

                                        {/* All Tickets in Batch */}
                                        <div className="flex flex-wrap items-center justify-center gap-2 my-3">
                                            {group.tickets.map((t) => (
                                                <span
                                                    key={t.id}
                                                    className="bg-slate-950/90 text-amber-300 border border-amber-400/40 text-3xl font-black px-3.5 py-1 rounded-xl font-mono tracking-wider shadow-inner"
                                                >
                                                    {t.number}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="border-t border-white/10 pt-2.5 mt-2 flex items-center justify-between text-xs text-blue-200">
                                            <div className="flex items-center gap-1.5 font-semibold text-white">
                                                <FaBuilding className="text-blue-300 text-xs" />
                                                <span>{group.counterName}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-blue-200/80 text-[11px]">
                                                <FaUserTie className="text-[10px]" />
                                                <span>{group.staffName || 'Officer'}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex-1 flex flex-col items-center justify-center py-16 text-center"
                                >
                                    <div className="w-20 h-20 bg-blue-600/20 border border-blue-400/30 rounded-full flex items-center justify-center mb-4">
                                        <FaBell className="text-4xl text-blue-400 animate-bounce" />
                                    </div>
                                    <p className="text-2xl font-black text-white">No active calls</p>
                                    <p className="text-blue-300 text-xs mt-2 max-w-xs">
                                        Counter officers will call the next pending tickets shortly.
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Bottom Status Banner */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center text-xs text-blue-200 mt-4">
                        <p className="font-semibold text-white mb-0.5">Assistance Desk Ready</p>
                        <p className="text-blue-300/80">Please present your printed kiosk ticket upon entry.</p>
                    </div>
                </motion.div>

                {/* 2. CENTER PANEL - VIDEO PLAYER (/video/video.mp4) (Cols 5-8) */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="lg:col-span-5 bg-slate-900/70 backdrop-blur-xl rounded-3xl p-4 border border-blue-500/30 shadow-2xl flex flex-col justify-between overflow-hidden"
                >
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                        <div className="flex items-center gap-2 text-white font-bold text-sm">
                            <FaFilm className="text-blue-400" />
                            <span>Information Video</span>
                        </div>
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 font-mono font-bold px-2.5 py-0.5 rounded-full uppercase">
                            AUTOPLAY
                        </span>
                    </div>

                    {/* HTML5 Video Player */}
                    <div className="w-full flex-1 min-h-[350px] max-h-[580px] bg-slate-950 rounded-2xl border border-blue-500/30 overflow-hidden relative shadow-2xl flex items-center justify-center">
                        <video
                            src="/video/video.mp4"
                            controls
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-full object-contain rounded-2xl"
                        >
                            Your browser does not support the video tag.
                        </video>
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/10 text-center text-xs text-blue-200/80">
                        <p className="font-semibold text-white">Citizen's Charter & Procurement Information Video</p>
                    </div>
                </motion.div>

                {/* 3. RIGHT PANEL - PENDING QUEUE (Cols 9-12) */}
                <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="lg:col-span-3 bg-slate-900/70 backdrop-blur-xl rounded-3xl p-6 border border-blue-500/30 shadow-2xl flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                        <h2 className="text-xl font-black text-white tracking-wider uppercase">
                            Pending Queue
                        </h2>
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full">
                            {queue.length} WAITING
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[520px]">
                        <AnimatePresence>
                            {queue.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-center py-20"
                                >
                                    <p className="text-blue-200 text-lg font-bold">No pending queue</p>
                                    <p className="text-blue-400 text-xs mt-2">
                                        Visitors can generate a ticket at the kiosk.
                                    </p>
                                </motion.div>
                            ) : (
                                queue.map((ticket, index) => (
                                    <motion.div
                                        key={ticket.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.04 }}
                                        className="bg-white/95 rounded-2xl p-4 shadow-lg flex items-center justify-between border border-white"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-900 font-black text-sm">
                                                #{index + 1}
                                            </div>
                                            <div>
                                                <p className="text-2xl font-black text-gray-900 font-mono tracking-wider leading-none">
                                                    {ticket.number}
                                                </p>
                                                <p className="text-[11px] text-blue-700 font-bold mt-1 flex items-center gap-1">
                                                    <FaTag className="text-[9px]" />
                                                    <span>{ticket.category || 'General'}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/10 text-center">
                        <p className="text-xs text-blue-200/80 font-medium">
                            {queue.length} visitor{queue.length !== 1 ? 's' : ''} currently in line
                        </p>
                    </div>
                </motion.div>

            </div>
        </div>
    );
}

export default QueueDisplay;