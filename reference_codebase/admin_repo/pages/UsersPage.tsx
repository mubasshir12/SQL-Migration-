import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactDOM from 'react-dom';
import { PanelCard, CustomDropdown, DateRangeFilter, ConfirmationModal, BatchActionToolbar, StatCard, ActionPopover } from '../components/ui';
import { UsersPageSkeleton } from '../components/skeletons';
import { fetchUsersData, deleteUser, deleteUsersBatch, updateUserSettings, updateUserProfile } from '../services/supabaseService';
import type { UserStats, UserSettings } from '../types';
import { Search, Trash2, CheckSquare, Square, Edit, Save, X, Loader2, Users, User, Settings, MessageSquare, Activity, TrendingUp, MoreVertical, ChevronDown, ChevronUp, Key } from 'lucide-react';
import { useAutoRefresh } from '../components/AutoRefreshContext';

const stringToColor = (str: string): string => {
    let hash = 0;
    if (str.length === 0) return 'D1D5DB'; // A fallback gray color
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    const color = ('000000' + (hash & 0xFFFFFF).toString(16)).slice(-6);
    return color;
};

// --- Edit User Modal ---
const UserEditModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    userStat: UserStats;
    onSave: () => void;
}> = ({ isOpen, onClose, userStat, onSave }) => {
    const [fullName, setFullName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [proactiveMode, setProactiveMode] = useState(false);
    const [persona, setPersona] = useState('Therapist');
    const [voice, setVoice] = useState('Puck');
    const [apiKey, setApiKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFullName(userStat.user.full_name || '');
            setAvatarUrl(userStat.user.avatar_url || '');
            if (userStat.settings) {
                setProactiveMode(userStat.settings.voice_proactive_mode || false);
                setPersona(userStat.settings.voice_mode_persona_instruction || 'Therapist');
                setVoice(userStat.settings.voice_mode_voice || 'Puck');
                setApiKey(userStat.settings.api_key || '');
            } else {
                setProactiveMode(false);
                setPersona('Therapist');
                setVoice('Puck');
                setApiKey('');
            }
        }
    }, [isOpen, userStat]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await Promise.all([
                updateUserProfile(userStat.user.id, {
                    full_name: fullName,
                    avatar_url: avatarUrl
                }),
                updateUserSettings(userStat.user.id, {
                    voice_proactive_mode: proactiveMode,
                    voice_mode_persona_instruction: persona,
                    voice_mode_voice: voice,
                    api_key: apiKey
                })
            ]);
            onSave();
            onClose();
        } catch (error) {
            console.error("Failed to update user settings:", error);
            alert("Failed to save settings.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-bg backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
            <div className="modal-content w-full max-w-md bg-white dark:bg-slate-900 rounded-[16px] shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800 transform transition-all my-8 relative flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-800 rounded-t-[16px]">
                    <div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">Edit User Profile</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Updates sync directly to the user's account</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4 flex-grow">
                    {/* User Info Card */}
                    <div className="flex items-center gap-3 p-2 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100/50 dark:border-indigo-800/30">
                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden ring-2 ring-white dark:ring-slate-900 shadow-sm shrink-0">
                            <img src={avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${fullName || userStat.user.email || 'A'}&backgroundColor=${stringToColor(fullName || userStat.user.email || userStat.user.id)}&textColor=ffffff`} alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold text-slate-800 dark:text-slate-200 truncate text-sm">{fullName || 'Unknown User'}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{userStat.user.email}</p>
                        </div>
                    </div>

                    {/* Profile Section */}
                    <div className="space-y-2">
                        <h4 className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Profile</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                                <input 
                                    type="text" 
                                    value={fullName} 
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-slate-200 transition-shadow"
                                    placeholder="Enter full name"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">Avatar URL</label>
                                <input 
                                    type="text" 
                                    value={avatarUrl} 
                                    onChange={(e) => setAvatarUrl(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-slate-200 transition-shadow"
                                    placeholder="https://example.com/avatar.png"
                                />
                            </div>
                        </div>
                    </div>

                    <hr className="border-slate-100 dark:border-slate-800/60" />

                    {/* Settings Section */}
                    <div className="space-y-2">
                        <h4 className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">AI Settings</h4>
                        
                        <div className="grid grid-cols-2 gap-2 relative z-20">
                            {/* Persona Selection */}
                            <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm space-y-1">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-800 dark:text-slate-200 mb-0.5">AI Persona</label>
                                </div>
                                <CustomDropdown
                                    options={['Therapist', 'Gen Z', 'Professional', 'Pirate', 'Elderly', 'Default']}
                                    value={persona}
                                    onChange={setPersona}
                                    className="w-full relative z-30"
                                    triggerClassName="w-full rounded-lg border-slate-200 dark:border-slate-700 shadow-sm py-1 px-2 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-medium"
                                />
                            </div>

                            {/* Voice Selection */}
                            <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm space-y-1">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-800 dark:text-slate-200 mb-0.5">AI Voice</label>
                                </div>
                                <CustomDropdown
                                    options={['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr', 'Aoede']}
                                    value={voice}
                                    onChange={setVoice}
                                    className="w-full relative z-30"
                                    triggerClassName="w-full rounded-lg border-slate-200 dark:border-slate-700 shadow-sm py-1 px-2 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-medium"
                                />
                            </div>
                        </div>

                        {/* Proactive Mode Toggle */}
                        <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                            <div>
                                <label className="text-[10px] font-bold text-slate-800 dark:text-slate-200 block mb-0.5">Proactive Mode</label>
                                <p className="text-[9px] text-slate-500 dark:text-slate-400">Allow AI to initiate conversations</p>
                            </div>
                            <button
                                onClick={() => setProactiveMode(!proactiveMode)}
                                className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${proactiveMode ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                aria-pressed={proactiveMode}
                            >
                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ${proactiveMode ? 'translate-x-4' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* Custom API Key */}
                        <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                            <label className="block text-[10px] font-bold text-slate-800 dark:text-slate-200 mb-1">Custom API Key (Optional)</label>
                            <input 
                                type="password" 
                                value={apiKey} 
                                onChange={(e) => setApiKey(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-slate-200 transition-shadow"
                                placeholder="Enter custom Gemini API Key"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800/60 rounded-b-[16px]">
                    <button onClick={onClose} className="px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 active:scale-95">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-3 py-1.5 text-[11px] font-bold text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 min-w-[90px] flex items-center justify-center shadow-sm hover:shadow active:scale-95" disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin" size={12}/> : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};




const UsersPage: React.FC = () => {
    const { userId: urlUserId } = useParams();
    const navigate = useNavigate();

    const [users, setUsers] = useState<UserStats[]>([]);
    const [loading, setLoading] = useState(true);
    const { refreshTrigger } = useAutoRefresh();
    
    // State for filters and sorting
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState('newest');
    const [dateRange, setDateRange] = useState<{ startDate: Date | null, endDate: Date | null }>({ startDate: null, endDate: null });

    // State for deletion and selection
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ ids: string[]; isBatch: boolean } | null>(null);
    
    const expandedRow = urlUserId || null;
    const setExpandedRow = (id: string | null) => {
        if (id) {
            navigate(`/users/${id}`);
        } else {
            navigate(`/users`);
        }
    };
    
    const [editingUser, setEditingUser] = useState<UserStats | null>(null);
    const [actionPopoverData, setActionPopoverData] = useState<{ id: string; anchorEl: HTMLElement } | null>(null);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    const handleTouchStart = (userId: string) => {
        longPressTimer.current = setTimeout(() => {
            handleStartSelection(userId);
        }, 1000);
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const toggleRowExpansion = (userId: string) => {
        setExpandedRow(expandedRow === userId ? null : userId);
    };

    const pressTimer = useRef<number | null>(null);
    const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);

    const handleRowScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (headerRef.current) {
            headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchUsersData();
            setUsers(data);
        } catch (error) {
            console.error("Failed to fetch users data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers, refreshTrigger]);

    const processedUsers = useMemo(() => {
        const term = searchTerm.toLowerCase();
        
        let processed = [...users];

        // 1. Filter by date range
        if (dateRange.startDate && dateRange.endDate) {
            processed = processed.filter(userStat => {
                const joinDate = new Date(userStat.user.created_at);
                return joinDate >= dateRange.startDate! && joinDate <= dateRange.endDate!;
            });
        }
        
        // 2. Filter by search term
        if (term) {
             processed = processed.filter(userStat => 
                userStat.user.full_name?.toLowerCase().includes(term) ||
                userStat.user.email?.toLowerCase().includes(term)
            );
        }

        // 3. Sort the array
        switch (sortOption) {
            case 'oldest':
                processed.sort((a, b) => new Date(a.user.created_at).getTime() - new Date(b.user.created_at).getTime());
                break;
            case 'name':
                processed.sort((a, b) => (a.user.full_name || '').localeCompare(b.user.full_name || ''));
                break;
            case 'conversations':
                processed.sort((a, b) => b.conversation_count - a.conversation_count);
                break;
            case 'newest':
            default:
                processed.sort((a, b) => new Date(b.user.created_at).getTime() - new Date(a.user.created_at).getTime());
                break;
        }

        return processed;
    }, [users, searchTerm, sortOption, dateRange]);
    
    // --- Deletion and Selection Handlers ---

    const triggerHapticFeedback = () => {
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(20);
        }
    };

    const handleDeleteRequest = (userId: string) => {
        setDeleteConfirmation({ ids: [userId], isBatch: false });
    };

    const handleBatchDeleteRequest = () => {
        if (selectedUsers.size > 0) {
            setDeleteConfirmation({ ids: Array.from(selectedUsers), isBatch: true });
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirmation) return;

        const { ids, isBatch } = deleteConfirmation;
        const { error } = isBatch
            ? await deleteUsersBatch(ids)
            : await deleteUser(ids[0]);
        
        setDeleteConfirmation(null);

        if (error) {
            alert(`Failed to delete user(s): ${(error as Error).message}`);
        } else {
            if (isBatch) {
                handleCancelSelection();
            }
            loadUsers(); // Refresh data on success
        }
    };
    
    const handleStartSelection = (userId: string) => {
        triggerHapticFeedback();
        setIsSelectionMode(true);
        setSelectedUsers(new Set([userId]));
    };

    const handleToggleSelection = (userId: string) => {
        triggerHapticFeedback();
        const newSelection = new Set(selectedUsers);
        if (newSelection.has(userId)) {
            newSelection.delete(userId);
        } else {
            newSelection.add(userId);
        }
        
        if (newSelection.size === 0) {
            setIsSelectionMode(false);
        }
        setSelectedUsers(newSelection);
    };

    const handleCancelSelection = () => {
        setIsSelectionMode(false);
        setSelectedUsers(new Set());
    };

    const handleSelectAll = () => {
        triggerHapticFeedback();
        const allUserIds = processedUsers.map(u => u.user.id);
        if (selectedUsers.size === allUserIds.length) {
            setSelectedUsers(new Set());
            setIsSelectionMode(false);
        } else {
            setSelectedUsers(new Set(allUserIds));
            setIsSelectionMode(true);
        }
    };

    useEffect(() => {
        if (selectAllCheckboxRef.current) {
            const isPartiallySelected = selectedUsers.size > 0 && selectedUsers.size < processedUsers.length;
            selectAllCheckboxRef.current.indeterminate = isPartiallySelected;
        }
    }, [selectedUsers, processedUsers.length]);

    const isAllSelected = processedUsers.length > 0 && selectedUsers.size === processedUsers.length;


    if (loading && users.length === 0) {
        return <UsersPageSkeleton />;
    }
    
    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Users</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your {users.length} registered users and their settings.</p>
                    </div>
                </div>

                {/* Analytics Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-2">
                    <StatCard 
                        title="Filtered Users" 
                        value={processedUsers.length} 
                        description="Users matching current filters" 
                        icon={<Users size={24} />} 
                        borderColor="border-indigo-500" 
                        info="Total number of users matching the current search list."
                        trend={{ value: users.length, label: "Total Registered", neutral: true }} 
                    />
                    <StatCard 
                        title="Users w/ Vehicles" 
                        value={processedUsers.filter(u => (u.vehicles_count || 0) > 0).length} 
                        description="Users with registered vehicles" 
                        icon={<Activity size={24} />} 
                        borderColor="border-emerald-500" 
                        info="Number of users who have registered at least one vehicle."
                        trend={{ 
                            value: `${processedUsers.length > 0 ? Math.round((processedUsers.filter(u => (u.vehicles_count || 0) > 0).length / processedUsers.length) * 100) : 0}%`, 
                            label: "Adoption Rate", 
                            positive: true 
                        }} 
                    />
                    <StatCard 
                        title="Users w/ Finance" 
                        value={processedUsers.filter(u => (u.finance_tx_count || 0) > 0).length} 
                        description="Users with finance transactions" 
                        icon={<MessageSquare size={24} />} 
                        borderColor="border-sky-500" 
                        info="Number of users who have conducted financial transactions."
                        trend={{ value: "Active", label: "Status", neutral: true }}
                    />
                    <StatCard 
                        title="Users w/ Dairy" 
                        value={processedUsers.filter(u => (u.dairy_entries_count || 0) > 0).length} 
                        description="Users with dairy entries" 
                        icon={<TrendingUp size={24} />} 
                        borderColor="border-amber-500" 
                        info="Number of users who have logged dairy entries."
                        trend={{ value: "Daily", label: "Usage", neutral: true }}
                    />
                </div>
                
                {/* Unified Toolbar */}
                <div className="flex flex-col xl:flex-row xl:items-center gap-3 xl:gap-4 w-full bg-slate-50/50 dark:bg-slate-800/20 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/60 overflow-visible">
                    
                    {/* Search and Sort Container */}
                    <div className="flex flex-row items-center gap-2 xl:gap-3 w-full xl:w-auto xl:flex-1">
                        {/* Search Input */}
                        <div className={`relative transition-all duration-300 ease-in-out shrink-0 ${isSearchFocused ? 'w-full xl:w-auto xl:flex-grow' : 'w-[65%] xl:w-auto xl:flex-grow xl:min-w-[200px]'}`}>
                            <Search size={16} className={`absolute top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${isSearchFocused ? 'left-3 text-indigo-500' : 'left-3 text-slate-400'}`} />
                            <input 
                                type="text"
                                placeholder={isSearchFocused ? "Search users by name or email..." : "Search..."}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setIsSearchFocused(false)}
                                className={`w-full py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all shadow-sm placeholder:text-slate-400 dark:text-slate-200 cursor-pointer focus:cursor-text pl-9 pr-4`}
                            />
                        </div>

                        {/* Controls Group */}
                        <div className={`flex flex-row flex-nowrap items-center gap-2 transition-all duration-300 ease-in-out ${isSearchFocused ? 'w-0 opacity-0 px-0 invisible xl:w-auto xl:opacity-100 xl:px-0 xl:visible' : 'w-[35%] xl:w-auto opacity-100 visible'}`}>
                            <div className="w-full relative z-20">
                                <CustomDropdown
                                    value={sortOption}
                                    onChange={setSortOption}
                                    options={['newest', 'oldest', 'name', 'conversations']}
                                    displayLabels={{
                                        newest: 'Newest First',
                                        oldest: 'Oldest First',
                                        name: 'By Name (A-Z)',
                                        conversations: 'Most Active'
                                    }}
                                    triggerClassName="w-full rounded-xl text-xs py-2 px-3 shadow-sm border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Date Selector */}
                    <div className={`w-full xl:w-auto relative z-10 shrink-0 transition-opacity duration-300 ${isSearchFocused ? 'hidden xl:block' : 'block'}`}>
                        <DateRangeFilter onChange={setDateRange} />
                    </div>
                </div>
            </div>

            {processedUsers.length > 0 ? (
                <PanelCard className="!p-0 flex flex-col [clip-path:inset(0_round_0.5rem)]">
                    
                    <div className="flex flex-col">
                        {/* Header Row */}
                        <div 
                            ref={headerRef}
                            className="sticky z-20 bg-[var(--card-bg)] flex items-center px-1 md:px-2 border-b border-[var(--border-color)] overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] transition-all duration-300 top-[50px] py-2 lg:min-w-full"
                        >
                            {isSelectionMode && (
                                <div className="w-10 shrink-0 text-center animate-fade-in pl-1">
                                    <input
                                        ref={selectAllCheckboxRef}
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        checked={isAllSelected}
                                        onChange={handleSelectAll}
                                    />
                                </div>
                            )}
                            <div className="w-64 lg:flex-1 lg:min-w-[16rem] shrink-0 px-2 text-[11px] font-sans font-bold text-[var(--text-secondary)] whitespace-nowrap">User & Provider</div>
                            <div className="w-36 shrink-0 px-2 text-[11px] font-sans font-bold text-[var(--text-secondary)] whitespace-nowrap">Activity Dates</div>
                            <div className="w-20 shrink-0 px-2 text-center text-[11px] font-sans font-bold text-[var(--text-secondary)] whitespace-nowrap">Chats</div>
                            <div className="w-56 shrink-0 px-2 text-[11px] font-sans font-bold text-[var(--text-secondary)] whitespace-nowrap">Settings</div>
                            <div className="w-12 shrink-0 px-1 text-right text-[11px] font-sans font-bold text-[var(--text-secondary)] whitespace-nowrap">Actions</div>
                            <div className="w-10 shrink-0 px-1"></div>
                        </div>

                        {/* Data Rows */}
                        <div className="flex flex-col">
                            {processedUsers.map(userStat => {
                                const { id, full_name, avatar_url, email, created_at, last_sign_in_at, providers } = userStat.user;
                                const { conversation_count } = userStat;
                                const isSelected = selectedUsers.has(id);
                                const isExpanded = expandedRow === id;
                                const firstLetter = (full_name || email || 'A').charAt(0).toUpperCase();
                                const bgColor = stringToColor(full_name || email || id);
                                const fallbackAvatar = `https://api.dicebear.com/8.x/initials/svg?seed=${firstLetter}&backgroundColor=${bgColor}&textColor=ffffff`;

                                const maskFromClass = isExpanded 
                                    ? 'from-[var(--subtle-bg)]' 
                                    : isSelected 
                                        ? 'from-indigo-50 dark:from-indigo-900/40 group-hover:from-[var(--subtle-bg)]' 
                                        : 'from-[var(--card-bg)] group-hover:from-[var(--subtle-bg)]';

                                return (
                                    <div key={id} className={`flex flex-col border-b border-[var(--border-color)] last:border-b-0 group ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}>
                                        <div className="relative">
                                            <div 
                                                className={`flex items-center py-2 px-1 md:px-2 hover:bg-[var(--subtle-bg)] transition-colors cursor-pointer select-none overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] lg:min-w-full ${isExpanded ? 'bg-[var(--subtle-bg)]' : ''}`}
                                                onScroll={handleRowScroll}
                                                onClick={() => {
                                                    if (isSelectionMode) {
                                                        handleToggleSelection(id);
                                                    } else {
                                                        toggleRowExpansion(id);
                                                    }
                                                }}
                                                onTouchStart={() => handleTouchStart(id)}
                                                onTouchEnd={handleTouchEnd}
                                                onMouseDown={() => handleTouchStart(id)}
                                                onMouseUp={handleTouchEnd}
                                                onMouseLeave={handleTouchEnd}
                                            >
                                                {isSelectionMode && (
                                                    <div className="w-10 shrink-0 text-center animate-fade-in pl-1" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            className="h-4 w-4 rounded border-gray-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                            checked={isSelected}
                                                            onChange={() => handleToggleSelection(id)}
                                                        />
                                                    </div>
                                                )}
                                                <div className="w-64 lg:flex-1 lg:min-w-[16rem] shrink-0 px-2 hover:opacity-90">
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative shrink-0">
                                                            <img
                                                                src={avatar_url || fallbackAvatar}
                                                                alt={full_name || 'Avatar'}
                                                                className="w-8 h-8 rounded-full object-cover bg-slate-200 dark:bg-slate-700 ring-2 ring-white dark:ring-slate-800 shadow-sm shrink-0"
                                                                onError={(e) => { e.currentTarget.src = fallbackAvatar; }}
                                                            />
                                                            {userStat.settings?.voice_proactive_mode && (
                                                                <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-green-500 ring-2 ring-white dark:ring-slate-900" title="Proactive Mode Active"></span>
                                                            )}
                                                        </div>
                                                        <div className="truncate flex-1 min-w-0">
                                                            <div className="font-bold text-[var(--text-primary)] truncate text-[13px] flex items-center gap-1.5">
                                                                {full_name || 'Anonymous User'}
                                                                {providers && providers.length > 0 && (
                                                                    <div className="flex gap-0.5">
                                                                        {providers.map(p => (
                                                                            <span key={p} className="text-[8px] bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 uppercase px-1 rounded-sm leading-tight tracking-wider" title={`Logged in via ${p}`}>{p}</span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="text-[11px] text-[var(--text-secondary)] truncate">{email}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="w-36 shrink-0 px-2 flex flex-col justify-center gap-0.5">
                                                    <div className="text-[var(--text-primary)] font-medium text-[10px] whitespace-nowrap flex items-center gap-1" title="Sign Up Date">
                                                        <span className="text-[9px] uppercase tracking-wider text-slate-400 w-9">Joined:</span>
                                                        {new Date(created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })} {new Date(created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    <div className="text-[var(--text-secondary)] font-medium text-[10px] whitespace-nowrap flex items-center gap-1" title="Last Login Date">
                                                        <span className="text-[9px] uppercase tracking-wider text-slate-400 w-9">Login:</span>
                                                        {last_sign_in_at ? `${new Date(last_sign_in_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })} ${new Date(last_sign_in_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : 'N/A'}
                                                    </div>
                                                </div>
                                                <div className="w-20 shrink-0 px-2 text-center">
                                                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-[var(--subtle-bg)] border border-[var(--border-color)] text-[var(--text-primary)] font-bold text-[11px]">
                                                        {conversation_count}
                                                    </span>
                                                </div>
                                                <div className="w-56 shrink-0 px-2">
                                                    <div className="flex flex-row items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                                        <span className="text-[9.5px] whitespace-nowrap font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-[1px] rounded shrink-0">
                                                            {userStat.settings?.voice_mode_persona_instruction || 'Therapist'}
                                                        </span>
                                                        <span className="text-[9.5px] whitespace-nowrap font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-[1px] rounded shrink-0">
                                                            {userStat.settings?.voice_mode_voice || 'Puck'}
                                                        </span>
                                                        {userStat.settings?.voice_proactive_mode && (
                                                            <span className="text-[9px] whitespace-nowrap font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-[1px] rounded border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1 shrink-0">
                                                                <div className="w-1 h-1 rounded-full bg-emerald-500"></div> Proactive
                                                            </span>
                                                        )}
                                                        {userStat.settings?.api_key && (
                                                            <span className="text-[9px] whitespace-nowrap font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-1.5 py-[1px] rounded border border-indigo-200 dark:border-indigo-800/50 flex items-center gap-1 shrink-0">
                                                                <Key size={8} /> API Key
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="w-12 shrink-0 px-1 text-right" onClick={(e) => e.stopPropagation()}>
                                                    <button
                                                        onClick={(e) => {
                                                            if (actionPopoverData?.id === id) {
                                                                setActionPopoverData(null);
                                                            } else {
                                                                setActionPopoverData({ id, anchorEl: e.currentTarget });
                                                            }
                                                        }}
                                                        className="p-1 text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                </div>
                                                <div className="w-10 shrink-0 px-1 text-center">
                                                    <button className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--subtle-bg)] rounded-md transition-colors">
                                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                    </button>
                                                </div>
                                                
                                                {/* Right fade gradient for scroll indication */}
                                                <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l to-transparent pointer-events-none z-10 ${maskFromClass}`}></div>
                                            </div>
                                            
                                            {/* Expanded View */}
                                            {isExpanded && (
                                                <div className="bg-slate-50/50 dark:bg-slate-800/30 border-t border-[var(--border-color)] p-2 inset-shadow-sm animate-fade-in">
                                                    <div className="flex flex-col md:flex-row gap-2">
                                                        {/* Profile Info */}
                                                        <div className="flex-1 bg-white dark:bg-slate-900 px-3 py-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 shadow-sm relative overflow-hidden group/card hover:border-indigo-200 dark:hover:border-indigo-800/60 transition-colors">
                                                            <div className="absolute top-0 left-0 w-0.5 h-full bg-indigo-500/50 group-hover/card:bg-indigo-500 transition-colors"></div>
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div className="flex items-center gap-2.5">
                                                                    <img src={avatar_url || fallbackAvatar} alt="Avatar" className="w-8 h-8 rounded-full ring-2 ring-slate-100 dark:ring-slate-800 object-cover" />
                                                                    <div>
                                                                        <div className="font-bold text-slate-800 dark:text-slate-100 text-[13px] leading-tight flex items-center gap-1.5">
                                                                            {full_name || 'Anonymous'}
                                                                            <span className="font-mono text-[9px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">ID: {id.substring(0,8)}</span>
                                                                        </div>
                                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{email}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2 text-[10.5px]">
                                                                <div className="bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 rounded flex items-center gap-1.5 border border-slate-100 dark:border-slate-700/50">
                                                                    <span className="text-slate-400 uppercase font-bold text-[9px] tracking-wider">Joined:</span>
                                                                    <span className="font-medium text-slate-700 dark:text-slate-300">{new Date(created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                                                                </div>
                                                                <div className="bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 rounded flex items-center gap-1.5 border border-slate-100 dark:border-slate-700/50">
                                                                    <span className="text-slate-400 uppercase font-bold text-[9px] tracking-wider">Login:</span>
                                                                    <span className="font-medium text-slate-700 dark:text-slate-300">{last_sign_in_at ? `${new Date(last_sign_in_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at ${new Date(last_sign_in_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : 'Never'}</span>
                                                                </div>
                                                                <div className="bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 rounded flex items-center gap-1.5 border border-slate-100 dark:border-slate-700/50">
                                                                    <span className="text-slate-400 uppercase font-bold text-[9px] tracking-wider">Conversations:</span>
                                                                    <span className="font-bold text-slate-700 dark:text-slate-300">{conversation_count}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* AI Settings */}
                                                        <div className="flex-1 bg-white dark:bg-slate-900 px-3 py-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 shadow-sm relative overflow-hidden group/card hover:border-emerald-200 dark:hover:border-emerald-800/60 transition-colors">
                                                            <div className="absolute top-0 left-0 w-0.5 h-full bg-emerald-500/50 group-hover/card:bg-emerald-500 transition-colors"></div>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Settings size={12}/> AI Configuration</h4>
                                                                <button onClick={() => setEditingUser(userStat)} className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer">
                                                                    <Edit size={10} /> Edit
                                                                </button>
                                                            </div>
                                                            
                                                            <div className="flex flex-wrap gap-2 text-[10.5px]">
                                                                <div className="bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 rounded flex items-center gap-1.5 border border-slate-100 dark:border-slate-700/50 max-w-full">
                                                                    <span className="text-slate-400 uppercase font-bold text-[9px] tracking-wider shrink-0">Persona:</span>
                                                                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{userStat.settings?.voice_mode_persona_instruction || 'Therapist'}</span>
                                                                </div>
                                                                <div className="bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5 rounded flex items-center gap-1.5 border border-slate-100 dark:border-slate-700/50">
                                                                    <span className="text-slate-400 uppercase font-bold text-[9px] tracking-wider">Voice:</span>
                                                                    <span className="font-medium text-slate-700 dark:text-slate-300">{userStat.settings?.voice_mode_voice || 'Puck'}</span>
                                                                </div>
                                                                <div className={`px-2 py-1.5 rounded flex items-center gap-1.5 border ${userStat.settings?.voice_proactive_mode ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400' : 'bg-slate-50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-700/50 text-slate-500'}`}>
                                                                    <span className="uppercase font-bold text-[9px] tracking-wider">Proactive:</span>
                                                                    <span className="font-bold">{userStat.settings?.voice_proactive_mode ? 'On' : 'Off'}</span>
                                                                </div>
                                                                <div className={`px-2 py-1.5 rounded flex items-center gap-1.5 border ${userStat.settings?.api_key ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800/40 text-indigo-700 dark:text-indigo-400' : 'bg-slate-50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-700/50 text-slate-500'}`}>
                                                                    <span className="uppercase font-bold text-[9px] tracking-wider">API Key:</span>
                                                                    <span className="font-bold">{userStat.settings?.api_key ? 'Set' : 'None'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </PanelCard>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 px-4 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-[24px] border-2 border-slate-200 dark:border-slate-800 border-dashed">
                    <div className="w-20 h-20 mb-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center ring-8 ring-slate-50 dark:ring-slate-900/50">
                        <Search size={32} className="text-slate-400 dark:text-slate-500" />
                    </div>
                    <p className='font-bold text-xl text-slate-700 dark:text-slate-300 mb-2'>No users found</p>
                    <p className="text-sm max-w-sm text-center">We couldn't find any users matching your current search and filter criteria.</p>
                </div>
            )}
             {selectedUsers.size > 0 && (
                <BatchActionToolbar
                    selectedCount={selectedUsers.size}
                    totalCount={processedUsers.length}
                    isAllSelected={isAllSelected}
                    onSelectAll={handleSelectAll}
                    onCancel={handleCancelSelection}
                    onDelete={handleBatchDeleteRequest}
                />
            )}
            
            {actionPopoverData && (
                <ActionPopover
                    isOpen={!!actionPopoverData}
                    anchorEl={actionPopoverData.anchorEl}
                    onClose={() => setActionPopoverData(null)}
                >
                    <div className="flex flex-col py-1 min-w-[120px]">
                        <button
                            onClick={() => {
                                const user = processedUsers.find(u => u.user.id === actionPopoverData.id);
                                if (user) setEditingUser(user);
                                setActionPopoverData(null);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer"
                        >
                            <Edit size={14} />
                            Edit Settings
                        </button>
                        <button
                            onClick={() => {
                                handleDeleteRequest(actionPopoverData.id);
                                setActionPopoverData(null);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                        >
                            <Trash2 size={14} />
                            Delete User
                        </button>
                    </div>
                </ActionPopover>
            )}
            
            <ConfirmationModal
                isOpen={deleteConfirmation !== null}
                onClose={() => setDeleteConfirmation(null)}
                onConfirm={handleConfirmDelete}
                title="Confirm User Deletion"
                message={
                    deleteConfirmation?.isBatch 
                        ? <>Are you sure you want to permanently delete <strong>{deleteConfirmation.ids.length} users</strong>? This will remove all their associated data (profiles, conversations, etc.) and cannot be undone.</>
                        : <>Are you sure you want to permanently delete this user? This will remove all their associated data and cannot be undone.</>
                }
                confirmText={deleteConfirmation?.isBatch ? `Delete ${deleteConfirmation.ids.length} Users` : "Delete User"}
                confirmButtonClass="btn-danger"
            />
            
            {editingUser && (
                <UserEditModal 
                    isOpen={!!editingUser}
                    userStat={editingUser}
                    onClose={() => setEditingUser(null)}
                    onSave={() => {
                        loadUsers();
                    }}
                />
            )}
        </div>
    );
};

export default UsersPage;