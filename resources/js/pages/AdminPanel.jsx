import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FaArrowRight,
    FaRedo,
    FaForward,
    FaCheck,
    FaTrash,
    FaUserTie,
    FaBuilding,
    FaHome,
    FaChartBar,
    FaUsers,
    FaClock,
    FaExclamationTriangle,
    FaCog,
    FaTag,
    FaVolumeUp,
    FaVolumeMute,
    FaFilter
} from 'react-icons/fa';
import useQueueStore, { SERVICE_CATEGORIES } from '../store/queueStore';

function AdminPanel() {
    const [selectedCounter, setSelectedCounter] = useState(1);
    const [editingCounter, setEditingCounter] = useState(null);
    const [staffName, setStaffName] = useState('');
    const [counterName, setCounterName] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');

    // Multi-select batch call state
    const [selectedTicketIds, setSelectedTicketIds] = useState([]);

    // Add counter modal state
    const [showAddCounter, setShowAddCounter] = useState(false);
    const [newCounterName, setNewCounterName] = useState('');
    const [newCounterStaff, setNewCounterStaff] = useState('');

    const queue = useQueueStore((state) => state.queue);
    const currentQueue = useQueueStore((state) => state.currentQueue);
    const servingQueues = useQueueStore((state) => state.servingQueues) || [];
    const counters = useQueueStore((state) => state.counters);
    const statistics = useQueueStore((state) => state.statistics);
    const completedQueues = useQueueStore((state) => state.completedQueues);
    const soundEnabled = useQueueStore((state) => state.soundEnabled);
    const toggleSound = useQueueStore((state) => state.toggleSound);

    const nextQueue = useQueueStore((state) => state.nextQueue);
    const callBatchTickets = useQueueStore((state) => state.callBatchTickets);
    const recallQueue = useQueueStore((state) => state.recallQueue);
    const skipQueue = useQueueStore((state) => state.skipQueue);
    const completeQueue = useQueueStore((state) => state.completeQueue);
    const resetQueue = useQueueStore((state) => state.resetQueue);
    const addCounter = useQueueStore((state) => state.addCounter);
    const updateCounter = useQueueStore((state) => state.updateCounter);
    const removeCounter = useQueueStore((state) => state.removeCounter);
    const setActiveCounter = useQueueStore((state) => state.setActiveCounter);

    const handleNextQueue = () => {
        nextQueue(selectedCounter);
        setActiveCounter(selectedCounter);
    };

    const toggleSelectTicket = (id) => {
        setSelectedTicketIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedTicketIds.length === filteredQueue.length) {
            setSelectedTicketIds([]);
        } else {
            setSelectedTicketIds(filteredQueue.map((t) => t.id));
        }
    };

    const handleCallBatch = () => {
        if (selectedTicketIds.length > 0) {
            callBatchTickets(selectedTicketIds, selectedCounter);
            setSelectedTicketIds([]);
        }
    };

    const handleEditCounter = (counter) => {
        setEditingCounter(counter.id);
        setStaffName(counter.staff);
        setCounterName(counter.name);
    };

    const handleSaveCounter = () => {
        if (editingCounter && staffName.trim()) {
            updateCounter(editingCounter, staffName.trim(), counterName.trim() || undefined);
            setEditingCounter(null);
            setStaffName('');
            setCounterName('');
        }
    };

    const handleCancelEdit = () => {
        setEditingCounter(null);
        setStaffName('');
        setCounterName('');
    };

    const handleCreateCounter = () => {
        if (newCounterName.trim() && newCounterStaff.trim()) {
            addCounter(newCounterName.trim(), newCounterStaff.trim());
            setNewCounterName('');
            setNewCounterStaff('');
            setShowAddCounter(false);
        }
    };

    const handleRemoveCounter = (id, name) => {
        if (window.confirm(`Are you sure you want to remove ${name}?`)) {
            removeCounter(id);
        }
    };

    const handleResetQueue = () => {
        if (window.confirm('Are you sure you want to reset the entire queue? This action cannot be undone.')) {
            resetQueue();
        }
    };

    const formatWaitTime = (seconds) => {
        if (!seconds || seconds <= 0) return '0s';
        if (seconds < 60) return `${Math.round(seconds)}s`;
        if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
        return `${Math.round(seconds / 3600)}h`;
    };

    const filteredQueue = categoryFilter === 'ALL'
        ? queue
        : queue.filter(t => t.categoryId === categoryFilter);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 md:p-8">
            {/* Header */}
            <header className="bg-white/10 backdrop-blur-lg border border-white/20 py-4 px-6 mb-6 rounded-3xl">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-600/30 border border-blue-400/30 rounded-2xl flex items-center justify-center">
                            <FaCog className="text-2xl text-blue-300" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Staff Admin Console</h1>
                            <p className="text-blue-300 text-xs">Counter Operations & Queue Controller</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleSound}
                            className={`p-3 rounded-xl border transition-all ${soundEnabled
                                    ? 'bg-blue-600/30 border-blue-400/40 text-blue-300 hover:bg-blue-600/50'
                                    : 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30'
                                }`}
                            title={soundEnabled ? 'Mute Audio Announcements' : 'Unmute Audio Announcements'}
                        >
                            {soundEnabled ? <FaVolumeUp className="text-xl" /> : <FaVolumeMute className="text-xl" />}
                        </button>
                        <a
                            href="/"
                            className="text-white/80 hover:text-white transition-colors p-2"
                        >
                            <FaHome className="text-2xl" />
                        </a>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Queue Controls */}
                <div className="space-y-6">
                    {/* Current Active Serving Tickets */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <FaBuilding className="text-blue-400" />
                                Current Active Tickets ({servingQueues.length})
                            </h2>
                            <span className="text-[10px] font-mono font-bold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-2.5 py-0.5 rounded-full uppercase">
                                LIVE CALLS
                            </span>
                        </div>

                        <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
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
                                    ).map((group) => (
                                        <motion.div
                                            key={group.counterId}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 rounded-2xl p-5 text-center shadow-lg border border-blue-400/30 relative overflow-hidden"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="inline-block bg-white/20 text-[11px] font-bold px-3 py-0.5 rounded-full text-blue-100 uppercase tracking-wide">
                                                    {group.category}
                                                </span>
                                                <span className="text-xs font-bold text-amber-300 font-mono bg-amber-400/20 px-2.5 py-0.5 rounded-full uppercase">
                                                    {group.counterName}
                                                </span>
                                            </div>

                                            <p className="text-blue-200 text-[10px] uppercase tracking-widest font-mono font-bold mt-1">
                                                {group.tickets.length > 1 ? `BATCH SERVING (${group.tickets.length} VISITORS)` : 'NOW SERVING'}
                                            </p>

                                            {/* Render All Ticket Numbers in the Batch */}
                                            <div className="flex flex-wrap items-center justify-center gap-2 my-3">
                                                {group.tickets.map((t) => (
                                                    <span
                                                        key={t.id}
                                                        className="bg-slate-950/80 text-amber-300 border border-amber-400/40 text-2xl font-black px-3.5 py-1.5 rounded-xl font-mono tracking-wider shadow-inner"
                                                    >
                                                        {t.number}
                                                    </span>
                                                ))}
                                            </div>

                                            <div className="border-t border-white/15 pt-2.5 mt-2 flex items-center justify-between text-xs text-blue-100">
                                                <p className="font-bold text-white text-xs">
                                                    {group.counterName}
                                                </p>
                                                <p className="opacity-80 text-[11px]">
                                                    Officer: <strong>{group.staffName}</strong>
                                                </p>
                                            </div>

                                            {/* Per-Station Action Buttons */}
                                            <div className="grid grid-cols-3 gap-1.5 border-t border-white/15 pt-2.5 mt-2">
                                                <button
                                                    onClick={() => recallQueue(group.counterId)}
                                                    className="bg-amber-500/80 hover:bg-amber-500 text-white font-bold py-1.5 px-2 rounded-lg text-[11px] flex items-center justify-center gap-1 transition-all"
                                                    title="Recall voice announcement"
                                                >
                                                    <FaRedo className="text-[10px]" />
                                                    <span>Recall</span>
                                                </button>
                                                <button
                                                    onClick={() => completeQueue(group.counterId)}
                                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-2 rounded-lg text-[11px] flex items-center justify-center gap-1 transition-all"
                                                    title="Mark all tickets in batch completed"
                                                >
                                                    <FaCheck className="text-[10px]" />
                                                    <span>Done</span>
                                                </button>
                                                <button
                                                    onClick={() => nextQueue(group.counterId)}
                                                    disabled={queue.length === 0}
                                                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-gray-500 text-white font-bold py-1.5 px-2 rounded-lg text-[11px] flex items-center justify-center gap-1 transition-all"
                                                    title="Call next visitor for this station"
                                                >
                                                    <FaArrowRight className="text-[10px]" />
                                                    <span>Next</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center"
                                    >
                                        <FaExclamationTriangle className="text-3xl text-amber-400/80 mb-2 mx-auto" />
                                        <p className="text-blue-200 font-medium text-sm">No ticket currently being served</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>

                    {/* Queue Control Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20"
                    >
                        <h2 className="text-lg font-bold text-white mb-4">Counter Controls</h2>

                        {/* Counter Selection */}
                        <div className="mb-5">
                            <label className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-2 block">
                                Operating Counter
                            </label>
                            <select
                                value={selectedCounter}
                                onChange={(e) => setSelectedCounter(Number(e.target.value))}
                                className="w-full bg-slate-900/80 border border-blue-400/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                            >
                                {counters.map((counter) => (
                                    <option key={counter.id} value={counter.id} className="bg-slate-900 text-white">
                                        {counter.name} ({counter.staff})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={handleNextQueue}
                                disabled={queue.length === 0}
                                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm"
                            >
                                <FaArrowRight />
                                <span>Call Next</span>
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={recallQueue}
                                disabled={!currentQueue}
                                className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm"
                            >
                                <FaRedo />
                                <span>Recall Voice</span>
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={skipQueue}
                                disabled={queue.length === 0}
                                className="bg-orange-600 hover:bg-orange-700 disabled:bg-slate-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm"
                            >
                                <FaForward />
                                <span>Skip</span>
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={completeQueue}
                                disabled={!currentQueue}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm"
                            >
                                <FaCheck />
                                <span>Complete</span>
                            </motion.button>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleResetQueue}
                            className="w-full mt-4 bg-red-600/80 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs border border-red-500/30"
                        >
                            <FaTrash />
                            <span>Reset Entire Queue</span>
                        </motion.button>
                    </motion.div>
                </div>

                {/* Center Column - Pending Queue */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20 flex flex-col"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <FaUsers className="text-blue-400" />
                            Pending Queue ({filteredQueue.length})
                        </h2>
                        {filteredQueue.length > 0 && (
                            <button
                                onClick={handleSelectAll}
                                className="text-xs text-blue-300 hover:text-white font-semibold bg-white/10 px-3 py-1 rounded-lg border border-white/10 transition-colors"
                            >
                                {selectedTicketIds.length === filteredQueue.length ? 'Deselect All' : 'Select All'}
                            </button>
                        )}
                    </div>

                    {/* Batch Call Action Banner */}
                    {selectedTicketIds.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-gradient-to-r from-emerald-600 to-teal-700 p-3 rounded-2xl mb-4 text-white flex items-center justify-between shadow-xl border border-emerald-400/40"
                        >
                            <div className="text-xs">
                                <span className="font-bold">{selectedTicketIds.length} tickets selected</span>
                                <p className="text-[11px] opacity-90">Will announce batch call aloud</p>
                            </div>
                            <button
                                onClick={handleCallBatch}
                                className="bg-white text-emerald-900 font-extrabold text-xs px-4 py-2 rounded-xl hover:bg-emerald-100 transition-all shadow-md flex items-center gap-1.5"
                            >
                                <FaArrowRight />
                                <span>Call Selected ({selectedTicketIds.length})</span>
                            </button>
                        </motion.div>
                    )}

                    {/* Category Filter Chips */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        <button
                            onClick={() => setCategoryFilter('ALL')}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${categoryFilter === 'ALL'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white/10 text-blue-200 hover:bg-white/20'
                                }`}
                        >
                            All ({queue.length})
                        </button>
                        {SERVICE_CATEGORIES.map((cat) => {
                            const count = queue.filter(t => t.categoryId === cat.id).length;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setCategoryFilter(cat.id)}
                                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1 ${categoryFilter === cat.id
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white/10 text-blue-200 hover:bg-white/20'
                                        }`}
                                >
                                    <span>{cat.prefix}</span>
                                    <span className="opacity-75">({count})</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
                        <AnimatePresence>
                            {filteredQueue.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-center py-16"
                                >
                                    <p className="text-blue-200 font-medium">No tickets in pending queue</p>
                                </motion.div>
                            ) : (
                                filteredQueue.map((ticket, index) => {
                                    const isSelected = selectedTicketIds.includes(ticket.id);
                                    return (
                                        <motion.div
                                            key={ticket.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.04 }}
                                            onClick={() => toggleSelectTicket(ticket.id)}
                                            className={`rounded-2xl p-4 flex items-center justify-between shadow-md cursor-pointer transition-all border ${
                                                isSelected
                                                    ? 'bg-blue-50 border-blue-500 shadow-blue-500/20'
                                                    : 'bg-white/95 border-transparent hover:bg-white'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectTicket(ticket.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                                                />
                                                <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center font-bold text-blue-800 text-xs">
                                                    #{index + 1}
                                                </div>
                                                <div>
                                                    <p className="text-2xl font-black text-gray-900 font-mono tracking-wide leading-none">
                                                        {ticket.number}
                                                    </p>
                                                    <p className="text-xs text-blue-700 font-semibold mt-1 flex items-center gap-1">
                                                        <FaTag className="text-[10px]" />
                                                        <span>{ticket.category || 'General'}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-500 font-mono">
                                                    {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md inline-block mt-1">
                                                    Click to Select
                                                </span>
                                            </div>
                                        </motion.div>
                                    );
                                })
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* Right Column - Statistics & Counter Management */}
                <div className="space-y-6">
                    {/* Statistics Dashboard */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20"
                    >
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <FaChartBar className="text-blue-400" />
                            Performance Statistics
                        </h2>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/10 rounded-2xl p-4 text-center border border-white/10">
                                <FaUsers className="text-2xl text-blue-400 mb-1 mx-auto" />
                                <p className="text-3xl font-black text-white">
                                    {statistics.totalServed}
                                </p>
                                <p className="text-blue-200 text-xs font-medium">Served Today</p>
                            </div>

                            <div className="bg-white/10 rounded-2xl p-4 text-center border border-white/10">
                                <FaExclamationTriangle className="text-2xl text-amber-400 mb-1 mx-auto" />
                                <p className="text-3xl font-black text-white">
                                    {statistics.totalSkipped}
                                </p>
                                <p className="text-blue-200 text-xs font-medium">Skipped</p>
                            </div>

                            <div className="bg-white/10 rounded-2xl p-4 text-center col-span-2 border border-white/10">
                                <FaClock className="text-2xl text-emerald-400 mb-1 mx-auto" />
                                <p className="text-3xl font-black text-white font-mono">
                                    {formatWaitTime(statistics.averageWaitTime)}
                                </p>
                                <p className="text-blue-200 text-xs font-medium">Avg Processing & Wait Time</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Counter Management */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <FaUserTie className="text-blue-400" />
                                Division Counter
                            </h2>
                            <button
                                onClick={() => setShowAddCounter(!showAddCounter)}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-md"
                            >
                                {showAddCounter ? 'Close' : '+ Add Division Counter'}
                            </button>
                        </div>

                        {/* Add Counter Form */}
                        {showAddCounter && (
                            <div className="bg-slate-900/90 border border-blue-400/30 rounded-2xl p-4 mb-4 space-y-3 shadow-xl">
                                <p className="text-xs font-bold text-blue-300 uppercase tracking-wide">New Division Counter Station</p>
                                <input
                                    type="text"
                                    value={newCounterName}
                                    onChange={(e) => setNewCounterName(e.target.value)}
                                    className="w-full bg-slate-950 border border-blue-500/30 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Division Counter (e.g., Contracting Division Counter)"
                                />
                                <input
                                    type="text"
                                    value={newCounterStaff}
                                    onChange={(e) => setNewCounterStaff(e.target.value)}
                                    className="w-full bg-slate-950 border border-blue-500/30 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Officer Name (e.g., Contracting Officer)"
                                />
                                <button
                                    onClick={handleCreateCounter}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl text-xs transition-colors shadow-lg"
                                >
                                    Create Division Counter
                                </button>
                            </div>
                        )}

                        <div className="space-y-3">
                            {counters.map((counter) => (
                                <div
                                    key={counter.id}
                                    className="bg-white/10 rounded-2xl p-4 border border-white/10"
                                >
                                    {editingCounter === counter.id ? (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[10px] text-blue-300 font-semibold block mb-1">STATION NAME</label>
                                                <input
                                                    type="text"
                                                    value={counterName}
                                                    onChange={(e) => setCounterName(e.target.value)}
                                                    className="w-full bg-slate-900 border border-blue-400/40 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                                                    placeholder="Station Name (e.g., Counter 1)"
                                                />
                                                <label className="text-[10px] text-blue-300 font-semibold block mb-1">STAFF OFFICER</label>
                                                <input
                                                    type="text"
                                                    value={staffName}
                                                    onChange={(e) => setStaffName(e.target.value)}
                                                    className="w-full bg-slate-900 border border-blue-400/40 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Staff Officer Name"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleSaveCounter}
                                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors"
                                                >
                                                    Save Changes
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-white font-bold text-sm">
                                                    {counter.name}
                                                </p>
                                                <p className="text-blue-300 text-xs">
                                                    {counter.staff}
                                                </p>
                                            </div>
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => handleEditCounter(counter)}
                                                    className="bg-blue-600/80 hover:bg-blue-600 text-white font-medium py-1.5 px-3 rounded-lg text-xs transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                {counters.length > 1 && (
                                                    <button
                                                        onClick={() => handleRemoveCounter(counter.id, counter.name)}
                                                        className="bg-red-600/80 hover:bg-red-600 text-white font-medium py-1.5 px-2.5 rounded-lg text-xs transition-colors"
                                                        title="Delete Station"
                                                    >
                                                        <FaTrash className="text-xs" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

export default AdminPanel;