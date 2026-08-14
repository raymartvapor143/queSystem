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

let audioCtxSingleton = null;

function getAudioContext() {
    if (!audioCtxSingleton) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
            audioCtxSingleton = new AudioCtx();
        }
    }
    if (audioCtxSingleton && audioCtxSingleton.state === 'suspended') {
        audioCtxSingleton.resume().catch(() => {});
    }
    return audioCtxSingleton;
}

function playChime() {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;
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

function DigitalClock() {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

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

    return (
        <div className="text-right">
            <p className="text-amber-300 font-mono font-black text-2xl tracking-widest">{formattedTime}</p>
            <p className="text-blue-200 text-xs font-medium">{formattedDate}</p>
        </div>
    );
}

function QueueDisplay() {
    const [activeCenterTab, setActiveCenterTab] = useState('video'); // 'video' | 'org' | 'charter'
    const [isPlaying, setIsPlaying] = useState(true);

    const [videoFit, setVideoFit] = useState('contain'); // 'contain' | 'cover'
    const [videoMuted, setVideoMuted] = useState(true);
    const [videoPlaying, setVideoPlaying] = useState(true);
    const [videoError, setVideoError] = useState(false);
    const videoRef = useRef(null);
    const isManuallyPausedRef = useRef(false);

    const fetchQueueState = useQueueStore((state) => state.fetchQueueState);
    const queue = useQueueStore((state) => state.queue);
    const currentQueue = useQueueStore((state) => state.currentQueue);
    const servingQueues = useQueueStore((state) => state.servingQueues) || [];
    const lastCalledTrigger = useQueueStore((state) => state.lastCalledTrigger);
    const soundEnabled = useQueueStore((state) => state.soundEnabled);
    const voiceEnabled = useQueueStore((state) => state.voiceEnabled);
    const toggleSound = useQueueStore((state) => state.toggleSound);

    const prevTriggerRef = useRef(lastCalledTrigger);

    // Queue mechanism to handle voice announcements sequentially without overlapping calls
    const callQueueRef = useRef([]);
    const isSpeakingRef = useRef(false);
    const activeUtteranceRef = useRef(null);

    // Auto poll queue state from server every 15 seconds (fallback only)
    useEffect(() => {
        fetchQueueState();
        const syncInterval = setInterval(() => {
            fetchQueueState();
        }, 15000);
        return () => clearInterval(syncInterval);
    }, [fetchQueueState]);

    // Ensure the video plays, overcoming browser muted autoplay restrictions on first user interaction
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const attemptPlay = () => {
            if (video.paused && !isManuallyPausedRef.current) {
                video.play()
                    .then(() => {
                        setVideoPlaying(true);
                        setVideoError(false);
                    })
                    .catch(err => {
                        console.log("Autoplay waiting for user interaction or error:", err);
                    });
            }
        };

        attemptPlay();

        const handleInteraction = () => {
            attemptPlay();
        };

        window.addEventListener('click', handleInteraction);
        window.addEventListener('keydown', handleInteraction);

        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, []);

    // Watchdog to auto-recover video playback if browser throttles or freezes video stream
    useEffect(() => {
        const checkPlayback = setInterval(() => {
            const video = videoRef.current;
            if (video && video.paused && !isManuallyPausedRef.current && !videoError) {
                video.play()
                    .then(() => {
                        setVideoPlaying(true);
                        setVideoError(false);
                    })
                    .catch(() => {});
            }
        }, 2500);

        return () => clearInterval(checkPlayback);
    }, [videoError]);



    // Sequential Audio & Voice Announcement Queue Processor
    const processCallQueue = () => {
        if (isSpeakingRef.current) return;
        if (callQueueRef.current.length === 0) return;

        const item = callQueueRef.current.shift();
        if (!item) return;

        isSpeakingRef.current = true;

        // Play chime audio if enabled
        if (soundEnabled) {
            playChime();
        }

        const speechDelay = soundEnabled ? 650 : 50;

        setTimeout(() => {
            if (!voiceEnabled || !('speechSynthesis' in window)) {
                // If voice is disabled, finish after chime delay
                setTimeout(() => {
                    isSpeakingRef.current = false;
                    processCallQueue();
                }, 800);
                return;
            }

            try {
                window.speechSynthesis.cancel();

                let text = '';
                const ticketInput = item.tickets;
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
                    text = `Attention please. Ticket ${label} ${ticketListStr}, please proceed to ${item.counterName || 'assistance counter'}.`;
                } else {
                    const formattedTicket = String(ticketInput).replace('-', ' ');
                    text = `Attention please. Ticket number ${formattedTicket}, please proceed to ${item.counterName || 'assistance counter'}.`;
                }

                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 0.88;
                utterance.pitch = 1.0;
                activeUtteranceRef.current = utterance;

                let hasEnded = false;
                const finish = () => {
                    if (hasEnded) return;
                    hasEnded = true;
                    activeUtteranceRef.current = null;
                    isSpeakingRef.current = false;
                    // Brief pause before calling next queued announcement
                    setTimeout(() => {
                        processCallQueue();
                    }, 400);
                };

                utterance.onend = finish;
                utterance.onerror = finish;

                window.speechSynthesis.speak(utterance);

                // Fallback timeout in case speech API stalls
                setTimeout(() => {
                    finish();
                }, 8000);

            } catch (err) {
                console.warn('Speech synthesis error:', err);
                activeUtteranceRef.current = null;
                isSpeakingRef.current = false;
                processCallQueue();
            }
        }, speechDelay);
    };

    // Track announced ticket call keys (ticketId_timestamp) to prevent repeat calls
    const announcedKeysRef = useRef(new Set());
    const isFirstRenderRef = useRef(true);

    // Handle announcements when ticket is called or recalled (without duplicate/repeat calls)
    useEffect(() => {
        if (!servingQueues || servingQueues.length === 0) return;

        // On initial page mount, mark existing serving tickets as already announced
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
            servingQueues.forEach(ticket => {
                const key = `${ticket.id}_${ticket.recalledAt || ticket.servedAt || 'init'}`;
                announcedKeysRef.current.add(key);
            });
            return;
        }

        if (lastCalledTrigger && lastCalledTrigger !== prevTriggerRef.current) {
            prevTriggerRef.current = lastCalledTrigger;

            // Filter out tickets that have already been announced for this servedAt / recalledAt instance
            const newTicketsToAnnounce = servingQueues.filter(ticket => {
                const key = `${ticket.id}_${ticket.recalledAt || ticket.servedAt || ''}`;
                return !announcedKeysRef.current.has(key);
            });

            if (newTicketsToAnnounce.length === 0) return;

            // Prevent unbounded memory growth over long uptime
            if (announcedKeysRef.current.size > 200) {
                announcedKeysRef.current.clear();
            }

            // Mark these new ticket call keys as announced
            newTicketsToAnnounce.forEach(ticket => {
                const key = `${ticket.id}_${ticket.recalledAt || ticket.servedAt || ''}`;
                announcedKeysRef.current.add(key);
            });

            // Group ONLY newly called tickets by counter
            const groups = Object.values(
                newTicketsToAnnounce.reduce((acc, ticket) => {
                    const cid = ticket.counterId || 'default';
                    if (!acc[cid]) {
                        acc[cid] = {
                            counterId: ticket.counterId,
                            counterName: ticket.counterName || 'Counter',
                            tickets: [],
                        };
                    }
                    acc[cid].tickets.push(ticket.number);
                    return acc;
                }, {})
            );

            if (groups.length > 0) {
                // When multiple counters call at the same time, randomize order then queue sequentially!
                const shuffled = [...groups].sort(() => Math.random() - 0.5);

                shuffled.forEach((group) => {
                    callQueueRef.current.push({
                        id: `${group.counterId}_${Date.now()}_${Math.random()}`,
                        counterName: group.counterName,
                        tickets: group.tickets,
                    });
                });

                processCallQueue();
            }
        }
    }, [lastCalledTrigger, servingQueues, soundEnabled, voiceEnabled]);

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
                        <div className="w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg shadow-blue-500/30 border border-blue-300/30 bg-slate-800">
                            <img src="/pmo.jpeg" alt="PMO Logo" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-wide uppercase font-mono">
                                OPPMO
                            </h1>
                            <p className="text-blue-300 text-xs font-semibold tracking-wider">
                                Public Queue & Citizen's Information Display
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <DigitalClock />

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

            {/* 2-Column Main Layout: Video Player (Expanded) + Merged Queue Side Panel */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-stretch overflow-hidden">

                {/* 1. DEDICATED EXPANDED VIDEO PLAYER PANEL (Cols 1-7 / 1-8) */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="lg:col-span-7 xl:col-span-8 bg-slate-900/70 backdrop-blur-xl rounded-3xl p-5 border border-blue-500/30 shadow-2xl flex flex-col justify-between overflow-hidden"
                >
                    {/* Video Header & Overlay Controls */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                        <div className="flex items-center gap-2.5 text-white font-black text-base uppercase tracking-wider font-mono">
                            <FaFilm className="text-blue-400 text-lg" />
                            <span>Information Video</span>
                        </div>

                        {/* Video Controls Overlay Toolbar */}
                        <div className="flex items-center gap-2 bg-slate-950/80 border border-white/10 rounded-xl px-2.5 py-1">
                            <button
                                onClick={() => {
                                    if (videoRef.current) {
                                        if (videoPlaying) {
                                            videoRef.current.pause();
                                            setVideoPlaying(false);
                                            isManuallyPausedRef.current = true;
                                        } else {
                                            isManuallyPausedRef.current = false;
                                            videoRef.current.play().then(() => {
                                                setVideoPlaying(true);
                                                setVideoError(false);
                                            }).catch(() => {});
                                        }
                                    }
                                }}
                                className="text-blue-300 hover:text-white text-xs font-bold px-2 py-0.5 rounded transition-all flex items-center gap-1"
                                title={videoPlaying ? 'Pause Video' : 'Play Video'}
                            >
                                {videoPlaying ? <FaPause className="text-amber-400" /> : <FaPlay className="text-emerald-400" />}
                                <span className="hidden sm:inline">{videoPlaying ? 'Pause' : 'Play'}</span>
                            </button>

                            <span className="w-px h-3 bg-white/20" />

                            <button
                                onClick={() => {
                                    if (videoRef.current) {
                                        videoRef.current.muted = !videoMuted;
                                        setVideoMuted(!videoMuted);
                                    }
                                }}
                                className="text-blue-300 hover:text-white text-xs font-bold px-2 py-0.5 rounded transition-all flex items-center gap-1"
                                title={videoMuted ? 'Unmute Video Audio' : 'Mute Video Audio'}
                            >
                                {videoMuted ? <FaVolumeMute className="text-red-400" /> : <FaVolumeUp className="text-emerald-400" />}
                                <span className="hidden sm:inline">{videoMuted ? 'Muted' : 'Unmuted'}</span>
                            </button>

                            <span className="w-px h-3 bg-white/20" />

                            <button
                                onClick={() => setVideoFit(prev => prev === 'cover' ? 'contain' : 'cover')}
                                className="text-blue-300 hover:text-white text-xs font-mono font-bold px-2 py-0.5 rounded transition-all"
                                title="Toggle Video Aspect Fit / Cover"
                            >
                                {videoFit === 'contain' ? 'Fit Screen (Active)' : 'Fill Container'}
                            </button>
                        </div>
                    </div>

                    {/* MAIN HTML5 VIDEO PLAYER (public/video/video.mp4) */}
                    <div className="w-full flex-1 min-h-[480px] lg:min-h-[580px] xl:min-h-[640px] bg-black rounded-2xl border border-blue-500/30 overflow-hidden relative shadow-2xl flex items-center justify-center">
                        <video
                            ref={videoRef}
                            src="/video/video.mp4"
                            controls
                            autoPlay
                            loop
                            muted={videoMuted}
                            playsInline
                            onPlay={() => {
                                setVideoPlaying(true);
                                setVideoError(false);
                            }}
                            onPause={() => {
                                if (!isManuallyPausedRef.current) {
                                    setTimeout(() => {
                                        if (videoRef.current && videoRef.current.paused && !isManuallyPausedRef.current) {
                                            videoRef.current.play().catch(() => {});
                                        }
                                    }, 300);
                                } else {
                                    setVideoPlaying(false);
                                }
                            }}
                            onWaiting={() => {
                                if (videoRef.current && !isManuallyPausedRef.current) {
                                    videoRef.current.play().catch(() => {});
                                }
                            }}
                            onStalled={() => {
                                if (videoRef.current && !isManuallyPausedRef.current) {
                                    videoRef.current.play().catch(() => {});
                                }
                            }}
                            onEnded={() => {
                                if (videoRef.current) {
                                    videoRef.current.currentTime = 0;
                                    if (!isManuallyPausedRef.current) {
                                        videoRef.current.play().catch(() => {});
                                    }
                                }
                            }}
                            onLoadedData={() => {
                                setVideoError(false);
                                if (videoRef.current && videoRef.current.paused && !isManuallyPausedRef.current) {
                                    videoRef.current.play().catch(() => {});
                                }
                            }}
                            onError={() => setVideoError(true)}
                            className={`w-full h-full ${videoFit === 'contain' ? 'object-contain' : 'object-cover'} rounded-2xl transition-all duration-300`}
                        >
                            Your browser does not support the video tag.
                        </video>

                        {videoError && (
                            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center">
                                <FaFilm className="text-5xl text-blue-500/40 mb-3" />
                                <p className="text-xl font-bold text-white">Video Autoplay Blocked or Loading</p>
                                <p className="text-blue-300 text-xs mt-1">Click the button below to start playing video.</p>
                                <button
                                    onClick={() => {
                                        if (videoRef.current) {
                                            isManuallyPausedRef.current = false;
                                            videoRef.current.play().then(() => {
                                                setVideoError(false);
                                                setVideoPlaying(true);
                                            }).catch(() => {});
                                        }
                                    }}
                                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-xs transition-colors shadow-lg shadow-blue-500/30"
                                >
                                    Play Video
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-white/10 text-center text-xs text-blue-200/80">
                        <p className="font-semibold text-white tracking-wide">
                            Office of the Provincial Procurement Management Officer — Information Video
                        </p>
                    </div>
                </motion.div>

                {/* 2. MERGED QUEUE SIDE PANEL — Now Serving + Pending */}
                <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="lg:col-span-5 xl:col-span-4 bg-slate-900/70 backdrop-blur-xl rounded-3xl p-5 border border-blue-500/30 shadow-2xl flex flex-col overflow-hidden"
                    style={{ maxHeight: 'calc(100vh - 160px)' }}
                >
                    {/* Panel Header */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 shrink-0">
                        <h2 className="text-xl font-black text-white tracking-wider uppercase flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping inline-block" />
                            Queue Status
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="bg-blue-600/30 border border-blue-400/30 text-blue-300 text-xs font-mono font-bold px-2.5 py-1 rounded-full">
                                {servingQueues.length} SERVING
                            </span>
                            <span className="bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-mono font-bold px-2.5 py-1 rounded-full">
                                {queue.length} WAITING
                            </span>
                        </div>
                    </div>

                    {/* Unified scrollable list */}
                    <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-3 scrollbar-thin scrollbar-thumb-blue-700/50 scrollbar-track-transparent">
                        <AnimatePresence mode="popLayout">

                            {/* — NOW SERVING section (Blue cards) — */}
                            {servingQueues.length > 0 ? (
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
                                ).map((group) => (
                                    <motion.div
                                        key={`serving-${group.counterId}`}
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                        className="rounded-2xl p-4 text-center border relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 border-blue-300/40 shadow-xl shadow-blue-600/25"
                                    >
                                        {/* Header row */}
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="inline-block bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-xs font-black text-blue-100 uppercase tracking-wide">
                                                {group.category}
                                            </span>
                                            <span className="text-xs font-mono text-amber-300 bg-amber-400/20 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                                                {group.counterName}
                                            </span>
                                        </div>

                                        <p className="text-blue-200 text-xs uppercase tracking-widest font-mono font-bold mt-1">
                                            {group.tickets.length > 1 ? `BATCH CALL (${group.tickets.length} VISITORS)` : 'NOW SERVING'}
                                        </p>

                                        {/* Ticket numbers — large blue cards */}
                                        <div className="flex flex-wrap items-center justify-center gap-2 my-3">
                                            {group.tickets.map((t) => (
                                                <span
                                                    key={t.id}
                                                    className="bg-slate-950/90 text-amber-300 border-2 border-amber-400/60 text-4xl lg:text-5xl font-black px-4 py-1.5 rounded-2xl font-mono tracking-wider shadow-2xl"
                                                >
                                                    {t.number}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Footer */}
                                        <div className="border-t border-white/10 pt-2 flex items-center justify-between text-xs text-blue-200">
                                            <div className="flex items-center gap-1.5 font-bold text-white">
                                                <FaBuilding className="text-blue-300" />
                                                <span>{group.counterName}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-blue-200/90 font-semibold">
                                                <FaUserTie className="text-blue-400" />
                                                <span>{group.staffName || 'Officer'}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <motion.div
                                    key="no-active"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex flex-col items-center justify-center py-6 text-center rounded-2xl bg-blue-900/20 border border-blue-500/20"
                                >
                                    <div className="w-10 h-10 bg-blue-600/20 border border-blue-400/30 rounded-full flex items-center justify-center mb-2">
                                        <FaBell className="text-xl text-blue-400 animate-bounce" />
                                    </div>
                                    <p className="text-sm font-black text-white">No active calls</p>
                                    <p className="text-blue-300 text-xs mt-1">Counter officers will call shortly.</p>
                                </motion.div>
                            )}

                            {/* Divider between sections */}
                            {queue.length > 0 && (
                                <div className="flex items-center gap-2 py-1 shrink-0">
                                    <div className="flex-1 h-px bg-white/10" />
                                    <span className="text-[10px] text-blue-300/70 font-mono font-bold uppercase tracking-widest px-1">
                                        <FaClock className="inline mr-1 text-amber-400" />
                                        Pending
                                    </span>
                                    <div className="flex-1 h-px bg-white/10" />
                                </div>
                            )}

                            {/* — PENDING QUEUE section (White cards) — */}
                            {queue.length === 0 ? (
                                <motion.div
                                    key="no-pending"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-center py-6 rounded-2xl bg-white/5 border border-white/10"
                                >
                                    <p className="text-blue-200 text-sm font-bold">No pending visitors</p>
                                    <p className="text-blue-400 text-xs mt-1">Visitors can get a ticket at the kiosk.</p>
                                </motion.div>
                            ) : (
                                queue.map((ticket, index) => (
                                    <motion.div
                                        key={`pending-${ticket.id}`}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ delay: index * 0.03 }}
                                        className="bg-white rounded-2xl p-3.5 shadow-md flex items-center justify-between border border-slate-200"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-blue-100 border border-blue-200 rounded-xl flex items-center justify-center text-blue-700 font-black text-xs shrink-0">
                                                #{index + 1}
                                            </div>
                                            <div>
                                                {/* Ticket number — large dark font on white */}
                                                <p className="text-3xl lg:text-4xl font-black text-slate-900 font-mono tracking-wider leading-none">
                                                    {ticket.number}
                                                </p>
                                                <p className="text-xs text-blue-700 font-extrabold mt-0.5 flex items-center gap-1">
                                                    <FaTag className="text-[10px]" />
                                                    <span>{ticket.category || 'General'}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse shrink-0" />
                                    </motion.div>
                                ))
                            )}

                        </AnimatePresence>
                    </div>

                    {/* Footer count */}
                    <div className="mt-2 pt-2 border-t border-white/10 text-center shrink-0">
                        <p className="text-xs text-blue-200/90 font-bold">
                            {queue.length} visitor{queue.length !== 1 ? 's' : ''} currently waiting
                        </p>
                    </div>
                </motion.div>

            </div>
        </div>
    );
}

export default QueueDisplay;