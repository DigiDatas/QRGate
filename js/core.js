// --- CENTRALIZED SUPABASE CONNECTION & GLOBAL UTILITIES ---
const SUPABASE_URL = 'https://wpqpqlwjprtwoblhvenw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_89l1fu6nVSWxGVOH-g1dQw_i99aUXt9'; 

// Bind to window to prevent obfuscation breaking database queries
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.handleSignOut = async function() {
    await window.supabaseClient.auth.signOut();
    window.location.href = 'index.html';
};

// Global Date Formatter Utility
window.getSafeDate = function(dateString) {
    if (!dateString) return new Date();
    const parsed = new Date(dateString);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
};
