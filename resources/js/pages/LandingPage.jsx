import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTicketAlt, FaPrint, FaTimes, FaQrcode, FaCheckCircle, FaTv, FaUserCog } from 'react-icons/fa';
import useQueueStore, { SERVICE_CATEGORIES } from '../store/queueStore';

function LandingPage() {
    const [selectedCategory, setSelectedCategory] = useState('CON');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [pendingCategory, setPendingCategory] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [generatedTicket, setGeneratedTicket] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    
    const generateTicket = useQueueStore((state) => state.generateTicket);
    const queue = useQueueStore((state) => state.queue) || [];
    const counters = useQueueStore((state) => state.counters) || [];
    const fetchQueueState = useQueueStore((state) => state.fetchQueueState);

    // Auto poll queue state from server every 3 seconds so dynamic counters and queue numbers stay synced
    useEffect(() => {
        fetchQueueState();
        const syncInterval = setInterval(() => {
            fetchQueueState();
        }, 3000);
        return () => clearInterval(syncInterval);
    }, [fetchQueueState]);

    const knownKeywords = ['contracting', 'pr', 'technical', 'admin'];

    // Dynamically include any new division counters added from Admin panel
    const extraCategories = counters
        .filter((c) => {
            const low = (c.name || '').toLowerCase();
            return !knownKeywords.some((k) => low.includes(k));
        })
        .map((c) => ({
            id: `CTR-${c.id}`,
            counterId: c.id,
            counterName: c.name,
            name: c.name,
            prefix: (c.name.replace(/[^A-Za-z0-9]/g, '').substring(0, 3) || 'CTR').toUpperCase(),
            icon: '🏛️',
            desc: `Assigned Officer: ${c.staff || 'Duty Officer'}`,
        }));

    const allCategories = [...SERVICE_CATEGORIES, ...extraCategories];

    const handleCardClick = (cat) => {
        setSelectedCategory(cat.id);
        setPendingCategory(cat);
        setShowConfirmModal(true);
    };

    const handleConfirmGenerate = async () => {
        if (!pendingCategory || isGenerating) return;
        setIsGenerating(true);
        try {
            const ticket = await generateTicket(pendingCategory.id);
            setShowConfirmModal(false);
            if (ticket) {
                setGeneratedTicket(ticket);
                setShowModal(true);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateTicket = async (catId = selectedCategory) => {
        const ticket = await generateTicket(catId);
        if (ticket) {
            setGeneratedTicket(ticket);
            setShowModal(true);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setGeneratedTicket(null);
    };

    const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const currentTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col justify-between p-4 md:p-8">
            <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col justify-center">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-8"
                >
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600/20 border border-blue-400/30 rounded-3xl mb-4 shadow-xl backdrop-blur-md">
                        <FaTicketAlt className="text-4xl text-blue-400" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-2 tracking-tight">
                        Office of the Provincial Procurement Management Officer
                    </h1>
                    <p className="text-lg text-blue-300">
                        Self-Service Queue Ticket Kiosk
                    </p>
                </motion.div>

                {/* Service Selection Cards */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="mb-8"
                >
                    <h2 className="text-center text-blue-200 text-sm font-semibold uppercase tracking-wider mb-4">
                        Select Purpose of Visit
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {allCategories.map((cat) => {
                            const isSelected = selectedCategory === cat.id;
                            const pendingCount = queue.filter((t) => {
                                if (t.categoryId === cat.id) return true;
                                if (t.counterId && cat.counterId && t.counterId === cat.counterId) return true;
                                if (cat.counterName && t.counterName === cat.counterName) return true;
                                if (t.category && t.category === cat.name) return true;
                                return false;
                            }).length;

                            return (
                                <motion.button
                                    key={cat.id}
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => handleCardClick(cat)}
                                    className={`p-5 rounded-2xl border text-left transition-all duration-300 flex flex-col justify-between min-h-[13rem] relative overflow-hidden group ${
                                        isSelected
                                            ? 'bg-blue-600 text-white border-blue-400 shadow-xl shadow-blue-600/30 ring-2 ring-blue-400'
                                            : 'bg-white/10 text-white border-white/10 hover:bg-white/15 hover:border-white/30 backdrop-blur-md'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-4xl">{cat.icon}</span>
                                        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-white/20">
                                            {cat.prefix}
                                        </span>
                                    </div>
                                    <div className="flex-1 flex flex-col justify-between">
                                        <div>
                                            <h3 className="text-lg font-bold mb-1 leading-snug">{cat.name}</h3>
                                            <p className="text-xs text-blue-200 opacity-90 line-clamp-2">{cat.desc}</p>
                                        </div>
                                        <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
                                            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 shadow-sm">
                                                Pending Queue ({pendingCount})
                                            </span>
                                        </div>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                </motion.div>
            </div>

            {/* Confirmation Modal */}
            <AnimatePresence>
                {showConfirmModal && pendingCategory && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50"
                        onClick={() => setShowConfirmModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.85, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative text-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors p-2"
                            >
                                <FaTimes className="text-xl" />
                            </button>

                            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-3 text-3xl">
                                {pendingCategory.icon}
                            </div>

                            <h2 className="text-2xl font-black text-gray-900 mb-1">
                                Confirm Purpose of Visit
                            </h2>
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4">
                                {pendingCategory.prefix} • {pendingCategory.name}
                            </p>

                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 text-left">
                                <p className="text-xs text-gray-500 font-bold uppercase mb-1">Division Service Details</p>
                                <p className="text-sm font-semibold text-gray-800">
                                    {pendingCategory.desc}
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 px-4 rounded-xl transition-colors text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmGenerate}
                                    disabled={isGenerating}
                                    className={`flex-1 text-white font-extrabold py-3.5 px-4 rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg ${
                                        isGenerating
                                            ? 'bg-blue-400 cursor-not-allowed shadow-blue-300/20'
                                            : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-blue-600/30 cursor-pointer'
                                    }`}
                                >
                                    {isGenerating ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                            </svg>
                                            <span>Generating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <FaTicketAlt />
                                            <span>Generate Ticket</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bottom Footer Navigation */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t border-white/10 mt-8 text-sm max-w-5xl mx-auto w-full"
            >
                <div className="flex items-center gap-6">
                    <a
                        href="/display"
                        className="text-blue-300 hover:text-white transition-colors flex items-center gap-2 font-medium text-xs"
                    >
                        <FaTv />
                        <span>Public Queue Display</span>
                    </a>
                    <span className="text-white/20">•</span>
                    <a
                        href="/admin"
                        className="text-blue-300 hover:text-white transition-colors flex items-center gap-2 font-medium text-xs"
                    >
                        <FaUserCog />
                        <span>Counter Staff Panel</span>
                    </a>
                </div>

                <p className="text-xs text-blue-300/80 font-medium">
                    © {new Date().getFullYear()} OPPMO - RV CODING
                </p>
            </motion.div>

            {/* Printable Ticket Modal */}
            <AnimatePresence>
                {showModal && generatedTicket && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
                        onClick={handleCloseModal}
                    >
                        <motion.div
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.85, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={handleCloseModal}
                                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors p-2"
                            >
                                <FaTimes className="text-xl" />
                            </button>

                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-3 text-blue-700">
                                    <FaCheckCircle className="text-3xl" />
                                </div>
                                <h2 className="text-2xl font-black text-gray-900 mb-1">
                                    Ticket Issued
                                </h2>
                                <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-4">
                                    {generatedTicket.category}
                                </p>

                                <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 rounded-2xl p-6 mb-6 text-white shadow-inner border border-blue-900">
                                    <p className="text-xs uppercase tracking-widest text-blue-300 mb-1 font-mono">
                                        YOUR NUMBER
                                    </p>
                                    <p className="text-5xl font-black tracking-wider text-amber-400 mb-3 font-mono">
                                        {generatedTicket.number}
                                    </p>
                                    <div className="border-t border-white/10 pt-3 flex justify-between items-center text-xs text-blue-200">
                                        <span>{currentDate}</span>
                                        <span className="font-semibold">{currentTime}</span>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-xl mb-6 text-center border border-slate-200">
                                    <p className="text-xs text-gray-500 uppercase font-bold">People Ahead</p>
                                    <p className="text-lg font-bold text-gray-800">
                                        {queue.length > 0 ? queue.length - 1 : 0} waiting in queue
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleCloseModal}
                                        className="flex-1 bg-gray-100 text-gray-700 font-semibold py-3.5 px-4 rounded-xl hover:bg-gray-200 transition-colors"
                                    >
                                        Done
                                    </button>
                                    <button
                                        onClick={handlePrint}
                                        className="flex-1 bg-blue-700 text-white font-semibold py-3.5 px-4 rounded-xl hover:bg-blue-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-700/20"
                                    >
                                        <FaPrint />
                                        <span>Print</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default LandingPage;