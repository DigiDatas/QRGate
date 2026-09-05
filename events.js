let currentTenantId = null;
let allFetchedEvents = []; 
  let currentEditEventId = null;
let allFetchedGuests = [];
  let currentEditGuestId = null;
  let currentGuestFilterEventId = null;
let currentGuestTierFilter = 'All';
  let currentGuestViewMode = 'list';
let allFetchedLogs = []; // Stores global scan logs for drill-downs

  // --- MOBILE SIDEBAR TOGGLE ---
  function toggleMobileMenu() {
      const sidebar = document.getElementById('mainSidebar');
      const overlay = document.getElementById('mobileSidebarOverlay');
      if (sidebar && overlay) {
          sidebar.classList.toggle('mobile-open');
          overlay.classList.toggle('mobile-open');
      }
  }

  // --- TAB NAVIGATION & HEADER ROUTING ---
  function switchView(viewId, navElement) {
    // Close mobile menu automatically when a link is clicked
    const sidebar = document.getElementById('mainSidebar');
    if (sidebar && sidebar.classList.contains('mobile-open')) toggleMobileMenu();

    // 1. Hide all views and remove active state from buttons
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-bottom-item').forEach(el => el.classList.remove('active')); // Clears bottom nav active states
    
    // 2. Show the requested view
    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add('active');

    // 3. Highlight sidebar item safely
    if (navElement && navElement.classList && navElement.classList.contains('nav-item')) {
      navElement.classList.add('active');
    } else {
      // Robust lookup using element matching
      const allNavButtons = Array.from(document.querySelectorAll('.sidebar button'));
      const matchingNav = allNavButtons.find(b => b.getAttribute('onclick')?.includes(viewId));
      if (matchingNav) matchingNav.classList.add('active');
    }

    // 4. Update Header Titles (Now fully bound to Translation Engine)
    const titleEl = document.getElementById('dynamicPageTitle');
    const subEl = document.getElementById('dynamicPageSubtitle');
    const searchBox = document.getElementById('dynamicSearchContainer');
    const searchInput = document.getElementById('dynamicSearchInput');

    const setHeader = (titleKey, defTitle, subKey, defSub, searchKey, defSearch) => {
        if(titleEl) { titleEl.setAttribute('data-i18n', titleKey); titleEl.innerText = window.t(titleKey, defTitle); }
        if(subEl) { subEl.setAttribute('data-i18n', subKey); subEl.innerText = window.t(subKey, defSub); }
        if(searchBox && searchInput && searchKey) {
            searchBox.style.display = 'block';
            searchInput.setAttribute('data-i18n', searchKey);
            searchInput.placeholder = window.t(searchKey, defSearch);
        } else if (searchBox) {
            searchBox.style.display = 'none';
        }
    };

    if (viewId === 'dashboardView') {
        setHeader('nav_dashboard', 'Dashboard', 'dash_welcome_sub', 'Overview of your activities', null, null);
    } else if (viewId === 'profileView') {
        setHeader('nav_my_profile', 'My Profile', 'sub_create_manage', 'Manage your account and organizer details', null, null);
    } else if (viewId === 'createManageView') {
        setHeader('title_create_manage', 'Create & Manage', 'sub_create_manage', 'Dashboard > Create & Manage', 'search_create_manage', 'Search events, guests, gate passes...');
    } else if (viewId === 'createEventView') {
        setHeader('nav_sub_create_event', 'Create New Event', 'sub_create_manage', 'Dashboard > Create & Manage > Create New Event', null, null);
    } else if (viewId === 'addGuestView') { 
        setHeader('nav_sub_add_guest', 'Add Guest', 'ag_subtitle', 'Add individual guest details manually, or use bulk tools.', null, null);
    } else if (viewId === 'eventsView') {
        setHeader('title_events', 'Events', 'sub_events', 'Manage all your events', 'search_events', 'Search events by name, venue...');
    } else if (viewId === 'guestListsView') {
        setHeader('title_guest_list', 'Guest List', 'sub_guest_list', 'Manage and invite guests for your events', 'search_guests', 'Search guests by name, email or phone...');
        fetchAllGuestsForKPIs(); 
    } else if (viewId === 'gateManagementView') {
        setHeader('title_gate_mgmt', 'Gate Management', 'sub_gate_mgmt', 'Manage physical gates, assign staff, and monitor entry/exit logs', 'search_gates', 'Search gates or staff...');
        loadGateManagementData();
    } else if (viewId === 'designTemplatesView') {
        setHeader('nav_design_templates', 'Design Templates', 'sub_create_manage', 'Choose a template and customize your gate pass', null, null);
    } else if (viewId === 'webInvitationView') {
        setHeader('nav_web_invites', 'Web Invitations', 'sub_create_manage', 'Create stunning RSVP microsites for your events.', null, null);
    }

    // Highlight matching bottom nav item (Fix for Issue 7)
    const allBottomNavs = Array.from(document.querySelectorAll('.mobile-bottom-nav button'));
    const matchingBottomNav = allBottomNavs.find(b => b.getAttribute('onclick')?.includes(viewId));
    if (matchingBottomNav) matchingBottomNav.classList.add('active');

  } // <--- THIS IS THE MISSING BRACKET!

  // --- DATA FETCHING ---
  async function fetchEvents() {
    if (!currentTenantId) return;
    const { data } = await supabaseClient.from('events').select('*').eq('tenant_id', currentTenantId);
    
    const select = document.getElementById('eventSelect');
    if(select) select.innerHTML = '<option value="">-- Select Event --</option>';
    const agSelect = document.getElementById('addGuestEventSelect');
    if(agSelect) agSelect.innerHTML = '<option value="">Select event...</option>';
    const list = document.getElementById('recentEventsList');
    if(list) list.innerHTML = '';

    const eventsTable = document.getElementById('eventsTableBody');
    const cmEventsTable = document.getElementById('createManageEventsTable');
    if (cmEventsTable) cmEventsTable.innerHTML = '';
    if (eventsTable) eventsTable.innerHTML = '';
    
    const tplEvent = document.getElementById('tplEventSelect');
    if (tplEvent) tplEvent.innerHTML = '<option value="">Select Event...</option>';    
    
    // Clear Modal Dropdown
    const modalGateEvent = document.getElementById('modalGateEventSelect');
    if (modalGateEvent) modalGateEvent.innerHTML = '<option value="">Select Event...</option>';
    
    // Clear & Reset Event Pills
    const gatePillsCont = document.getElementById('gateEventPillsContainer');
    if (gatePillsCont) {
        const isAllSelected = window.currentGateEventFilterId === null;
        gatePillsCont.innerHTML = `
          <div onclick="setGateEventFilter(null)" class="card" style="padding: 10px 16px; border-color: ${isAllSelected ? 'var(--color-primary)' : 'var(--color-border)'}; background: ${isAllSelected ? 'var(--color-primary-soft)' : 'var(--color-bg)'}; min-width: 150px; cursor: pointer; display:flex; align-items:center; justify-content:center; flex-shrink: 0; transition: 0.2s;">
            <div style="font-weight:700; color:var(--color-text); font-size:13px;">${window.t('filter_all_events', 'All Events')}</div>
          </div>
        `;
    }

    if (!data || data.length === 0) {
      if(list) list.innerHTML = `<p style="font-size:13px; color:var(--color-text-secondary); padding: 20px;">No events found.</p>`;
      if (eventsTable) eventsTable.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px;">No events created yet.</td></tr>`;
      return;
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    // 1. Pre-calculate Status, Dates, AND Exact Time for Smart Sorting
    data.forEach(e => {
        const evDateStr = e.event_date ? e.event_date.split('T')[0] : null;
        let evDate = evDateStr ? getSafeDate(evDateStr) : new Date(0);
        
        // --- NEW: Calculate exact down-to-the-minute timestamp ---
        let exactDateTime = new Date(evDate.getTime());
        if (e.start_time) {
            const [hours, minutes] = e.start_time.split(':');
            exactDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        } else {
            exactDateTime.setHours(23, 59, 59, 999); // Default to end of day if no time is provided
        }
        e._exactDateTime = exactDateTime;
        // ---------------------------------------------------------

        // Keep a strict midnight copy just for the "Today" status calculation
        evDate.setHours(0,0,0,0);
        e._parsedDate = evDate;

        if (e.is_hidden) {
            e._timeline = 'Cancelled'; e._weight = 4;
            e._bg = 'var(--color-danger-soft)'; e._col = 'var(--color-danger)';
        } else if (evDate.getTime() > today.getTime()) {
            e._timeline = 'Upcoming'; e._weight = 2;
            e._bg = 'var(--color-success-soft)'; e._col = 'var(--color-success)';
        } else if (evDate.getTime() === today.getTime()) {
            e._timeline = 'Ongoing'; e._weight = 1;
            e._bg = '#FEF6E2'; e._col = '#B4790C';
        } else {
            e._timeline = 'Completed'; e._weight = 3;
            e._bg = 'var(--color-info-soft)'; e._col = 'var(--color-info)';
        }
    });

    // 2. Exact Minute-by-Minute Smart Sorting Rules
    data.sort((a, b) => {
        // Group Priority: Ongoing -> Upcoming -> Completed -> Cancelled
        if (a._weight !== b._weight) return a._weight - b._weight;
        
        // Ongoing & Upcoming: Nearest exact time first
        if (a._timeline === 'Ongoing' || a._timeline === 'Upcoming') {
            return a._exactDateTime - b._exactDateTime; 
        }
        // Completed: Most recently finished first
        if (a._timeline === 'Completed') {
            return b._exactDateTime - a._exactDateTime;
        }
        
        return new Date(b.created_at) - new Date(a.created_at);
    });

    allFetchedEvents = data; 

    // Counters for Event Tab KPIs
    let upc = 0, ong = 0, com = 0, can = 0;

    // Helper to convert 24hr to 12hr AM/PM
    function format12Hour(timeStr) {
        if (!timeStr) return 'TBD';
        const parts = timeStr.split(':');
        if (parts.length < 2) return timeStr;
        let h = parseInt(parts[0], 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12; // convert 0 to 12, 13 to 1
        return `${h}:${parts[1]} ${ampm}`;
    }

    data.forEach(e => {
      const isHidden = e.is_hidden === true;
      if (isHidden) can++;
      else if (e._timeline === 'Upcoming') upc++;
      else if (e._timeline === 'Ongoing') ong++;
      else if (e._timeline === 'Completed') com++;
      
      // Populate Dropdowns
      if(select) {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.dataset.approved = e.is_approved;
        opt.textContent = `${e.event_name} (${e.is_approved ? 'Approved' : 'Pending'})${isHidden ? ' - HIDDEN' : ''}`;
        if (isHidden) opt.disabled = true;
        select.appendChild(opt);
      }
      if (tplEvent && !isHidden) {
          tplEvent.innerHTML += `<option value="${e.id}">${e.event_name}</option>`;
      }
// Populate Modal Dropdown
      const modalGateEvent = document.getElementById('modalGateEventSelect');
      if (modalGateEvent && !isHidden) {
          modalGateEvent.innerHTML += `<option value="${e.id}">${e.event_name}</option>`;
      }

      // Populate Horizontal Event Pills
      const gatePillsCont = document.getElementById('gateEventPillsContainer');
      if (gatePillsCont && !isHidden) {
          const isSelected = window.currentGateEventFilterId === e.id;
          const bgCol = isSelected ? 'var(--color-primary-soft)' : 'var(--color-bg)';
          const brdCol = isSelected ? 'var(--color-primary)' : 'var(--color-border)';
          
          gatePillsCont.innerHTML += `
              <div onclick="setGateEventFilter('${e.id}')" class="card" style="padding: 10px 16px; border-color: ${brdCol}; background: ${bgCol}; min-width: 150px; cursor: pointer; display:flex; align-items:center; justify-content:center; flex-shrink: 0; transition: 0.2s;">
                <div style="font-weight:700; color:var(--color-text); font-size:13px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${e.event_name}</div>
              </div>
          `;
      }

      if(agSelect) {
        const optAG = document.createElement('option');
        optAG.value = e.id;
        
        // Block if Hidden OR if Event is Not Approved
        if (isHidden) {
            optAG.textContent = e.event_name + ' (Hidden - Cannot add guests)';
            optAG.disabled = true;
        } else if (!e.is_approved) {
            optAG.textContent = e.event_name + ' 🔒 (Pending Admin Approval)';
            optAG.disabled = true;
        } else {
            optAG.textContent = e.event_name;
        }
        
        agSelect.appendChild(optAG);
      }

      const dateObj = e.created_at ? new Date(e.created_at) : new Date();
      const month = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
      const day = dateObj.getDate();
      const rowStyle = isHidden ? 'opacity: 0.5; background: var(--color-surface-soft);' : '';
      
      const eyeIcon = isHidden 
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';

      const actionBtns = `
        <div style="display:flex; gap:6px;">
          <button onclick="toggleHideEvent('${e.id}', ${isHidden})" style="padding:6px; background:var(--color-bg); border-radius:6px; border:1px solid var(--color-border); color:var(--color-text-secondary); cursor:pointer;">${eyeIcon}</button>
          <button onclick="editEvent('${e.id}')" style="padding:6px; background:var(--color-bg); border-radius:6px; border:1px solid var(--color-border); color:var(--color-info); cursor:pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg></button>
          <button onclick="deleteEvent('${e.id}')" style="padding:6px; background:var(--color-bg); border-radius:6px; border:1px solid var(--color-danger-soft); color:var(--color-danger); cursor:pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>
      `;

      // Admin Approved or Pending status Badge
      const adminStatusBadge = e.is_approved 
    ? `<span class="badge">${window.t('status_approved', 'Approved')}</span>`
    : `<span class="badge">${window.t('status_pending', 'Pending')}</span>`;

      // NEW: Pulse class conditionally added
      const pulseClass = e._timeline === 'Ongoing' ? 'pulse-ongoing' : '';

      if (cmEventsTable) {
        cmEventsTable.innerHTML += `
          <tr style="height: 48px; border-bottom: 1px solid var(--color-border); ${rowStyle}">
            <td style="padding: 10px 20px; font-weight: 600; color: var(--color-text);">${e.event_name}</td>
            <td style="padding: 10px 20px; font-size: 12px; color: var(--color-text-secondary);">${month} ${day}, ${dateObj.getFullYear()}</td>
            <td style="padding: 10px 20px; font-size: 12px; color: var(--color-text-secondary);">${e.venue || 'Location TBD'}</td>
            <td style="padding: 10px 20px; font-weight: 600; text-align:center;">${e.total_capacity}</td>
            <td style="padding: 10px 20px;">${adminStatusBadge}</td>
            <td style="padding: 10px 20px;">${actionBtns}</td>
          </tr>
        `;
      }

      if(list && !isHidden) {
        list.innerHTML += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 4px; border-bottom: 1px solid var(--color-border);">
            <div style="display: flex; gap: 12px; align-items: center;">
              <div class="date-tile" style="width: 36px;"><div class="mon" style="font-size: 8px; padding: 1px 0;">${month}</div><div class="day" style="font-size: 13px; padding: 1px 0;">${day}</div></div>
              <div>
                <div style="font-size: 12px; font-weight: 600; color: var(--color-text);">${e.event_name}</div>
                <div style="font-size: 10px; color: var(--color-text-secondary);">Capacity Limit: ${e.total_capacity}</div>
              </div>
            </div>
            <span class="${pulseClass}" style="display:inline-block; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:600; background:${e._bg}; color:${e._col};">${e._timeline}</span>
          </div>
        `;
      }

      // Populate "Events Tab" Main Table
      if (eventsTable) {
        const displayDate = e.event_date ? new Date(e.event_date.split('T')[0]).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD';
        const displayTime = format12Hour(e.start_time);
        
        eventsTable.innerHTML += `
          <tr style="${rowStyle}">
            <td><div style="display:flex; gap:12px; align-items:center;"><div class="table-avatar">${e.event_name.substring(0,2).toUpperCase()}</div><div><div style="font-weight:600; color:var(--color-text);">${e.event_name}</div><div style="font-size:11px; color:var(--color-text-secondary);">Event</div></div></div></td>
            <td><div style="display:flex; gap:6px; font-weight:500; font-size:12px; color:var(--color-text);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg> ${displayDate}</div></td>
            <td><div style="font-weight:500; font-size:12px; color:var(--color-text);">${displayTime}</div></td>
            <td><div style="display:flex; gap:6px; font-weight:500; font-size:12px; color:var(--color-text);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${e.venue || 'Location TBD'}</div></td>
            <td><div style="font-weight:600; font-size:13px; text-align:center;">${e.total_capacity}</div></td>
            <td>${adminStatusBadge}</td>
            <td><span class="${pulseClass}" style="display:inline-block; padding:4px 10px; border-radius:99px; font-size:11px; font-weight:600; background:${e._bg}; color:${e._col};">${e._timeline}</span></td>
            <td>${actionBtns}</td>
          </tr>
        `;
      }
    });

    // Event KPIs and Donut Update
    const totalE = data.length;
    if(document.getElementById('kpiEvTotal')) document.getElementById('kpiEvTotal').innerText = totalE;
    if(document.getElementById('kpiEvUpcoming')) document.getElementById('kpiEvUpcoming').innerText = upc;
    if(document.getElementById('kpiEvOngoing')) document.getElementById('kpiEvOngoing').innerText = ong;
    if(document.getElementById('kpiEvCompleted')) document.getElementById('kpiEvCompleted').innerText = com;
    if(document.getElementById('kpiEvCancelled')) document.getElementById('kpiEvCancelled').innerText = can;

    if(document.getElementById('eventsDonutTotal')) {
        document.getElementById('eventsDonutTotal').innerText = totalE;
        document.getElementById('evtLegUpc').innerText = upc;
        document.getElementById('evtLegOng').innerText = ong;
        document.getElementById('evtLegCom').innerText = com;
        document.getElementById('evtLegCan').innerText = can;

        const pctUpc = totalE > 0 ? Math.round((upc/totalE)*100) : 0;
        const pctOng = totalE > 0 ? Math.round((ong/totalE)*100) : 0;
        const pctCom = totalE > 0 ? Math.round((com/totalE)*100) : 0;
        const pctCan = totalE > 0 ? Math.round((can/totalE)*100) : 0;

        document.getElementById('evtLegUpcPct').innerText = `(${pctUpc}%)`;
        document.getElementById('evtLegOngPct').innerText = `(${pctOng}%)`;
        document.getElementById('evtLegComPct').innerText = `(${pctCom}%)`;
        document.getElementById('evtLegCanPct').innerText = `(${pctCan}%)`;

        let p1 = pctUpc;
        let p2 = p1 + pctOng;
        let p3 = p2 + pctCom;

        document.getElementById('eventsDonutGraph').style.background = `conic-gradient(
            var(--color-success) 0% ${p1}%,
            #B4790C ${p1}% ${p2}%,
            var(--color-info) ${p2}% ${p3}%,
            var(--color-danger) ${p3}% 100%
        )`;
    }

    // Populate "Guest Lists -> Event Pills" dynamically (WITH DATES AND TIME)
    const glPills = document.getElementById('guestListEventPills');
    if (glPills) {
        let pillsHtml = `
          <div onclick="filterGuestsByEvent(null)" class="card" style="padding: 10px 16px; border-color: ${currentGuestFilterEventId === null ? 'var(--color-primary)' : 'var(--color-border)'}; background: ${currentGuestFilterEventId === null ? 'var(--color-primary-soft)' : 'var(--color-bg)'}; min-width: 120px; cursor: pointer; display:flex; gap:12px; align-items:center; justify-content:center;">
            <div style="font-weight:700; color:var(--color-text); font-size:13px;">${window.t('filter_all_events', 'All Events')}</div>
          </div>
        `;

        data.slice(0, 10).forEach((e) => {
            const isSelected = currentGuestFilterEventId === e.id;
            const displayDate = e.event_date ? new Date(e.event_date.split('T')[0]).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD';
            const displayTime = format12Hour(e.start_time);

            pillsHtml += `
              <div onclick="filterGuestsByEvent('${e.id}')" class="card" style="padding: 10px 16px; border-color: ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}; background: ${isSelected ? 'var(--color-primary-soft)' : 'var(--color-bg)'}; min-width: 240px; cursor: pointer; display:flex; gap:12px; align-items:center;">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: ${e._bg}; color: ${e._col}; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink:0;">
                    ${e.event_name.substring(0,2).toUpperCase()}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight:700; color:var(--color-text); font-size:13px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;">${e.event_name}</span>
                        <span style="font-size:9px; color:${e._col}; background:${e._bg}; padding:2px 6px; border-radius:4px;">${e._timeline}</span>
                    </div>
                    <div style="font-size:11px; color:var(--color-text-secondary); display:flex; justify-content:space-between; font-weight:500;">
                        <span>📅 ${displayDate}</span>
                        <span>⏰ ${displayTime}</span>
                    </div>
                </div>
              </div>
            `;
        });
        
        pillsHtml += `
          <div onclick="switchView('createEventView')" style="display: flex; align-items: center; justify-content: center; padding: 10px 16px; cursor: pointer; color: var(--color-primary); font-size: 13px; font-weight: 600; border: 1.5px dashed var(--color-border); border-radius: var(--radius-md); min-width: 140px; transition: 0.2s;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Event
          </div>
        `;
        glPills.innerHTML = pillsHtml;
    }
    
    fetchAllGuestsForKPIs();
generateNotifications();
  // --- NEW: EVENT LIMIT UI WARNING ---
    const eventBtn = document.getElementById('submitDedicatedEventBtn');
    let evBanner = document.getElementById('eventLimitWarningBanner');
    
    if (!evBanner) {
        evBanner = document.createElement('div');
        evBanner.id = 'eventLimitWarningBanner';
        evBanner.className = 'bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg text-xs font-bold mb-4 hidden';
        const formContainer = document.querySelector('#createEventView .left-col .card');
        if(formContainer) formContainer.prepend(evBanner);
    }

    if (allFetchedEvents.length >= (window.activeMaxEvents || 2) && !currentEditEventId) {
        if(evBanner) {
            evBanner.innerHTML = `${window.t('warn_event_limit', '⚠️ LIMIT REACHED: Your plan allows a maximum of')} ${window.activeMaxEvents} ${window.t('warn_event_limit_2', 'events. You must upgrade to create more.')}`;
            evBanner.classList.remove('hidden');
        }
        if(eventBtn) { eventBtn.disabled = true; eventBtn.style.opacity = '0.5'; eventBtn.style.cursor = 'not-allowed'; }
    } else {
        if(evBanner) evBanner.classList.add('hidden');
        if(eventBtn) { eventBtn.disabled = false; eventBtn.style.opacity = '1'; eventBtn.style.cursor = 'pointer'; }
    }

  }

  // --- INIT & AUTH ---
  async function init() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }
    document.getElementById('userEmailDisplay').innerText = session.user.email;
    await checkTenantProfile(session);
  }

  // Global variables to track status
  window.currentAccountStatus = 'Pending';
  window.currentPlanTier = 'Basic'; 
  window.currentTenantPhone = ''; // <-- ADDED THIS

  // --- PROFILE FETCH AND SAVE LOGIC ---
  async function checkTenantProfile(session) {
    const userId = session.user.id;
    let { data: tenant, error } = await supabaseClient.from('tenants').select('*').eq('owner_id', userId).maybeSingle();

    // 1. Restore the missing code to create a new tenant if they don't exist yet!
    if (!tenant) {
        const { data: newTenant } = await supabaseClient.from('tenants').insert([{
            owner_id: userId,
            email: session.user.email,
            account_status: 'Pending',
            payment_status: 'Unpaid',
            subscription_status: 'Basic'
        }]).select().single();
        tenant = newTenant;
    }

    // 2. The Auto-Expire Gatekeeper!
    if (tenant && tenant.subscription_status !== 'Basic' && tenant.plan_expires_at) {
        const expiresAt = new Date(tenant.plan_expires_at);
        if (new Date() > expiresAt) {
            // Plan has expired! Auto-downgrade to Basic.
            await supabaseClient.from('tenants').update({
                subscription_status: 'Basic',
                plan_start_date: null,
                plan_expires_at: null
            }).eq('id', tenant.id);
            
            tenant.subscription_status = 'Basic';
            alert("Your premium plan has expired. Your account has been reverted to the Basic plan.");
        }
    }

    // 3. Set the global ID and load the dashboard!
    if (tenant) {
      currentTenantId = tenant.id;
      
      // Save status, tier, and phone globally, then apply locks!
      window.currentAccountStatus = tenant.account_status || 'Pending';
      window.currentPlanTier = tenant.subscription_status || 'Basic';
      window.currentTenantPhone = tenant.phone || ''; // <-- ADDED THIS
      
      applyAccountLocks();
      
document.getElementById('dashboardWelcomeTitle').innerText = window.t('dash_welcome_main', 'Welcome back, ') + ' ' + (tenant.full_name || 'Admin') + '! 👋';
      // Configure badge colors based on plan
      let planColor = window.currentPlanTier.toLowerCase() === 'premium' ? 'text-pink-500 bg-pink-500/10 border-pink-500/20' : 
                      window.currentPlanTier.toLowerCase() === 'pro' ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' : 
                      'text-slate-400 bg-slate-800 border-slate-700';

      const badgeHtml = `<span class="ml-2 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${planColor}">${window.currentPlanTier}</span>`;

      // Inject into Sidebar
      document.getElementById('userNameDisplay').innerHTML = (tenant.full_name || 'New Organizer') + badgeHtml;
      
      // Inject into Profile Page (This line replaces BOTH old lines safely)
      document.getElementById('profileNameDisplay').innerHTML = (tenant.full_name || 'New Organizer') + badgeHtml;
// NEW: Dynamic Limits Engine (Fetched from Database)
      const { data: dbLimits } = await supabaseClient.from('plan_limits').select('*');
      const currentPlanData = dbLimits ? dbLimits.find(p => p.plan_name.toLowerCase() === window.currentPlanTier.toLowerCase()) : null;
      
      // Save limits globally for the UI forms to use
      window.activeMaxEvents = currentPlanData ? parseInt(currentPlanData.max_events) : 2;
      window.activeMaxGuests = currentPlanData ? parseInt(currentPlanData.max_guests) : 50;

      // Rebuild the features array manually since limits are now dynamic
      let feats = ['Standard Gate Passes', 'WhatsApp & Email Sharing'];
      if (window.currentPlanTier.toLowerCase() !== 'basic') feats.push('Bulk Excel Upload', 'Custom Brand Fonts');
      if (window.currentPlanTier.toLowerCase() === 'premium') feats.push('AI Pass Generation');

      const activeLimit = { 
          ev: window.activeMaxEvents >= 999999 ? 'Unlimited' : window.activeMaxEvents, 
          gu: window.activeMaxGuests >= 999999 ? 'Unlimited' : window.activeMaxGuests, 
          feats: feats 
      };

      const badgeLg = document.getElementById('profilePlanBadgeLarge');
      if (badgeLg) {
          badgeLg.innerText = window.currentPlanTier;
          badgeLg.className = `ml-2 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border ${planColor}`;
      }
      
      if (document.getElementById('profileLimitEvents')) document.getElementById('profileLimitEvents').innerText = activeLimit.ev;
      if (document.getElementById('profileLimitGuests')) document.getElementById('profileLimitGuests').innerText = activeLimit.gu;
      
      // NEW: Inject limits into the sidebar tips!
      if (document.getElementById('tipEventLimit')) document.getElementById('tipEventLimit').innerText = activeLimit.ev;
      if (document.getElementById('tipGuestLimit')) document.getElementById('tipGuestLimit').innerText = activeLimit.gu;
      if (document.getElementById('agLimitGuest')) document.getElementById('agLimitGuest').innerText = activeLimit.gu;

      const featList = document.getElementById('profileFeatureList');
      if (featList) {
          featList.innerHTML = activeLimit.feats.map(f => `<li style="display:flex; align-items:center; gap:8px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> ${f}</li>`).join('');
      }
      
      document.getElementById('userAvatar').innerText = (tenant.full_name || 'N').charAt(0).toUpperCase();
      document.getElementById('profileEmailDisplay').innerText = session.user.email; 
      document.getElementById('profileAvatarLarge').innerText = (tenant.full_name || 'N').charAt(0).toUpperCase();
      
      document.getElementById('settingName').value = tenant.full_name || '';
      document.getElementById('settingCompany').value = tenant.company_name || '';
      
      // Smartly split the saved country code and number
      let savedPhone = tenant.phone || '';
      let codeMatch = savedPhone.match(/^(\+\d{2,3})(.*)$/);
      if (codeMatch) {
          document.getElementById('settingPhoneCode').value = codeMatch[1];
          document.getElementById('settingPhone').value = codeMatch[2];
          document.getElementById('profilePhoneCode').value = codeMatch[1];
          document.getElementById('profilePhone').value = codeMatch[2];
      } else {
          document.getElementById('settingPhone').value = savedPhone;
          document.getElementById('profilePhone').value = savedPhone;
      }

      const profileBanner = document.getElementById('tenantProfileCard');

      if (!tenant.full_name || !tenant.company_name || !tenant.phone) { 
          if(profileBanner) profileBanner.classList.remove('hidden');
          document.getElementById('profileName').value = tenant.full_name || '';
          document.getElementById('profileCompany').value = tenant.company_name || '';
          document.getElementById('profilePhone').value = tenant.phone || '';
      } else {
          if(profileBanner) profileBanner.classList.add('hidden');
      }
      
      await fetchEvents();
      await fetchSavedTemplates(); 
      await updateRecentGatesWidget();    
    }
  }

  // --- SAAS UI LOCK LOGIC ---
  function applyAccountLocks() {
      const isApproved = window.currentAccountStatus === 'Approved';
      const isBasic = !window.currentPlanTier || window.currentPlanTier.toLowerCase() === 'basic';
      
      // 1. ACCOUNT APPROVAL LOCKS
      const approvalLockElements = [
          document.getElementById('submitDedicatedEventBtn'),
          document.getElementById('submitAddGuestBtn'),
          document.querySelector('button[onclick*="openAddGateModal"]'),
          document.querySelector('button[onclick*="openAddGatemanModal"]'),
          document.querySelector('button[onclick*="saveGatePassTemplate(false)"]'),
          document.querySelector('button[onclick*="saveGatePassTemplate(true)"]')
      ];
      
      let banner = document.getElementById('saasLockBanner');
      if (!banner) {
          banner = document.createElement('div');
          banner.id = 'saasLockBanner';
          banner.className = 'locked-banner';
          banner.innerHTML = '🔒 Your account is pending admin approval. You are currently in View-Only mode.';
          const mainContent = document.querySelector('.main-content');
          if (mainContent && mainContent.parentNode) mainContent.parentNode.insertBefore(banner, mainContent);
      }

      if (!isApproved) {
          banner.style.display = 'block';
          approvalLockElements.forEach(el => { if(el) el.classList.add('approval-locked'); });
      } else {
          banner.style.display = 'none';
          approvalLockElements.forEach(el => { if(el) el.classList.remove('approval-locked'); });
      }

      // 2. PLAN TIER LOCKS (The Paywall)
      const premiumElements = [
          { el: document.querySelector('div[onclick*="AI Generation"]'), label: "Generate AI Passes" },
          { el: document.querySelector('button[onclick*="toggleFontExplorer()"]'), label: "Custom Brand Fonts" },
          { el: document.querySelector('button[onclick*="bulk"]'), label: "Bulk Excel Upload" },
          { el: document.querySelector('button[onclick*="auto"]'), label: "Auto-Generate Passes" }
      ];

      premiumElements.forEach(item => {
          if (!item.el) return;
          if (isBasic) {
              item.el.classList.add('premium-locked');
              // Forcefully overwrite the click behavior to open the paywall
              item.el.removeAttribute('onclick'); 
              item.el.onclick = (e) => {
                  e.preventDefault(); e.stopPropagation();
                  openUpgradeModal(item.label);
              };
          } else {
              item.el.classList.remove('premium-locked');
              // Restore default onclick functionality if plan is upgraded!
              if (item.label === 'Bulk Excel Upload') item.el.onclick = () => toggleGuestInputMode('bulk');
              if (item.label === 'Auto-Generate Passes') item.el.onclick = () => toggleGuestInputMode('auto');
              if (item.label === 'Custom Brand Fonts') item.el.onclick = () => toggleFontExplorer();
              if (item.label === 'Generate AI Passes') item.el.onclick = () => alert('AI Generation feature is coming in V2!');
          }
      });
  }

  // --- UPGRADE MODAL LOGIC ---
  function openUpgradeModal(featureName) {
      const currentPlan = (window.currentPlanTier || 'Basic').toLowerCase();
      
      const btnBasic = document.getElementById('btnReqBasic');
      const btnPro = document.getElementById('btnReqPro');
      const btnPremium = document.getElementById('btnReqPremium');
      const modalTitle = document.querySelector('#upgradeModal h2');
      const modalDesc = document.querySelector('#upgradeModal p');

      // 1. Dynamic Title and Description (Translated via window.t)
      if (modalTitle) {
          modalTitle.innerHTML = `${window.t('upg_title_change', 'Change')} <span class="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-indigo-400">${window.t('upg_title_plan', 'Subscription Plan')}</span>`;
      }

      if (featureName === 'Plan Upgrade') {
          if (modalDesc) modalDesc.innerHTML = `${window.t('upg_desc_curr_plan', 'You are currently on the')} <strong class="text-slate-200 uppercase">${window.currentPlanTier || 'Basic'}</strong> ${window.t('upg_desc_curr_plan_2', 'plan. Select a new plan below to request a change.')}`;
      } else {
          // Attempt to translate the feature name itself if possible, otherwise use the passed string
          let safeFeatureName = featureName;
          if (featureName.includes('Fonts')) safeFeatureName = window.t('upg_feat_2', featureName);
          if (featureName.includes('Bulk')) safeFeatureName = window.t('upg_feat_3', featureName);
          if (featureName.includes('Web Inv')) safeFeatureName = window.t('nav_web_invites', featureName);

          if (modalDesc) modalDesc.innerHTML = `${window.t('upg_desc_feat_1', 'The feature')} <strong class="text-slate-200">"${safeFeatureName}"</strong> ${window.t('upg_desc_feat_2', 'requires a different plan. Select an option below to request an account update.')}`;
      }

      // 2. Reset all buttons to hidden first
      if (btnBasic) btnBasic.style.display = 'none';
      if (btnPro) btnPro.style.display = 'none';
      if (btnPremium) btnPremium.style.display = 'none';

      // 3. Show the EXACT two buttons the user doesn't have (Translated via window.t)
      if (currentPlan === 'basic') {
          if (btnPro) { btnPro.style.display = 'flex'; btnPro.innerHTML = window.t('upg_btn_up_pro', 'Upgrade to Pro'); }
          if (btnPremium) { btnPremium.style.display = 'flex'; btnPremium.innerHTML = window.t('upg_btn_up_prem', 'Upgrade to Premium'); }
      } else if (currentPlan === 'pro') {
          if (btnBasic) { btnBasic.style.display = 'flex'; btnBasic.innerHTML = window.t('upg_btn_down_basic', 'Downgrade to Basic'); }
          if (btnPremium) { btnPremium.style.display = 'flex'; btnPremium.innerHTML = window.t('upg_btn_up_prem', 'Upgrade to Premium'); }
      } else if (currentPlan === 'premium') {
          if (btnBasic) { btnBasic.style.display = 'flex'; btnBasic.innerHTML = window.t('upg_btn_down_basic', 'Downgrade to Basic'); }
          if (btnPro) { btnPro.style.display = 'flex'; btnPro.innerHTML = window.t('upg_btn_down_pro', 'Downgrade to Pro'); }
      }

      // 4. Reveal the Modal
      document.getElementById('upgradeModal').classList.remove('hidden');
  }

  async function requestUpgrade(targetTier, btnElement = null) {
      if (!currentTenantId) return alert("Account not found.");
      
      const targetBtn = btnElement;
      const originalText = targetBtn ? targetBtn.innerHTML : 'Request Upgrade';
      
      if (targetBtn) {
          targetBtn.innerHTML = 'Sending...';
          targetBtn.disabled = true;
          targetBtn.style.opacity = '0.5';
          targetBtn.style.cursor = 'not-allowed';
      }
      
      // Send the specific tier request to Supabase
      const { error } = await supabaseClient
          .from('tenants')
          .update({ upgrade_request: `Pending ${targetTier}` })
          .eq('id', currentTenantId);

      if (error) {
          alert('Failed to send request: ' + error.message);
          if (targetBtn) {
              targetBtn.innerHTML = originalText;
              targetBtn.disabled = false;
              targetBtn.style.opacity = '1';
              targetBtn.style.cursor = 'pointer';
          }
      } else {
          // Success Feedback
          if (targetBtn) {
              targetBtn.innerHTML = 'Sent ✓';
          }
          setTimeout(() => {
              const upgradeModal = document.getElementById('upgradeModal');
              if (upgradeModal) upgradeModal.classList.add('hidden');
              // Reset the button so it's fresh for next time
              if (targetBtn) {
                  targetBtn.innerHTML = originalText;
                  targetBtn.disabled = false;
                  targetBtn.style.opacity = '1';
                  targetBtn.style.cursor = 'pointer';
              }
          }, 1500);
      }
  }
// --- GUEST LIST TOGGLES ---
  function filterGuestsByTier(tier) {
      currentGuestTierFilter = tier;
      renderGuestListsTab(); // We will create this modular render function next
  }

  function toggleGuestView(mode) {
      currentGuestViewMode = mode;
      
      const btnList = document.getElementById('btnGuestList');
      const btnGrid = document.getElementById('btnGuestGrid');
      const contList = document.getElementById('guestListContainerList');
      const contGrid = document.getElementById('guestListContainerGrid');

      if (mode === 'list') {
          btnList.classList.add('active');
          btnGrid.classList.remove('active');
          contList.style.display = 'block';
          contGrid.style.display = 'none';
      } else {
          btnGrid.classList.add('active');
          btnList.classList.remove('active');
          contList.style.display = 'none';
          contGrid.style.display = 'grid'; // 6 columns defined in inline style
      }
  }
  
  async function fetchAllGuestsForKPIs() {
    // NEW FIX: Safety Guard to prevent 400 Bad Request Crash!
    if (!currentTenantId) return; 

    const { data: events } = await supabaseClient.from('events').select('id, event_name').eq('tenant_id', currentTenantId);
    
    const dashboardGuestList = document.getElementById('recentGuestsList');
    if (dashboardGuestList) dashboardGuestList.innerHTML = '';
        
    if (!events || events.length === 0) {
        allFetchedGuests = [];
        const activeBtn = document.querySelector('#dashboardDateFilters .btn-filter-nav.active');
        applyDashboardFilter('All Time', activeBtn);
        renderGuestListsTab(); // Run empty render
        return;
    }
    
    const eventIds = events.map(e => e.id);
    const { data: guests } = await supabaseClient.from('guests').select('*, events(event_name)').in('event_id', eventIds);
// NEW: Fetch all scan logs globally for the drill-downs
    const { data: logs } = await supabaseClient.from('scan_logs').select('*, gates(gate_name), gatemen(name)').in('event_id', eventIds);
    allFetchedLogs = logs || [];
    
    // --- SMART SORTING GUESTS ---
    if (guests) {
        guests.forEach(g => {
            const parentEv = allFetchedEvents.find(e => e.id === g.event_id);
            g._evWeight = parentEv ? parentEv._weight : 5;
            // Pull the highly precise exactDateTime from the parent event
            g._evExactDateTime = parentEv ? parentEv._exactDateTime : new Date(0);
        });

        guests.sort((a, b) => {
            // Group Priority: Ongoing -> Upcoming -> Completed -> Cancelled
            if (a._evWeight !== b._evWeight) return a._evWeight - b._evWeight;
            
            // Ongoing & Upcoming: Nearest exact time first
            if (a._evWeight === 1 || a._evWeight === 2) {
                return a._evExactDateTime - b._evExactDateTime; 
            }
            
            // Completed: Most recently finished first
            if (a._evWeight === 3) {
                return b._evExactDateTime - a._evExactDateTime;
            }
            
            return getSafeDate(b.created_at) - getSafeDate(a.created_at); // Fallback
        });
    }

    allFetchedGuests = guests || [];

    if (guests) {
      document.getElementById('kpiGuests').innerText = guests.length;
      document.getElementById('kpiPasses').innerText = guests.length;

      // --- CALCULATE DONUT CHART METRICS ---
      let totalGuestsCount = guests.length;
      let checkedInCount = 0;
      
      guests.forEach(g => {
        if ((g.checked_in_count || 0) >= (g.allowed_capacity || 1)) {
            checkedInCount++;
        }
      });

      let pendingCount = totalGuestsCount - checkedInCount;
      let noShowCount = 0; 
      
      let checkedInPct = totalGuestsCount > 0 ? Math.round((checkedInCount / totalGuestsCount) * 100) : 0;
      let pendingPct = totalGuestsCount > 0 ? Math.round((pendingCount / totalGuestsCount) * 100) : 0;
      let noShowPct = totalGuestsCount > 0 ? Math.round((noShowCount / totalGuestsCount) * 100) : 0;

      const donutTotalEl = document.getElementById('donutTotalGuests');
      if(donutTotalEl) {
          donutTotalEl.innerText = totalGuestsCount;
          document.getElementById('legendCheckedIn').innerText = checkedInCount;
          document.getElementById('legendCheckedInPct').innerText = `(${checkedInPct}%)`;
          document.getElementById('legendPending').innerText = pendingCount;
          document.getElementById('legendPendingPct').innerText = `(${pendingPct}%)`;
          document.getElementById('legendNoShow').innerText = noShowCount;
          document.getElementById('legendNoShowPct').innerText = `(${noShowPct}%)`;

          let greenEnd = checkedInPct;
          let yellowEnd = greenEnd + pendingPct;
          
          document.getElementById('dashboardDonut').style.background = `conic-gradient(
              var(--color-success) 0% ${greenEnd}%, 
              var(--color-warning) ${greenEnd}% ${yellowEnd}%, 
              var(--color-danger) ${yellowEnd}% 100%
          )`;
      }
      
      const tplGuest = document.getElementById('tplGuestSelect');
      if (tplGuest) tplGuest.innerHTML = '<option value="">First Select Event...</option>';

      // Render OTHER tabs (Dashboard Lists, Gate Passes Tab, QR Codes Tab)
      guests.forEach((g, index) => {
        const isApproved = document.querySelector(`option[value="${g.event_id}"]`)?.dataset.approved === 'true';
        const shortId = g.id.substring(0, 8).toUpperCase();
        
        const safeEvName = g.events ? g.events.event_name : 'Event';
        
        const btnHtml = isApproved 
          ? `<button onclick="showTicket('${g.id}', '${encodeURIComponent(g.guest_name)}', '${encodeURIComponent(g.ticket_tier || 'General')}', ${g.allowed_capacity || 1}, '${encodeURIComponent(safeEvName)}', '${g.event_id}')" class="btn-qr"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><line x1="17.5" y1="14" x2="17.5" y2="21"/><line x1="14" y1="17.5" x2="21" y2="17.5"/></svg> View Pass</button>`
          : `<button disabled class="btn-qr" style="opacity: 0.5;">Pending</button>`;

        if (dashboardGuestList && index < 5) {
          dashboardGuestList.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 4px; border-bottom: 1px solid var(--color-border);">
              <div>
                <div style="font-size: 12px; font-weight: 600; color: var(--color-text);">${g.guest_name}</div>
                <div style="font-size: 10px; color: var(--color-text-secondary);">${safeEvName}</div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="font-size: 11px; color: var(--color-text-secondary);">${g.ticket_tier || 'General'}</div>
                ${btnHtml}
              </div>
            </div>
          `;
        }
      });

    } 

    const activeFilterBtn = document.querySelector('#dashboardDateFilters .btn-filter-nav.active');
    applyDashboardFilter('All Time', activeFilterBtn);
    
    // FINALLY: Render the Guest List Tab (Handles Tier Filtering, Grid, and List Views)
    renderGuestListsTab();
    
    // Initialize Gate Management Data
    loadGateManagementData();
  }

  // --- GUEST LIST RENDERER (WITH GRID & LIST) ---
  function renderGuestListsTab() {
      const guestListTable = document.getElementById('guestListTableBody');
      const guestListGrid = document.getElementById('guestListContainerGrid');
      const tierFiltersContainer = document.getElementById('guestTierFilters');
      
      if (!guestListTable || !guestListGrid || !tierFiltersContainer) return;

      guestListTable.innerHTML = '';
      guestListGrid.innerHTML = '';

      // 1. Filter by Event First
      let baseGuests = allFetchedGuests;
      if (currentGuestFilterEventId !== null) {
          baseGuests = allFetchedGuests.filter(g => g.event_id === currentGuestFilterEventId);
      }

      // 2. Build Tier Statistics dynamically based on the active event
      const tiers = { 'All': baseGuests.length };
      baseGuests.forEach(g => {
          const tier = g.ticket_tier || 'General';
          tiers[tier] = (tiers[tier] || 0) + 1;
      });

      // 3. Render Dynamic Filter Tabs
      tierFiltersContainer.innerHTML = '';
      for (const [tier, count] of Object.entries(tiers)) {
          const isSelected = currentGuestTierFilter === tier || (currentGuestTierFilter === 'All' && tier === 'All');
          const colorStr = isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)';
          const borderStr = isSelected ? `2px solid var(--color-primary)` : '2px solid transparent';
          const weightStr = isSelected ? '700' : '500';
          
          const tabLabel = tier === 'All' ? window.t('filter_all_guests', 'All Guests') : tier;
          tierFiltersContainer.innerHTML += `
              <div onclick="filterGuestsByTier('${tier}')" style="padding-bottom: 12px; border-bottom: ${borderStr}; color: ${colorStr}; font-weight: ${weightStr}; font-size: 13px; cursor: pointer;">
                  ${tabLabel} (${count})
              </div>
          `;
      }

      // 4. Apply Tier Filter
      let finalGuests = baseGuests;
      if (currentGuestTierFilter !== 'All') {
          finalGuests = baseGuests.filter(g => (g.ticket_tier || 'General') === currentGuestTierFilter);
      }

      // 5. Render Data
      if (finalGuests.length === 0) {
          guestListTable.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;">No guests match the selected filters.</td></tr>`;
          guestListGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--color-text-secondary);">No guests match the selected filters.</div>`;
          return;
      }

      finalGuests.forEach(g => {
          const dateObj = getSafeDate(g.created_at);
          const formattedDate = dateObj.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
          const formattedTime = dateObj.toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' });
          
          const capacityCount = g.allowed_capacity || 1;
          const checkedInPairs = g.checked_in_count || 0;
          const checkInBadgeColor = checkedInPairs > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)';
          const checkInBadgeBg = checkedInPairs > 0 ? 'var(--color-success-soft)' : 'var(--color-surface-soft)';

          const gEmail = g.email || 'No email provided';
          const gPhone = g.phone || 'No phone provided';
          const gCompany = g.company || 'Independent';
          const gStatus = g.invitation_status || 'Pending';
          const isHidden = g.is_hidden === true;
          const rowStyle = isHidden ? 'opacity: 0.5; background: var(--color-surface-soft);' : '';
          
          let statusColor = 'var(--color-warning)'; let statusBg = '#FEF6E2';
          if(gStatus === 'Accepted' || gStatus === 'Active') { statusColor = 'var(--color-success)'; statusBg = 'var(--color-success-soft)'; }

          let sentViaIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
          if (g.sent_via === 'WhatsApp') sentViaIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';

          const eyeIcon = isHidden 
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';

          const seqQrId = 'QR-' + String(g.ticket_number || 0).padStart(3, '0');
          const evName = g.events ? g.events.event_name : 'General Event';
          const tierName = g.ticket_tier || 'General';

          // --- DRILL DOWN DATA GENERATION FOR GUESTS ---
          const guestLogs = allFetchedLogs.filter(l => l.guest_id === g.id).sort((a,b) => new Date(b.scanned_at) - new Date(a.scanned_at));
          
          // NEW: Calculate Exited Pairs dynamically from the scan logs!
          const exitedPairs = guestLogs.filter(l => l.scan_type === 'Exit').length;

          let logsHtml = guestLogs.length === 0 
              ? '<div style="font-size:11px; color:var(--color-text-secondary); padding: 4px;">No scan records found for this guest yet.</div>' 
              : guestLogs.map(l => {
                  const time = new Date(l.scanned_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                  const date = new Date(l.scanned_at).toLocaleDateString([], {month: 'short', day: 'numeric'});
                  const color = l.scan_type === 'Entry' ? 'var(--color-success)' : 'var(--color-info)';
                  return `<div style="border-left: 3px solid ${color}; padding-left: 10px; min-width: 160px; background: var(--color-bg); padding: 8px 10px 8px 10px; border-radius: 4px; border-top: 1px solid var(--color-border); border-right: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); flex-shrink: 0;">
                      <div style="font-size:11px; font-weight:700; color:${color}; margin-bottom: 2px;">${l.scan_type.toUpperCase()} • ${time}</div>
                      <div style="font-size:12px; font-weight:600; color: var(--color-text);">${l.gates?.gate_name || 'Unknown Gate'}</div>
                      <div style="font-size:10px; color:var(--color-text-secondary); margin-top: 2px;">${date} • Staff: ${l.gatemen?.name || 'System Override'}</div>
                  </div>`;
              }).join('');

          // RENDER LIST VIEW ROW
          guestListTable.innerHTML += `
             <tr onclick="toggleDrilldown('drilldown-guest-${g.id}', event)" style="cursor:pointer; transition: background 0.2s; ${rowStyle}" onmouseover="this.style.background='var(--color-surface-soft)'" onmouseout="this.style.background='transparent'">
               <td>
                 <div style="display:flex; gap:12px; align-items:center;">
                   <div class="table-avatar" style="background:#F3E8FF; color:#9333EA;">${g.guest_name.substring(0,2).toUpperCase()}</div>
                   <div><div style="font-weight:600; color:var(--color-text);">${g.guest_name}</div><div style="font-size:11px; color:var(--color-text-secondary);">${gCompany}</div></div>
                 </div>
               </td>
               <td>
                 <div style="font-weight:600; font-size:13px; color:var(--color-text);">${evName}</div>
                 <div style="font-size:11px; color:var(--color-text-secondary);">${tierName}</div>
               </td>
               <td><div style="font-size:12px; color:var(--color-text);">${gEmail}</div><div style="font-size:11px; color:var(--color-text-secondary);">${gPhone}</div></td>
               <td><span style="display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:99px; background:${statusBg}; color:${statusColor}; font-size:11px; font-weight:600;">${gStatus}</span></td>
               <td><div style="display:flex; gap:8px;"><div style="width:24px; height:24px; border-radius:50%; background:var(--color-surface-soft); color:var(--color-text-secondary); display:flex; align-items:center; justify-content:center;">${sentViaIcon}</div><span style="font-size: 11px; font-weight: 500; display:flex; align-items:center;">${g.sent_via || 'System'}</span></div></td>
               <td>
                 <div onclick="showTicket('${g.id}', '${encodeURIComponent(g.guest_name)}', '${encodeURIComponent(g.ticket_tier || 'General')}', ${g.allowed_capacity}, '${encodeURIComponent(evName)}', '${g.event_id}')" style="display:flex; align-items:center; gap:8px; cursor:pointer; color:var(--color-primary); padding: 4px; border-radius: 6px; transition: background 0.2s;" onmouseover="this.style.background='var(--color-primary-soft)'" onmouseout="this.style.background='transparent'">
                   <div style="width:32px; height:32px; background:var(--color-primary-soft); border-radius:6px; display:flex; align-items:center; justify-content:center; color:var(--color-primary); flex-shrink:0;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg></div>
                   <div style="display:flex; flex-direction:column; gap:2px;">
                     <div style="font-weight:700; font-size:12px; font-family:monospace; color:var(--color-text);">${seqQrId}</div>
                     <div style="display:flex; align-items:center; gap:6px;">
                       <span style="font-size:10px; font-weight:700; color:${checkInBadgeColor}; background:${checkInBadgeBg}; padding:1px 6px; border-radius:4px;">${checkedInPairs}/${capacityCount} In</span>
                     </div>
                   </div>
                 </div>
               </td>
               
               <!-- NEW: Exits Column -->
               <td>
                 <span style="font-size:10px; font-weight:700; color:var(--color-info); background:var(--color-info-soft); padding:4px 8px; border-radius:4px;">${exitedPairs} Out</span>
               </td>

               <td><div style="font-size:12px; color:var(--color-text);">${formattedDate}</div><div style="font-size:11px; color:var(--color-text-secondary);">${formattedTime}</div></td>
               <td>
                 <div style="display:flex; gap:6px;">
                   <button onclick="toggleHideGuest('${g.id}', ${isHidden})" style="padding:6px; background:var(--color-bg); border-radius:6px; border:1px solid var(--color-border); color:var(--color-text-secondary); cursor:pointer;" title="Show/Hide">${eyeIcon}</button>
                   <button onclick="editGuest('${g.id}')" style="padding:6px; background:var(--color-bg); border-radius:6px; border:1px solid var(--color-border); color:var(--color-info); cursor:pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg></button>
                   <button onclick="deleteGuest('${g.id}')" style="padding:6px; background:var(--color-bg); border-radius:6px; border:1px solid var(--color-danger-soft); color:var(--color-danger); cursor:pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                 </div>
               </td>
             </tr>
             <tr id="drilldown-guest-${g.id}" class="drilldown-row" style="display:none; background: var(--color-surface-soft);">
               <td colspan="9" style="padding: 12px 20px; border-bottom: 1px solid var(--color-border);">
                 <div style="display:flex; gap:12px; overflow-x:auto; padding-bottom:4px;" class="no-scrollbar">
                    ${logsHtml}
                 </div>
               </td>
             </tr>
          `;

          // RENDER GRID VIEW CARD
          guestListGrid.innerHTML += `
             <div class="card panel" style="${rowStyle} padding: 20px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; position: relative;">
               <span style="position:absolute; top:12px; left:12px; padding:2px 8px; border-radius:99px; background:${statusBg}; color:${statusColor}; font-size:10px; font-weight:600;">${gStatus}</span>
               
               <!-- FIX: Added encodeURIComponent to the ticket tier here so it matches the list view and prevents crashes! -->
               <button onclick="showTicket('${g.id}', '${encodeURIComponent(g.guest_name)}', '${encodeURIComponent(g.ticket_tier || 'General')}', ${g.allowed_capacity || 1}, '${encodeURIComponent(evName)}', '${g.event_id}')" style="position:absolute; top:12px; right:12px; border:none; background:var(--color-primary-soft); color:var(--color-primary); border-radius:6px; padding:4px; cursor:pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg></button>
               
               <div style="width: 56px; height: 56px; border-radius: 50%; background: #F3E8FF; color: #9333EA; font-size: 20px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 12px;">${g.guest_name.substring(0,2).toUpperCase()}</div>
               
               <div>
                 <div style="font-size: 14px; font-weight: 700; color: var(--color-text); margin-bottom: 2px;">${g.guest_name}</div>
                 <div style="font-size: 11px; color: var(--color-text-secondary);">${gCompany}</div>
               </div>

               <div style="width: 100%; border-top: 1px dashed var(--color-border); padding-top: 12px; margin-top: auto;">
                 <div style="font-size: 12px; font-weight: 600; color: var(--color-text); margin-bottom: 2px;">${evName}</div>
                 <div style="font-size: 11px; color: var(--color-text-secondary); margin-bottom: 12px;">${tierName}</div>
                 
                 <div style="display:flex; justify-content: center; gap:6px;">
                   <button onclick="toggleHideGuest('${g.id}', ${isHidden})" style="padding:6px; background:var(--color-bg); border-radius:6px; border:1px solid var(--color-border); color:var(--color-text-secondary); cursor:pointer;" title="Show/Hide">${eyeIcon}</button>
                   <button onclick="editGuest('${g.id}')" style="padding:6px; background:var(--color-bg); border-radius:6px; border:1px solid var(--color-border); color:var(--color-info); cursor:pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg></button>
                   <button onclick="deleteGuest('${g.id}')" style="padding:6px; background:var(--color-bg); border-radius:6px; border:1px solid var(--color-danger-soft); color:var(--color-danger); cursor:pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                 </div>
               </div>
             </div>
          `;
      });
  }

  // --- DASHBOARD FILTER & GRAPH LOGIC ---
  let dashboardChartInstance = null;


  // FIX: Helper to safely parse dates, defaulting to right now if missing
  function getSafeDate(dateString) {
      if (!dateString) return new Date();
      const parsed = new Date(dateString);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function applyDashboardFilter(period, btnElement) {
      // 1. Update UI Buttons safely
      if (btnElement && btnElement.parentElement) {
          btnElement.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btnElement.classList.add('active');
      }

      // 2. Calculate Date Range
      const now = new Date();
      let startDate = new Date();

      if (period === 'Today') {
          startDate.setHours(0,0,0,0);
      } else if (period === 'This Week') {
          const day = now.getDay() || 7; 
          startDate.setDate(now.getDate() - day + 1);
          startDate.setHours(0,0,0,0);
      } else if (period === 'This Month') {
          startDate.setDate(1);
          startDate.setHours(0,0,0,0);
      } else if (period === 'This Year') {
          startDate.setMonth(0, 1);
          startDate.setHours(0,0,0,0);
      } else if (period === 'All Time') {
          startDate = new Date(0); // Jan 1, 1970 - Catches all history
      }

      // 3. Filter the global arrays safely (prevents '0' glitch)
      const filteredEvents = allFetchedEvents.filter(e => getSafeDate(e.created_at) >= startDate);
      const filteredGuests = allFetchedGuests.filter(g => getSafeDate(g.created_at) >= startDate);

      // 4. Update the 4 KPI Cards dynamically
      const kpiEv = document.getElementById('kpiEvents');
      const kpiGu = document.getElementById('kpiGuests');
      const kpiPa = document.getElementById('kpiPasses');
      
      if (kpiEv) kpiEv.innerText = filteredEvents.length;
      if (kpiGu) kpiGu.innerText = filteredGuests.length;
      if (kpiPa) kpiPa.innerText = filteredGuests.length;

      let checkedIn = 0;
      filteredGuests.forEach(g => {
          if ((g.checked_in_count || 0) >= (g.allowed_capacity || 1)) checkedIn++;
      });
      const attendanceRate = filteredGuests.length > 0 ? Math.round((checkedIn / filteredGuests.length) * 100) : 0;
      
      const kpiAtt = document.getElementById('kpiAttendance');
      if (kpiAtt) kpiAtt.innerText = attendanceRate + '%';

      // 5. Update Graph Title
      const titleEl = document.getElementById('analyticsChartTitle');
      if (titleEl) {
          // Dynamically map the period to the correct dictionary key
          let periodKey = '';
          if (period === 'Today') periodKey = 'filter_today';
          else if (period === 'This Week') periodKey = 'filter_this_week';
          else if (period === 'This Month') periodKey = 'filter_this_month';
          else if (period === 'This Year') periodKey = 'filter_this_year';
          else if (period === 'All Time') periodKey = 'filter_all_time';
          
          titleEl.innerText = `${window.t('analytics_title', 'Analytics Overview')} (${window.t(periodKey, period)})`;
      }

      // 6. Draw the Graph
      if (typeof Chart !== 'undefined') {
          renderDashboardChart(period);
      }
  }

  function renderDashboardChart(period) {
      const ctx = document.getElementById('dashboardLineChart');
      if (!ctx) return;
      
      const labels = [];
      const eventsData = [];
      const guestsData = [];
      const today = new Date();
      
      // Dynamic Data Generation based on the selected period
      if (period === 'Today') {
          for(let i=5; i>=0; i--) {
              let d = new Date(today);
              d.setHours(today.getHours() - (i * 4));
              labels.push(d.toLocaleTimeString('default', { hour: 'numeric', hour12: true }));
              
              eventsData.push(allFetchedEvents.filter(e => {
                  const ed = getSafeDate(e.created_at);
                  return ed.getHours() >= d.getHours() - 4 && ed.getHours() <= d.getHours() && ed.getDate() === d.getDate();
              }).length);
              
              guestsData.push(allFetchedGuests.filter(g => {
                  const gd = getSafeDate(g.created_at);
                  return gd.getHours() >= d.getHours() - 4 && gd.getHours() <= d.getHours() && gd.getDate() === d.getDate();
              }).length);
          }
      } else if (period === 'This Year' || period === 'All Time') {
          for(let i=11; i>=0; i--) {
              let d = new Date(today.getFullYear(), today.getMonth() - i, 1);
              labels.push(d.toLocaleDateString('default', { month: 'short' }));
              
              eventsData.push(allFetchedEvents.filter(e => {
                  const ed = getSafeDate(e.created_at);
                  return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
              }).length);
              
              guestsData.push(allFetchedGuests.filter(g => {
                  const gd = getSafeDate(g.created_at);
                  return gd.getMonth() === d.getMonth() && gd.getFullYear() === d.getFullYear();
              }).length);
          }
      } else {
          let daysToShow = period === 'This Week' ? 7 : 30;
          for(let i=daysToShow-1; i>=0; i--) {
              let d = new Date(today);
              d.setDate(today.getDate() - i);
              labels.push(d.toLocaleDateString('default', { month: 'short', day: 'numeric' }));
              
              eventsData.push(allFetchedEvents.filter(e => {
                  const ed = getSafeDate(e.created_at);
                  return ed.getDate() === d.getDate() && ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
              }).length);
              
              guestsData.push(allFetchedGuests.filter(g => {
                  const gd = getSafeDate(g.created_at);
                  return gd.getDate() === d.getDate() && gd.getMonth() === d.getMonth() && gd.getFullYear() === d.getFullYear();
              }).length);
          }
      }

      if (dashboardChartInstance) dashboardChartInstance.destroy();
      
      dashboardChartInstance = new Chart(ctx, {
          type: 'line',
          data: {
              labels: labels,
              datasets: [
                  { label: 'Gate Passes / Guests', data: guestsData, borderColor: '#7C3AED', backgroundColor: 'rgba(124, 58, 237, 0.1)', borderWidth: 2, fill: true, tension: 0.4 },
                  { label: 'Events Created', data: eventsData, borderColor: '#22B35A', backgroundColor: 'rgba(34, 179, 90, 0.1)', borderWidth: 2, fill: true, tension: 0.4 }
              ]
          },
          options: {
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 10, font: {size: 10} } } },
              scales: {
                  x: { grid: { display: false }, ticks: { font: {size: 10}, maxTicksLimit: 7 } },
                  y: { beginAtZero: true, ticks: { stepSize: 1, font: {size: 10} } }
              }
          }
      });
  }

// --- EVENT ACTION FUNCTIONS ---
  async function deleteEvent(id) {
      if(confirm("Are you sure you want to completely delete this event? This action cannot be undone.")) {
          await supabaseClient.from('events').delete().eq('id', id);
          fetchEvents(); // Refresh UI
      }
  }

  async function toggleHideEvent(id, currentState) {
      await supabaseClient.from('events').update({ is_hidden: !currentState }).eq('id', id);
      fetchEvents(); // Refresh UI
  }

// --- GUEST ACTION FUNCTIONS ---
  async function deleteGuest(id) {
      if(confirm("Are you sure you want to permanently delete this guest?")) {
          await supabaseClient.from('guests').delete().eq('id', id);
          fetchEvents(); // Refresh UI
      }
  }

  async function toggleHideGuest(id, currentState) {
      await supabaseClient.from('guests').update({ is_hidden: !currentState }).eq('id', id);
      fetchEvents(); // Refresh UI
  }
function showTicket(id, encodedName, encodedTier, capacity, encodedEventName, eventId) {
      const guestName = decodeURIComponent(encodedName);
      const eventName = decodeURIComponent(encodedEventName);
      const tier = decodeURIComponent(encodedTier); // <-- NEW DECODE
      const ticketContainer = document.getElementById('ticketContainer');
      const guest = allFetchedGuests.find(g => g.id === id);
      
      // 1. Strict per-guest template matching
      let customTpl = null;
      if (guest && guest.template_id) {
          customTpl = windowSavedTemplates.find(t => String(t.id) === String(guest.template_id));
      }

      if (customTpl) {
          // --- RENDER CUSTOM DESIGN ---
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = customTpl.html_layout;
          
          const cEvent = tempDiv.querySelector('#canvasEventName');
          const cGuest = tempDiv.querySelector('#canvasGuestName');
          const cVenue = tempDiv.querySelector('#canvasVenue');
          const cDateTime = tempDiv.querySelector('#canvasDateTime');
          const cQrLabel = tempDiv.querySelector('#canvasQrLabel');
          const cQrSpot = tempDiv.querySelector('#canvasQRSpot');
          
          if(cEvent) cEvent.innerText = eventName;
          if(cGuest) cGuest.innerText = guestName;
          
          const parentEv = allFetchedEvents.find(ev => String(ev.id) === String(eventId));
          if (parentEv) {
              if (cVenue) cVenue.innerText = parentEv.venue || 'Venue TBD';
              if (cDateTime) {
                  const dStr = parentEv.event_date ? parentEv.event_date.split('T')[0] : '';
                  const tStr = parentEv.start_time ? ` · ${parentEv.start_time}` : '';
                  cDateTime.innerText = dStr + tStr;
              }
          }

          // Format Unique Dynamic QR Label (e.g., QR-001)
          const formattedQrLabel = 'QR-' + String(guest ? (guest.ticket_number || 0) : 0).padStart(3, '0');
          if(cQrLabel) cQrLabel.innerText = formattedQrLabel;
          
          // Generate the dynamic QR Code without destroying the child ID label
          if (cQrSpot) {
              const size = parseInt(cQrSpot.dataset.qrSize) || 310;
              const darkColor = cQrSpot.dataset.qrDark || "#000000";
              const bgColor = cQrSpot.dataset.qrBg || "#ffffff";
              const hasBox = cQrSpot.dataset.qrHasBox !== 'false';
              const radius = parseInt(cQrSpot.dataset.qrRadius) || 20;
              const boxPadding = parseInt(cQrSpot.dataset.qrPadding) || 10;

              const totalBoxSize = hasBox ? (size + (boxPadding * 2)) : size;

              cQrSpot.style.display = 'flex';
              cQrSpot.style.flexDirection = 'column';
              cQrSpot.style.alignItems = 'center';
              cQrSpot.style.justifyContent = 'center';
              cQrSpot.style.width = totalBoxSize + 'px';
              cQrSpot.style.height = totalBoxSize + 'px';
              cQrSpot.style.background = hasBox ? bgColor : 'transparent';
              cQrSpot.style.borderRadius = hasBox ? (radius + 'px') : '0px';

              // Safely target or create the inner code container without erasing cQrLabel
              let innerContainer = cQrSpot.querySelector('#qrInnerCode');
              if (!innerContainer) {
                  innerContainer = document.createElement('div');
                  innerContainer.id = 'qrInnerCode';
                  cQrSpot.prepend(innerContainer);
              }

              innerContainer.style.display = 'flex';
              innerContainer.style.alignItems = 'center';
              innerContainer.style.justifyContent = 'center';
              innerContainer.style.width = size + 'px';
              innerContainer.style.height = size + 'px';
              innerContainer.style.background = 'transparent';
              innerContainer.innerHTML = '';

              new QRCode(innerContainer, { 
                  text: id, 
                  width: size, 
                  height: size, 
                  colorDark: darkColor, 
                  colorLight: hasBox ? bgColor : 'rgba(0,0,0,0)', 
                  correctLevel: QRCode.CorrectLevel.H 
              });
          }
          
          const customCanvas = tempDiv.firstElementChild;
          customCanvas.style.position = 'absolute';
          customCanvas.style.top = '50%';
          customCanvas.style.left = '50%';
          customCanvas.style.transform = 'translate(-50%, -50%) scale(0.315)'; 
          customCanvas.style.transformOrigin = 'center';
          
          ticketContainer.innerHTML = '';
          ticketContainer.style.width = '340px';
          ticketContainer.style.height = '455px'; 
          ticketContainer.style.background = 'transparent';
          ticketContainer.style.boxShadow = 'none';
          ticketContainer.style.overflow = 'hidden';
          ticketContainer.style.borderRadius = '16px';
          ticketContainer.style.position = 'relative';
          ticketContainer.appendChild(customCanvas);

      } else {
          // --- RENDER DEFAULT FALLBACK ---
          ticketContainer.style.width = '340px';
          ticketContainer.style.height = 'auto';
          ticketContainer.style.background = 'white';
          ticketContainer.style.borderRadius = '16px';
          ticketContainer.style.overflow = 'hidden';
          ticketContainer.innerHTML = `
            <div class="bg-gradient-to-br from-indigo-900 to-indigo-700 text-white p-6 relative">
              <p class="text-[10px] text-indigo-300 uppercase tracking-widest mb-1 font-bold">Event Pass</p>
              <h2 id="bpEventName" class="text-2xl font-bold tracking-tight leading-normal pb-2 truncate">${eventName}</h2>
            </div>
            <div class="bg-white px-6 pt-6 pb-2 text-slate-800">
              <p class="text-[10px] text-slate-400 uppercase font-bold mb-1">Guest Name</p>
              <p id="bpGuestName" class="text-lg font-bold text-slate-900 leading-tight mb-4">${guestName}</p>
              <div class="flex justify-between">
                 <div><p class="text-[10px] text-slate-400 uppercase font-bold">Tier</p><p id="bpTier" class="text-sm font-bold text-pink-600">${tier || 'General'}</p></div>
                 <div><p class="text-[10px] text-slate-400 uppercase font-bold">Admit</p><p id="bpCapacity" class="text-sm font-bold text-slate-800">${capacity > 1 ? capacity + ' Persons' : '1 Person'}</p></div>
              </div>
            </div>
            <div class="relative h-8 bg-white flex items-center justify-center">
              <div class="absolute left-[-12px] w-6 h-6 bg-slate-800 rounded-full"></div>
              <div class="absolute right-[-12px] w-6 h-6 bg-slate-800 rounded-full"></div>
              <div class="w-full border-t-2 border-dashed border-slate-200 mx-4"></div>
            </div>
            <div class="bg-white px-6 pb-6 flex flex-col items-center">
              <div id="qrcode" class="p-2 bg-white border-2 border-slate-100 rounded-xl shadow-sm mb-2"></div>
              <p id="bpTicketId" class="text-[10px] font-mono text-slate-400">${guest ? 'QR-' + String(guest.ticket_number || 0).padStart(3, '0') : '...'}</p>
            </div>
          `;
          
          const qrContainer = ticketContainer.querySelector('#qrcode');
          new QRCode(qrContainer, { text: id, width: 120, height: 120, colorDark : "#000", colorLight : "#fff", correctLevel : QRCode.CorrectLevel.H });
      }

// DYNAMICALLY WIRE THE SHARE BUTTONS
      const safePhone = guest && guest.phone ? encodeURIComponent(guest.phone) : '';
      const safeEmail = guest && guest.email ? encodeURIComponent(guest.email) : '';
      const tNum = guest ? guest.ticket_number : 0;
      
      document.getElementById('modalBtnWA').onclick = () => shareToWhatsApp(id, safePhone, encodedName, encodedEventName, tNum);
      document.getElementById('modalBtnEmail').onclick = () => shareToEmail(id, safeEmail, encodedName, encodedEventName, tNum);
      document.getElementById('modalBtnPNG').onclick = () => downloadTicketFile(encodedName, encodedEventName, 'png');
      document.getElementById('modalBtnPDF').onclick = () => downloadTicketFile(encodedName, encodedEventName, 'pdf');      
document.getElementById('qrModal').classList.remove('hidden');
  }

  function editGuest(id) {
      currentEditGuestId = id;
      const g = allFetchedGuests.find(x => x.id === id);
      if(!g) return;

      // 1. Navigate to Add Guest Tab FIRST
      document.querySelector('button[onclick*="addGuestView"]').click();

      // 2. Populate form fields
      document.getElementById('addGuestEventSelect').value = g.event_id || '';
      document.getElementById('agGuestName').value = g.guest_name || '';
      document.getElementById('agGuestEmail').value = g.email || '';
      document.getElementById('agGuestPhone').value = g.phone ? g.phone.replace(/^\+\d+/, '') : ''; 
      document.getElementById('agGuestCompany').value = g.company || '';
      document.getElementById('agGuestDesignation').value = g.designation || '';
      document.getElementById('agGuestIdNumber').value = g.id_number || '';
      document.getElementById('agTierInput').value = g.ticket_tier || 'General';
      document.getElementById('agCapacityInput').value = g.allowed_capacity || 1;
      document.getElementById('agEntryGateSelect').value = g.assigned_entry_gate_id || ''; 
      document.getElementById('agExitGateSelect').value = g.assigned_exit_gate_id || '';   
      document.getElementById('agGuestNotes').value = g.notes || '';

      // 3. Update Titles for Edit Mode
      document.getElementById('dynamicPageTitle').innerText = 'Edit Guest';
      document.getElementById('dynamicPageSubtitle').innerText = 'Dashboard > Create & Manage > Edit guest details.';
      document.getElementById('submitAddGuestBtn').innerHTML = 'Update Guest <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  }

  // Used for filtering the Guest List table via Event Pills
  function filterGuestsByEvent(eventId) {
      currentGuestFilterEventId = eventId;
      fetchEvents(); // Refresh UI to apply filter
  }

  function editEvent(id) {
      currentEditEventId = id;
      const ev = allFetchedEvents.find(e => e.id === id);
      if(!ev) return;

      // 1. Navigate to the form FIRST
      document.querySelector('button[onclick*="createEventView"]').click();

      // FIX: Clean the database timestamp into YYYY-MM-DD so the input accepts it
      const formattedDate = ev.event_date ? ev.event_date.split('T')[0] : '';

      // 2. Fill the form fields with existing data
      document.getElementById('dedicatedEventName').value = ev.event_name || '';
      document.getElementById('dedicatedEventType').value = ev.event_type || 'Event';
      document.getElementById('dedicatedEventDate').value = formattedDate;
      document.getElementById('dedicatedStartTime').value = ev.start_time || '';
      document.getElementById('dedicatedEndTime').value = ev.end_time || '';
      document.getElementById('dedicatedVenue').value = ev.venue || '';
      document.getElementById('dedicatedEventCapacity').value = ev.total_capacity || 100;
      
      document.querySelector('#createEventView input[placeholder="Enter full address"]').value = ev.address || '';
      document.querySelector('#createEventView input[placeholder="Enter organizer / company name"]').value = ev.organizer_name || '';
      document.querySelector('#createEventView input[type="email"]').value = ev.contact_email || '';
      document.querySelector('#createEventView input[placeholder="Enter phone number"]').value = ev.contact_phone || '';
      document.querySelector('#createEventView textarea').value = ev.description || '';

      // 3. Safely update the Global Header Titles & Button Text
      document.getElementById('dynamicPageTitle').innerText = 'Edit Event';
      document.getElementById('dynamicPageSubtitle').innerText = 'Dashboard > Create & Manage > Edit Event Details';
      document.getElementById('submitDedicatedEventBtn').innerHTML = 'Update Event <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
  }

  function closeModal() { document.getElementById('qrModal').classList.add('hidden'); }
  async function handleSignOut() { await supabaseClient.auth.signOut(); window.location.href = 'index.html'; }

// --- SUBMIT FORMS LOGIC (EVENTS & GUESTS) ---
  document.addEventListener('DOMContentLoaded', () => {
      
      // 1. CREATE EVENT
      const submitDedicatedBtn = document.getElementById('submitDedicatedEventBtn');
      if(submitDedicatedBtn) {
          submitDedicatedBtn.addEventListener('click', async () => {
            const name = document.getElementById('dedicatedEventName').value.trim();
            const date = document.getElementById('dedicatedEventDate').value;
            const venue = document.getElementById('dedicatedVenue').value.trim();
            const type = document.getElementById('dedicatedEventType').value;
            const startTime = document.getElementById('dedicatedStartTime').value;
            const endTime = document.getElementById('dedicatedEndTime').value;
            const capacity = parseInt(document.getElementById('dedicatedEventCapacity').value) || 100;
            
            const address = document.querySelector('#createEventView input[placeholder="Enter full address"]').value.trim();
            const organizer = document.querySelector('#createEventView input[placeholder="Enter organizer / company name"]').value.trim();
            const contactEmail = document.querySelector('#createEventView input[type="email"]').value.trim();
            const contactPhone = document.querySelector('#createEventView input[placeholder="Enter phone number"]').value.trim();
            const description = document.querySelector('#createEventView textarea').value.trim();
            
            if (!name || !date || !venue) return alert('Please fill in Event Name, Date, and Venue.');

            // ====================================================================
            // 🔒 SECURITY FIX: LIVE DATABASE VALIDATION FOR EVENTS
            // ====================================================================
            if (!currentEditEventId) { // Only check limits if creating a NEW event
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (!session) return;
                
                // A. Get Live Plan
                const { data: liveTenant } = await supabaseClient
                    .from('tenants')
                    .select('subscription_status')
                    .eq('owner_id', session.user.id)
                    .single();
                    
                const { data: dbLimits } = await supabaseClient.from('plan_limits').select('*');
                const livePlanTier = liveTenant ? liveTenant.subscription_status : 'Basic';
                const currentPlanData = dbLimits ? dbLimits.find(p => p.plan_name.toLowerCase() === livePlanTier.toLowerCase()) : null;
                const trueMaxEvents = currentPlanData ? parseInt(currentPlanData.max_events) : 2;

                // B. Get Live Event Count
                const { count: liveEventCount, error: countErr } = await supabaseClient
                    .from('events')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', currentTenantId);

                const currentTotalEvents = countErr ? 0 : liveEventCount;

                if (currentTotalEvents >= trueMaxEvents) {
                    openUpgradeModal(`Event Limit Reached (${trueMaxEvents} Max). You already have ${currentTotalEvents} events.`);
                    return; // Stops the saving process instantly!
                }
            }
            // ====================================================================

            const eventPayload = { 
                event_name: name, event_date: date, venue: venue, event_type: type, start_time: startTime, end_time: endTime, total_capacity: capacity, 
                address: address, organizer_name: organizer, contact_email: contactEmail, contact_phone: contactPhone, description: description,
                tenant_id: currentTenantId, is_approved: false 
            };

            if (currentEditEventId) {
                // UPDATE EXISTING
                await supabaseClient.from('events').update(eventPayload).eq('id', currentEditEventId);
                alert('Event Updated! Awaiting Admin Approval.');
                currentEditEventId = null; // Reset ID state
                
                // Safely reset button
                document.getElementById('submitDedicatedEventBtn').innerHTML = '<span data-i18n="btn_submit_event">Create Event &rarr;</span>';
            } else {
                // CREATE NEW
                await supabaseClient.from('events').insert([eventPayload]);
                alert('Event Created! Awaiting Admin Approval.');
            }
            
            // Clear required fields
            document.getElementById('dedicatedEventName').value = '';
            document.getElementById('dedicatedVenue').value = '';
            document.getElementById('dedicatedEventDate').value = '';
            
            fetchEvents();
            document.querySelector('button[onclick*="createManageView"]').click();
          });
      }

      // 2. ADD GUEST (Unified Submission)
      const submitAddGuestBtn = document.getElementById('submitAddGuestBtn');
      if(submitAddGuestBtn) {
          submitAddGuestBtn.addEventListener('click', async () => {
              const eventId = document.getElementById('addGuestEventSelect').value;
              const name = document.getElementById('agGuestName').value.trim();
              const email = document.getElementById('agGuestEmail').value.trim();
              const phoneCode = document.getElementById('agGuestPhoneCode').value;
              const rawPhone = document.getElementById('agGuestPhone').value.trim();
              const phone = rawPhone ? (phoneCode + rawPhone.replace(/^0+/, '')) : '';
              const company = document.getElementById('agGuestCompany').value.trim();
              const designation = document.getElementById('agGuestDesignation').value.trim();
              const idNumber = document.getElementById('agGuestIdNumber').value.trim();
              const notes = document.getElementById('agGuestNotes').value.trim();
              const tier = document.getElementById('agTierInput').value;
              const capacity = parseInt(document.getElementById('agCapacityInput').value) || 1;
              
              const entryGateId = document.getElementById('agEntryGateSelect').value || null;
              const exitGateId = document.getElementById('agExitGateSelect').value || null;

              if (!eventId || !name || !phone) return alert('Please select an event, and enter Guest Name and Phone Number.');

              // ====================================================================
              // 🔒 SECURITY FIX: LIVE DATABASE VALIDATION FOR SINGLE GUEST
              // ====================================================================
              if (!currentEditGuestId) { // Only check limits if creating a NEW guest
                  const { data: { session } } = await supabaseClient.auth.getSession();
                  if (!session) return;
                  
                  const { data: liveTenant } = await supabaseClient
                      .from('tenants')
                      .select('subscription_status')
                      .eq('owner_id', session.user.id)
                      .single();
                      
                  const { data: dbLimits } = await supabaseClient.from('plan_limits').select('*');
                  const livePlanTier = liveTenant ? liveTenant.subscription_status : 'Basic';
                  const currentPlanData = dbLimits ? dbLimits.find(p => p.plan_name.toLowerCase() === livePlanTier.toLowerCase()) : null;
                  const trueMaxGuests = currentPlanData ? parseInt(currentPlanData.max_guests) : 50;

                  const { count: liveGuestCount, error: countErr } = await supabaseClient
                      .from('guests')
                      .select('*', { count: 'exact', head: true })
                      .eq('event_id', eventId);

                  const currentEventGuests = countErr ? 0 : liveGuestCount;

                  if ((currentEventGuests + capacity) > trueMaxGuests) {
                      openUpgradeModal(`Guest Limit Reached (${trueMaxGuests} Max per Event).`);
                      return; // Stops the saving process instantly!
                  }
              }
              // ====================================================================

              let selectedMethod = 'System';
              const waBtn = document.getElementById('btnWhatsappOption');
              if(waBtn && waBtn.style.background.includes('success')) selectedMethod = 'WhatsApp';
              else selectedMethod = 'Email';

              const guestPayload = {
                  event_id: eventId, guest_name: name, email: email, phone: phone, company: company, designation: designation,
                  id_number: idNumber, ticket_tier: tier, allowed_capacity: capacity, notes: notes,
                  sent_via: selectedMethod, assigned_entry_gate_id: entryGateId, assigned_exit_gate_id: exitGateId
              };

              if (currentEditGuestId) {
                  await supabaseClient.from('guests').update(guestPayload).eq('id', currentEditGuestId);
                  alert('Guest updated successfully!');
                  currentEditGuestId = null;
                  document.getElementById('submitAddGuestBtn').innerHTML = '<span data-i18n="btn_save_single_guest">Save Single Guest</span> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
              } else {
                  guestPayload.status = 'Active';
                  guestPayload.invitation_status = 'Pending';
                  guestPayload.ticket_number = getNextTicketNumber(eventId) + 1;
                  await supabaseClient.from('guests').insert([guestPayload]);
                  alert('Guest successfully saved and pass generated!');
              }

              document.getElementById('agGuestName').value = '';
              document.querySelector('#addGuestView input[placeholder="Enter phone number"]').value = '';
              fetchAllGuestsForKPIs();
              document.querySelector('button[onclick*="guestListsView"]').click();
          });
      }
  });


// ==========================================
  // --- UI INTERACTIVITY & ROUTING FIXES ---
  // ==========================================
  document.addEventListener('DOMContentLoaded', () => {

      // 1. MAKE FILTER BUTTONS CLICKABLE (Date Ranges & Statuses)
      // This groups filter pills together and lets you click to toggle the purple "active" state
      const filterParents = new Set();
      document.querySelectorAll('.btn-filter-nav').forEach(btn => {
          filterParents.add(btn.parentElement);
      });

      filterParents.forEach(parent => {
          const buttons = parent.querySelectorAll('.btn-filter-nav');
          buttons.forEach(btn => {
              btn.addEventListener('click', (e) => {
                  e.preventDefault();
                  // Remove active from all siblings, add to the clicked one
                  buttons.forEach(b => b.classList.remove('active'));
                  btn.classList.add('active');
              });
          });
      });

     
      // 3. WIRE UP ALL DEAD ACTION BUTTONS ACROSS ALL TABS
      document.querySelectorAll('button, div.card, div[style*="dashed"]').forEach(el => {
          const text = el.innerText.trim();
          
          // Skip if the button already has functionality built in (like submit buttons)
          if (el.onclick || el.id) return;

          // Route to Reports Tab
          if (text === 'Reports' && el.classList.contains('action-card')) {
              el.style.cursor = 'pointer';
              el.onclick = () => alert('Reports updates coming soon!');
          }
          
          // Route to Dedicated "Create Event" Tab (Skip buttons with assigned onclicks or form buttons)
          if ((text === 'Create Event' || text === 'New Event') && !el.id && !el.getAttribute('onclick')) {
              el.style.cursor = 'pointer';
              el.onclick = () => switchView('createEventView');
          }
          
          // Route to Dedicated "Add Guest" Tab
          if (text === 'Add Guest' || text.includes('Issue Pass') || text.includes('Generate Gate Pass')) {
              el.style.cursor = 'pointer';
              el.onclick = () => document.querySelector('button[onclick*="addGuestView"]').click();
          }
          
          // Route to Dedicated "Import Data" Tab
          if (text === 'Import Data' || text.includes('Import Guests') || text.includes('Bulk Generate') || text.includes('Upload from Excel')) {
              el.style.cursor = 'pointer';
              el.onclick = () => document.querySelector('button[onclick*="importDataView"]').click();
          }
          
          // Route Bottom Card Buttons
          if (text === 'View All Gate Passes') {
              el.style.cursor = 'pointer';
              el.onclick = () => document.querySelector('button[onclick*="guestsView"]').click();
          }

          // Give tactile feedback for Export and Filter buttons (Backend logic coming later)
          if (text === 'Filter' || text.includes('Export to Excel') || text === 'Export') {
              el.style.cursor = 'pointer';
              el.onclick = () => alert(text + ' options will be connected to the backend soon!');
          }
      });
// FIX 11: Selectable Invitation Options
      const waBtn = document.getElementById('btnWhatsappOption');
      const emBtn = document.getElementById('btnEmailOption');
      if (waBtn && emBtn) {
          waBtn.onclick = () => {
              waBtn.style.borderColor = 'var(--color-success)'; waBtn.style.background = 'var(--color-success-soft)';
              waBtn.querySelector('div').innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
              waBtn.querySelector('div').style.background = 'var(--color-success)'; waBtn.querySelector('div').style.border = 'none';
              
              emBtn.style.borderColor = 'var(--color-border)'; emBtn.style.background = 'var(--color-bg)';
              emBtn.querySelector('div').innerHTML = '';
              emBtn.querySelector('div').style.background = 'white'; emBtn.querySelector('div').style.border = '2px solid var(--color-border)';
          };
          emBtn.onclick = () => {
              emBtn.style.borderColor = 'var(--color-info)'; emBtn.style.background = 'var(--color-info-soft)';
              emBtn.querySelector('div').innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
              emBtn.querySelector('div').style.background = 'var(--color-info)'; emBtn.querySelector('div').style.border = 'none';
              
              waBtn.style.borderColor = 'var(--color-border)'; waBtn.style.background = 'var(--color-bg)';
              waBtn.querySelector('div').innerHTML = '';
              waBtn.querySelector('div').style.background = 'white'; waBtn.querySelector('div').style.border = '2px solid var(--color-border)';
          };
      }

  });
 
  // ==========================================
      // --- TEMPLATES DATABASE LOGIC & EDITOR CONTROLS ---
      // ==========================================

      let windowSavedTemplates = []; 
      let currentlySelectedElement = null; 
      let currentEditingTemplateId = null;
      let isEditingGlobal = false; // Tracks if the loaded template belongs to the Admin
      let currentActiveBgString = "url('./templates/gatepass01.jpg')"; // Tracks the active background

      // --- DRAG vs TYPE UX ---
      let isDragging = false;
  let dragTarget = null;
  let offsetX = 0;
  let offsetY = 0;

  function makeDraggable(el) {
        if(!el.classList.contains('canvas-element')) el.classList.add('canvas-element');
        
        // NEW: Automatically grant the resizable class to the QR box so the hover handle appears
        if(el.classList.contains('qr-group-box')) el.classList.add('resizable-text'); 
        
        // NEW: Removed the block that previously prevented the QR box from getting a drag handle
        if (!el.classList.contains('non-text-editable') && !el.querySelector('.resize-handle')) {
            const handle = document.createElement('div'); 
            handle.className = 'resize-handle corner'; 
            el.appendChild(handle);
        }
        
        el.addEventListener('mousedown', (e) => {
            // HANDLE CORNER RESIZING (FONT SIZE OR QR SIZE)
            if (e.target.classList.contains('resize-handle')) {
                e.preventDefault(); e.stopPropagation();
                let initialY = e.clientY; 
                let initialX = e.clientX;
                let style = window.getComputedStyle(el);
                
                let isQR = el.classList.contains('qr-group-box');
                let initialFontSize = parseFloat(style.fontSize) || 40;
                let initialQrSize = parseInt(el.dataset.qrSize) || 310;
                
                // Dynamically calculate canvas scale so mouse drag feels perfectly 1:1
                const parentRect = el.parentElement.getBoundingClientRect();
                const scale = parentRect.width / (el.parentElement.id === 'editorCanvas' ? 1080 : el.parentElement.offsetWidth);

                function onMouseMove(moveEvent) { 
                    let deltaY = (moveEvent.clientY - initialY) / scale;
                    let deltaX = (moveEvent.clientX - initialX) / scale;
                    
                    if (isQR) {
                        // For QR: scale uniformly based on the largest mouse movement direction
                        let delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
                        let newSize = Math.max(150, Math.min(600, initialQrSize + delta));
                        
                        // 1. Update UI input box on the left panel dynamically
                        const qrSizeInput = document.getElementById('qrCustomSize');
                        if (qrSizeInput) qrSizeInput.value = Math.round(newSize);
                        
                        // 2. Update Dataset Memory
                        el.dataset.qrSize = Math.round(newSize);
                        
                        // 3. Re-render the QR LIVE
                        const gDrop = document.getElementById('tplGuestSelect');
                        const currentText = (gDrop && gDrop.value) ? gDrop.value : 'PREVIEW_QR';
                        renderCanvasQR(currentText);
                    } else {
                        // Standard text resizing
                        let newSize = Math.max(12, initialFontSize + (deltaY * 0.5));
                        el.style.fontSize = newSize + 'px';
                        
                        const sizeInput = document.getElementById('elementFontSize');
                        if (sizeInput) sizeInput.value = Math.round(newSize);
                    }
                }
                function onMouseUp() { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); }
                document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
                return;
            }

            // HANDLE DRAGGING & SELECTION
            if (el.contentEditable === "true") return; 
            e.preventDefault(); e.stopPropagation();
            
            currentlySelectedElement = el;
            if (document.getElementById('fontExplorerPanel') && document.getElementById('fontExplorerPanel').style.display !== 'none') {
                renderFontExplorerList(); 
            }
            
            document.querySelectorAll('.canvas-element').forEach(node => { node.style.outline = "none"; node.classList.remove('active-element'); });
            el.style.outline = "3px dashed var(--color-primary, #ec4899)"; 
            el.classList.add('active-element');
            
            // Sync Tools Panel Inputs
            const style = window.getComputedStyle(el);
            if (!el.classList.contains('qr-group-box')) {
                if (document.getElementById('elementFontSize')) document.getElementById('elementFontSize').value = parseInt(style.fontSize) || 32;
                if (document.getElementById('elementColor')) {
                    const rgb = style.color;
                    if (rgb && rgb.includes('rgb')) {
                        const parts = rgb.match(/\d+/g);
                        if (parts && parts.length >= 3) document.getElementById('elementColor').value = "#" + parts.slice(0,3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
                    }
                }
            }
            
            isDragging = true; dragTarget = el;
            const referenceRect = el.parentElement.getBoundingClientRect();
            const scale = referenceRect.width / (el.parentElement.id === 'editorCanvas' ? 1080 : el.parentElement.offsetWidth);
            offsetX = (e.clientX - el.getBoundingClientRect().left) / scale; 
            offsetY = (e.clientY - el.getBoundingClientRect().top) / scale;
        });

        el.addEventListener('dblclick', () => {
            if (el.dataset.noEdit === "true" || el.classList.contains('qr-group-box')) return;
            el.contentEditable = "true"; el.focus(); el.style.cursor = 'text'; el.style.outline = "3px solid var(--color-primary, #ec4899)";
        });
        el.addEventListener('blur', () => { 
            el.contentEditable = "false"; 
            el.style.cursor = 'move'; 
            
            // Re-inject handle safely if text editing wiped it out
            if (!el.querySelector('.resize-handle') && !el.classList.contains('non-text-editable')) {
                const handle = document.createElement('div'); 
                handle.className = 'resize-handle corner'; 
                el.appendChild(handle);
            }
        });
    }

  document.addEventListener('mousemove', (e) => {
      if (!isDragging || !dragTarget) return;
      
      const parentContainer = dragTarget.parentElement;
      const parentRect = parentContainer.getBoundingClientRect();
      const referenceWidth = parentContainer.id === 'editorCanvas' ? 1080 : parentContainer.offsetWidth;
      const scale = parentRect.width / referenceWidth;
      
      let x = (e.clientX - parentRect.left) / scale - offsetX;
      let y = (e.clientY - parentRect.top) / scale - offsetY;

      dragTarget.style.left = x + 'px';
      dragTarget.style.top = y + 'px';
      dragTarget.style.bottom = 'auto';
      dragTarget.style.transform = 'none'; 
  });

  document.addEventListener('mouseup', () => {
      isDragging = false;
      dragTarget = null;
  });

// --- PHASE 4: MOBILE TOUCH DRAG & DROP POLYFILL ---
  document.addEventListener('touchstart', handleTouchToMouse, { passive: false });
  document.addEventListener('touchmove', handleTouchToMouse, { passive: false });
  document.addEventListener('touchend', handleTouchToMouse, { passive: false });

  function handleTouchToMouse(e) {
      // Only intercept touches inside the editor canvas OR if we are currently dragging an element
      if (!e.target.closest('#editorCanvas') && !isDragging) return;
      
      const touch = e.changedTouches[0];
      let mouseType = "";
      
      if (e.type === "touchstart") mouseType = "mousedown";
      else if (e.type === "touchmove") mouseType = "mousemove";
      else if (e.type === "touchend") mouseType = "mouseup";
      
      // Generate a virtual mouse click at the exact coordinates of the finger
      const simulatedMouseEvent = new MouseEvent(mouseType, {
          bubbles: true, cancelable: true, view: window,
          clientX: touch.clientX, clientY: touch.clientY,
          screenX: touch.screenX, screenY: touch.screenY
      });
      
      touch.target.dispatchEvent(simulatedMouseEvent);
      
      // Prevent the whole phone screen from scrolling when dragging an element
      if (mouseType === "mousemove" && isDragging) {
          e.preventDefault();
      }
  }

  // --- DYNAMIC FONT ENGINE & EXPLORER ---
    let loadedCustomFontsList = []; // Stores fonts globally for the explorer

    async function loadCustomFonts() {
        try {
            const response = await fetch('./fonts/fonts.json');
            if (!response.ok) return; 
            const fonts = await response.json();
            
            loadedCustomFontsList = fonts; 
            let dynamicCSS = '';
            const fontSelect = document.getElementById('elementFontFamily');
            
            fonts.forEach(font => {
                // Generate a TRULY unique CSS name using the filename instead of the display name
                const baseFileName = font.fileName.split('.')[0]; 
                const safeFamilyName = baseFileName.replace(/[^a-zA-Z0-9]/g, '');
                font.safeFamilyName = safeFamilyName; 
                
                const safeUrl = encodeURIComponent(font.fileName);
                
                dynamicCSS += `@font-face { font-family: '${safeFamilyName}'; src: url('./fonts/${safeUrl}'); }\n`;
                if(fontSelect) fontSelect.innerHTML += `<option value="'${safeFamilyName}', sans-serif">${font.displayName}</option>`;
            });
            
            const styleTag = document.createElement('style');
            styleTag.innerHTML = dynamicCSS;
            document.head.appendChild(styleTag);
        } catch (err) {
            console.warn("Could not load custom fonts:", err);
        }
    }

let currentFontCategoryFilter = 'All';

    // --- NEW: FILTER LOGIC ---
    function filterFonts(category, btnElement) {
        currentFontCategoryFilter = category;
        
        // Update button UI styles dynamically
        if (btnElement && btnElement.parentElement) {
            btnElement.parentElement.querySelectorAll('button').forEach(b => {
                b.style.background = 'transparent';
                b.style.color = 'var(--color-text-secondary, #94a3b8)';
                b.style.borderColor = 'var(--color-border, #334155)';
            });
            btnElement.style.background = 'var(--color-primary, #ec4899)';
            btnElement.style.color = 'white';
            btnElement.style.borderColor = 'var(--color-primary, #ec4899)';
        }
        
        renderFontExplorerList();
    }

    

    async function toggleFontExplorer() {
        const panel = document.getElementById('fontExplorerPanel');
        const grid = document.getElementById('builderLayoutGrid');
        const isEventsPage = window.location.pathname.includes('events') || !document.body.classList.contains('bg-slate-950');

        // ====================================================================
        // 🔒 SECURITY FIX: LIVE VALIDATION FOR PREMIUM FONTS
        // ====================================================================
        if (panel.style.display === 'none') {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session) {
                const { data: liveTenant } = await supabaseClient
                    .from('tenants')
                    .select('subscription_status')
                    .eq('owner_id', session.user.id)
                    .single();
                
                if (liveTenant && liveTenant.subscription_status.toLowerCase() === 'basic') {
                    openUpgradeModal('Custom Brand Fonts');
                    applyAccountLocks(); // Re-lock the UI buttons instantly
                    return; // Stop the panel from opening
                }
            }
        }
        // ====================================================================

        if (panel.style.display === 'none') {
            panel.style.display = 'flex';
            // Slide open by adding a new column to the grid
            grid.style.gridTemplateColumns = isEventsPage ? '220px 280px 1fr 260px' : '260px 300px 1fr 280px';
            renderFontExplorerList();
        } else {
            panel.style.display = 'none';
            // Snap closed
            grid.style.gridTemplateColumns = isEventsPage ? '220px 1fr 260px' : '260px 1fr 280px';
        }
    }

    function renderFontExplorerList() {
        const list = document.getElementById('fontExplorerList');
        if(!list) return;
        
        let sampleText = "Preview Text";
        if (currentlySelectedElement && currentlySelectedElement.innerText.trim()) {
            const clone = currentlySelectedElement.cloneNode(true);
            const handle = clone.querySelector('.resize-handle');
            if (handle) handle.remove(); 
            sampleText = clone.innerText.trim() || "Preview Text";
        }

        const isEvents = window.location.pathname.includes('events') || !document.body.classList.contains('bg-slate-950');
        const bgCol = isEvents ? 'var(--color-surface-soft)' : '#0f172a';
        const brdCol = isEvents ? 'var(--color-border)' : '#1e293b';
        const txtCol = isEvents ? 'var(--color-text)' : '#f1f5f9';
        const subCol = isEvents ? 'var(--color-text-secondary)' : '#64748b';

        list.innerHTML = ''; 

        const defaultFonts = [
            { name: 'Default Font', val: isEvents ? 'var(--font-family)' : 'Inter, sans-serif', category: 'EN' },
            { name: 'Arial', val: 'Arial, sans-serif', category: 'EN' },
            { name: 'Georgia', val: "'Georgia', serif", category: 'EN' }
        ];

        let allAvailableFonts = [...defaultFonts, ...loadedCustomFontsList];

        if (currentFontCategoryFilter !== 'All') {
            allAvailableFonts = allAvailableFonts.filter(f => (f.category || 'EN') === currentFontCategoryFilter);
        }

        allAvailableFonts.forEach(f => {
            const fontVal = f.safeFamilyName ? `'${f.safeFamilyName}', sans-serif` : (f.fontFamily ? `'${f.fontFamily}', sans-serif` : f.val);
            
            // Extract the weight/style from the filename to display in the UI (e.g., "Dubai BOLD")
            let uiDisplayName = f.displayName || f.name;
            if (f.fileName) {
                const styleHint = f.fileName.split('.')[0].split(/[-_]/).pop();
                if (styleHint && !uiDisplayName.toUpperCase().includes(styleHint.toUpperCase())) {
                    uiDisplayName += ` ${styleHint}`;
                }
            }

            const fontCategory = f.category || 'EN'; 
            
            let defaultAlphabet = "Aa Bb Cc Dd Ee Ff";
            let displayCategoryName = "English";

            if (fontCategory === 'AR') {
                defaultAlphabet = "أ ب ت ث ج ح خ";
                displayCategoryName = "Arabic";
            } else if (fontCategory === 'ML') {
                defaultAlphabet = "അ ആ ഇ ഈ ഉ ഊ";
                displayCategoryName = "Malayalam";
            } else if (fontCategory === 'EN') {
                defaultAlphabet = "Aa Bb Cc Dd Ee Ff";
                displayCategoryName = "English";
            } else {
                displayCategoryName = fontCategory; 
            }
            
            // STRICT HIGHLIGHT LOGIC: Ensure an exact match to prevent multiple selections
            let isSelected = false;
            if (currentlySelectedElement && currentlySelectedElement.style.fontFamily) {
                const currentFamily = currentlySelectedElement.style.fontFamily.replace(/"/g, "'").trim();
                const expectedFamily = fontVal.trim();
                
                if (currentFamily === expectedFamily || currentFamily.includes(f.safeFamilyName || f.name)) {
                    isSelected = true;
                }
            }

            const activeBorderColor = isSelected ? 'var(--color-primary, #ec4899)' : brdCol;
            const card = document.createElement('div');
            
            card.style.cssText = `padding: 12px; border: 2px solid ${activeBorderColor}; border-radius: 8px; cursor: pointer; background: ${isSelected ? 'var(--color-primary-soft, rgba(236,72,153,0.1))' : bgCol}; margin-bottom: 8px; display: flex; flex-direction: column; gap: 8px; transition: 0.2s;`;
            
            if (!isSelected) {
                card.onmouseover = () => card.style.borderColor = 'var(--color-primary, #ec4899)';
                card.onmouseout = () => card.style.borderColor = brdCol;
            }
            
            card.onclick = () => {
                if (currentlySelectedElement) {
                    currentlySelectedElement.style.fontFamily = fontVal;
                    const select = document.getElementById('elementFontFamily');
                    if(select) select.value = fontVal;
                    
                    renderFontExplorerList(); 
                } else {
                    alert("Please select a text element on the canvas first.");
                }
            };
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 10px; color: ${subCol}; font-weight: 700; text-transform: uppercase;">${uiDisplayName}</span>
                    <span style="font-size: 8px; color: ${subCol}; background: rgba(100,100,100,0.1); padding: 2px 6px; border-radius: 4px;">${displayCategoryName}</span>
                </div>
                <div style="font-family: ${fontVal}; font-size: 15px; color: ${subCol}; line-height: 1;">${defaultAlphabet}</div>
                <div style="font-family: ${fontVal}; font-size: 24px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ${txtCol}; line-height: 1.2;">${sampleText}</div>
            `;
            list.appendChild(card);
        });
    }

  // --- EDITOR UI CONTROLS ---
  function applyTemplateBg(cardElement, bgStr, color1, color2) {
      currentActiveBgString = bgStr; // Save active string for the database thumbnail

      document.querySelectorAll('.tpl-card').forEach(c => {
          c.style.border = '1px solid var(--color-border)';
          const check = c.querySelector('.active-check');
          if(check) check.style.display = 'none';
      });
      cardElement.style.border = '2px solid var(--color-primary)';
      const activeCheck = cardElement.querySelector('.active-check');
      if (activeCheck) activeCheck.style.display = 'flex';

      const canvas = document.getElementById('editorCanvas');
      canvas.style.background = 'none'; 
      if (bgStr.includes('url')) {
          canvas.style.backgroundImage = bgStr;
          canvas.style.backgroundSize = '100% 100%';
          canvas.style.backgroundPosition = 'center';
          canvas.style.backgroundRepeat = 'no-repeat';
      } else {
          canvas.style.background = bgStr; 
      }
      
      const evtName = document.getElementById('canvasEventName');
      const gstName = document.getElementById('canvasGuestName');
      if(evtName) evtName.style.color = color1;
      if(gstName) gstName.style.color = color2;
  }

  

  // 1. Delete button protection
function deleteSelectedElement() {
      if (!currentlySelectedElement) {
          return alert("Click on an element first to select it for deletion.");
      }
      
      // Block deletion of QR Spot and the QR ID Tag
      if (currentlySelectedElement.id === 'canvasQRSpot' || currentlySelectedElement.id === 'canvasQrLabel') {
          return alert("The QR Code and its ID tag are permanent elements and cannot be deleted.");
      }

      currentlySelectedElement.remove();
      currentlySelectedElement = null;
  }

  function previewTemplate() {
      const previewContainer = document.getElementById('previewContainer');
      const canvas = document.getElementById('editorCanvas');
      
      document.querySelectorAll('.canvas-element').forEach(node => node.style.outline = "none");
      
      previewContainer.innerHTML = '';
      const clone = canvas.cloneNode(true);
      
      clone.style.transform = "none"; 
      clone.style.top = "0";
      clone.style.left = "0";
      clone.style.position = "relative";
      clone.style.width = "100%";
      clone.style.height = "100%";
      
      previewContainer.appendChild(clone);
      document.getElementById('previewModal').classList.remove('hidden');
  }

  // --- DYNAMIC DATA INSERTER ---
  function addCanvasText() {
      const canvas = document.getElementById('editorCanvas');
      const newText = document.createElement('div');
      newText.contentEditable = "false";
      newText.className = "canvas-element resizable-text";
      newText.innerHTML = `Double Click to Edit<div class="resize-handle right"></div>`;
      newText.style.position = "absolute";
      newText.style.top = "500px";
      newText.style.left = "300px";
      newText.style.fontSize = "40px";
      newText.style.fontWeight = "600";
      newText.style.color = "#000000";
      newText.style.textAlign = "center";
      newText.style.fontFamily = "var(--font-family)";
      newText.style.outline = "none";
      newText.style.width = "450px";
      newText.style.minHeight = "50px";
      
      makeDraggable(newText);
      canvas.appendChild(newText);
  }

  function addDynamicField(type) {
      const canvas = document.getElementById('editorCanvas');
      const el = document.createElement('div');
      el.contentEditable = "false";
      el.className = "canvas-element resizable-text";
      el.style.position = "absolute";
      el.style.top = "450px";
      el.style.left = "250px";
      el.style.fontSize = "32px";
      el.style.fontWeight = "600";
      el.style.color = "#ffffff";
      el.style.textAlign = "center";
      el.style.fontFamily = "var(--font-family)";
      el.style.outline = "none";
      el.style.width = "400px";
      el.style.minHeight = "40px";

      if(type === 'venue') { el.id = 'canvasVenue'; el.innerHTML = `Venue Location<div class="resize-handle right"></div>`; }
      else if(type === 'date') { el.id = 'canvasDate'; el.innerHTML = `Event Date<div class="resize-handle right"></div>`; }
      else if(type === 'time') { el.id = 'canvasTime'; el.innerHTML = `00:00 AM - 00:00 PM<div class="resize-handle right"></div>`; }
      else if(type === 'tier') { el.id = 'canvasTier'; el.innerHTML = `VIP / General<div class="resize-handle right"></div>`; }

      makeDraggable(el);
      canvas.appendChild(el);
  }

  // --- RESET TEMPLATE ---
  function resetTemplate() {
      currentEditingTemplateId = null;
      document.querySelectorAll('.saved-tpl-card').forEach(c => c.style.border = '1px solid var(--color-border)');
      
      const defaultTplCard = document.querySelectorAll('#templateGallery .tpl-card')[0];
      if (defaultTplCard) defaultTplCard.click();
      
      document.getElementById('tplName').value = '';
      const eventSelect = document.getElementById('tplEventSelect');
      const guestSelect = document.getElementById('tplGuestSelect');
      if (eventSelect) eventSelect.value = '';
      if (guestSelect) guestSelect.innerHTML = '<option value="">First Select Event...</option>';
      
      const canvas = document.getElementById('editorCanvas');
      canvas.innerHTML = `
          <div class="canvas-element resizable-text" contenteditable="false" style="position: absolute; top: 150px; left: 50%; transform: translateX(-50%); text-align: center; font-size: 70px; font-weight: 800; color: #fff; font-family: var(--font-family); outline: none; cursor: move; width: 800px; min-height: 80px;">
            Event Title Here
            <div class="resize-handle right"></div>
          </div>

          <div class="canvas-element resizable-text" contenteditable="false" style="position: absolute; top: 270px; left: 50%; transform: translateX(-50%); text-align: center; font-size: 45px; color: #231f20; font-family: var(--font-family); outline: none; cursor: move; width: 700px; min-height: 60px;">
            Guest Pass Notice
            <div class="resize-handle right"></div>
          </div>

          <div id="canvasQRSpot" class="canvas-element qr-group-box" data-qr-size="310" data-qr-dark="#000000" data-qr-bg="#ffffff" data-qr-has-box="true" data-qr-radius="20" data-qr-padding="10" style="position: absolute; bottom: 180px; left: 50%; transform: translateX(-50%); width: 330px; height: 330px; background: #ffffff; border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: move; outline: none;">
              <div id="qrInnerCode" style="display: flex; align-items: center; justify-content: center; width: 310px; height: 310px;">
                <div style="width: 100%; height: 100%; background: #cbd5e1; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 30px; font-weight: bold;">QR SPOT</div>
              </div>
              <div id="canvasQrLabel" class="canvas-element non-text-editable" data-no-edit="true" style="position: absolute; bottom: -50px; left: 50%; transform: translateX(-50%); text-align: center; font-size: 32px; font-weight: bold; color: #fff; font-family: monospace; width: max-content; cursor: move;">QR-001</div>
          </div>
      `;

      canvas.querySelectorAll('.canvas-element').forEach(el => makeDraggable(el));

      if (document.getElementById('qrCustomSize')) document.getElementById('qrCustomSize').value = "310";
      if (document.getElementById('qrDarkColor')) document.getElementById('qrDarkColor').value = "#000000";
      if (document.getElementById('qrBgColor')) document.getElementById('qrBgColor').value = "#ffffff";
      if (document.getElementById('qrBgBoxToggle')) document.getElementById('qrBgBoxToggle').checked = true;
      if (document.getElementById('qrBoxRadius')) document.getElementById('qrBoxRadius').value = "20";
      if (document.getElementById('qrBoxPadding')) document.getElementById('qrBoxPadding').value = "10";
  }

// --- TEMPLATE CATEGORY FILTER LOGIC ---
  function filterTemplates(category, btnElement) {
      // 1. Highlight the active button
      if (btnElement && btnElement.parentElement) {
          btnElement.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btnElement.classList.add('active');
      }

      // 2. Show/Hide templates based on the hidden data-category attribute
      document.querySelectorAll('#templateGallery .tpl-card').forEach(card => {
          const cardCat = card.getAttribute('data-category') || 'General';
          
          if (category === 'All' || cardCat === category || cardCat.includes(category)) {
              card.style.display = 'flex';
          } else {
              card.style.display = 'none';
          }
      });
  }
  // --- SMART BACKGROUND SWAP OR LOAD ---
  function handleTopGalleryClick(id) {
      const tpl = windowSavedTemplates.find(x => x.id === id);
      if (!tpl) return;

      // If tenant is editing their OWN personal template, ask to swap JUST the background
      if (currentEditingTemplateId && !isEditingGlobal) {
          if (confirm("Do you want to apply this background to your current design without changing your text?\n\n(Click 'Cancel' to load the full Global Template instead.)")) {
              currentActiveBgString = tpl.thumbnail_url;
              document.getElementById('editorCanvas').style.backgroundImage = currentActiveBgString;
              
              // Move the checkmark to the new background visually
              document.querySelectorAll('#templateGallery .tpl-card').forEach(c => {
                  c.style.border = '1px solid var(--color-border)';
                  const check = c.querySelector('.active-check');
                  if(check) check.style.display = 'none';
                  if(c.getAttribute('onclick').includes(id)) {
                      c.style.border = '2px solid var(--color-primary)';
                      if(check) check.style.display = 'flex';
                  }
              });
              return; 
          }
      }
      
      // Otherwise, normal behavior: load the full template (texts + bg)
      loadSavedTemplate(id);
  }

  // --- LOAD SAVED TEMPLATE ---
  function loadSavedTemplate(id) {
      const tpl = windowSavedTemplates.find(x => x.id === id);
      if(!tpl) return;
      
      currentEditingTemplateId = id;
      isEditingGlobal = tpl.is_global === true;

      // 1. Highlight clicked card in bottom gallery
      document.querySelectorAll('.saved-tpl-card').forEach(c => c.style.border = '1px solid var(--color-border)');
      const activeCard = document.getElementById('saved-card-' + id);
      if(activeCard) activeCard.style.border = '2px solid var(--color-primary)';

      // 2. Safely replace Canvas DOM inside its wrapper panel
      const currentCanvas = document.getElementById('editorCanvas');
      if (currentCanvas) {
          const wrapper = currentCanvas.parentElement;
          currentCanvas.outerHTML = tpl.html_layout;
          
          const newCanvas = wrapper.querySelector('#editorCanvas');
          if (newCanvas) {
              newCanvas.style.position = 'absolute';
              newCanvas.style.top = '50%';
              newCanvas.style.left = '50%';
              newCanvas.style.transform = 'translate(-50%, -50%) scale(0.26)';
              newCanvas.style.transformOrigin = 'center';
              
              newCanvas.querySelectorAll('.canvas-element').forEach(node => makeDraggable(node));
          }
      }

      // 3. Sync Left Panel QR Inputs with the Loaded Template Properties
      const loadedQrSpot = document.getElementById('canvasQRSpot');
      if (loadedQrSpot) {
          const s = loadedQrSpot.dataset.qrSize || "310";
          const d = loadedQrSpot.dataset.qrDark || "#000000";
          const bg = loadedQrSpot.dataset.qrBg || "#ffffff";
          const hasBox = loadedQrSpot.dataset.qrHasBox !== 'false';
          const r = loadedQrSpot.dataset.qrRadius || "20";

          if (document.getElementById('qrCustomSize')) document.getElementById('qrCustomSize').value = s;
          if (document.getElementById('qrDarkColor')) document.getElementById('qrDarkColor').value = d;
          if (document.getElementById('qrBgColor')) document.getElementById('qrBgColor').value = bg;
          if (document.getElementById('qrBgBoxToggle')) document.getElementById('qrBgBoxToggle').checked = hasBox;
          if (document.getElementById('qrBoxRadius')) document.getElementById('qrBoxRadius').value = r;
      }

      // 4. Fill Right Settings Card
      document.getElementById('tplName').value = tpl.name || '';
      const eventSelect = document.getElementById('tplEventSelect');
      if (eventSelect) {
          eventSelect.value = tpl.event_id || '';
          
          const gDrop = document.getElementById('tplGuestSelect');
          if (gDrop && tpl.event_id) {
              gDrop.innerHTML = '<option value="">Select Guest to Preview...</option>';
              const filteredGuests = allFetchedGuests.filter(g => String(g.event_id) === String(tpl.event_id));
              filteredGuests.forEach(g => {
                  gDrop.innerHTML += `<option value="${g.id}">${g.guest_name}</option>`;
              });
              
              const assignedGuest = filteredGuests.find(g => String(g.template_id) === String(tpl.id));
              if (assignedGuest) {
                  gDrop.value = assignedGuest.id;
              } else if (filteredGuests.length > 0) {
                  gDrop.value = filteredGuests[0].id;
              }
              gDrop.dispatchEvent(new Event('change'));
          }
      }

      currentActiveBgString = tpl.thumbnail_url || "url('./templates/gatepass01.jpg')";

      // 5. Update top template thumbnail selection
      document.querySelectorAll('#templateGallery .tpl-card').forEach(c => {
          const check = c.querySelector('.active-check');
          c.style.border = '1px solid var(--color-border)';
          if(check) check.style.display = 'none';
          
          const onclickStr = c.getAttribute('onclick') || '';
          if (onclickStr.includes(id)) {
              c.style.border = '2px solid var(--color-primary)';
              if(check) check.style.display = 'flex';
          }
      });

      const modal = document.getElementById('allTemplatesModal');
      if(modal) modal.classList.add('hidden');
  }

  // --- RE-RENDER QR WITH LIVE ADJUSTABLE BOX PADDING ---
  function renderCanvasQR(textData = 'PREVIEW') {
      const qrSpot = document.getElementById('canvasQRSpot');
      if (!qrSpot) return;

      const size = parseInt(qrSpot.dataset.qrSize) || 310;
      const darkColor = qrSpot.dataset.qrDark || '#000000';
      const bgColor = qrSpot.dataset.qrBg || '#ffffff';
      const hasBox = qrSpot.dataset.qrHasBox !== 'false';
      const radius = parseInt(qrSpot.dataset.qrRadius) || 20;
      const boxPadding = parseInt(qrSpot.dataset.qrPadding) || 10;

      const totalBoxSize = hasBox ? (size + (boxPadding * 2)) : size;

      qrSpot.style.display = 'flex';
      qrSpot.style.flexDirection = 'column';
      qrSpot.style.alignItems = 'center';
      qrSpot.style.justifyContent = 'center';
      qrSpot.style.width = totalBoxSize + 'px';
      qrSpot.style.height = totalBoxSize + 'px';
      qrSpot.style.background = hasBox ? bgColor : 'transparent';
      qrSpot.style.borderRadius = hasBox ? (radius + 'px') : '0px';

      let inner = qrSpot.querySelector('#qrInnerCode');
      if (!inner) {
          inner = document.createElement('div');
          inner.id = 'qrInnerCode';
          qrSpot.prepend(inner);
      }

      inner.style.display = 'flex';
      inner.style.alignItems = 'center';
      inner.style.justifyContent = 'center';
      inner.style.width = size + 'px';
      inner.style.height = size + 'px';
      inner.style.background = 'transparent';
      inner.innerHTML = '';

      const effectiveLightColor = hasBox ? bgColor : 'rgba(0,0,0,0)';

      new QRCode(inner, {
          text: textData,
          width: size,
          height: size,
          colorDark: darkColor,
          colorLight: effectiveLightColor,
          correctLevel: QRCode.CorrectLevel.H
      });
  }

  // --- CANCEL EVENT FORM ROUTE ---
  function cancelEventForm() {
      currentEditEventId = null;
      const submitBtn = document.getElementById('submitDedicatedEventBtn');
      if (submitBtn) {
          submitBtn.innerHTML = 'Create Event &rarr;';
      }
      
      // Fallback: Check if switchView exists, otherwise toggle display directly
      if (typeof switchView === 'function') {
          switchView('createManageView');
      } else {
          document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
          const target = document.getElementById('createManageView');
          if (target) target.classList.add('active');
      }
  }
    function cancelGuestForm() {
    // Only reset edit mode
    currentEditGuestId = null;
    document.getElementById('submitAddGuestBtn').innerHTML = 'Save Guest <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    
    // Smoothly redirect directly to Create & Manage
    switchView('createManageView');
}  


  // --- DATABASE SAVING & LOADING ---
  async function fetchSavedTemplates() {
    if (!currentTenantId) return; // Failsafe
    const { data, error } = await supabaseClient.from('templates').select('*')
        .or(`tenant_id.eq.${currentTenantId},is_global.eq.true`)
        .order('created_at', { ascending: false });
    
    if (error) return;
    windowSavedTemplates = data || []; 

    const globalTemplates = windowSavedTemplates.filter(t => t.is_global === true);
    const myTemplates = windowSavedTemplates.filter(t => t.is_global !== true);

    // 1. Inject Global Templates (Top Gallery)
    const topGallery = document.getElementById('templateGallery');
    if (topGallery) {
        // Inject Defaults FIRST so they are never lost!
        topGallery.innerHTML = `
          <div onclick="applyTemplateBg(this, 'url(./templates/gatepass01.jpg)', '#ffffff', '#e2e8f0')" data-category="General" class="card tpl-card" style="min-width: 90px; height: 130px; border: 2px solid var(--color-primary); border-radius: var(--radius-md); display: flex; flex-direction: column; overflow: hidden; cursor: pointer; position: relative;">
             <div class="active-check" style="position: absolute; top: 4px; right: 4px; background: var(--color-primary); color: white; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; z-index:10;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
             <div style="width: 100%; height: 85px; background: url('./templates/gatepass01.jpg') center/cover no-repeat; background-color: var(--color-surface-soft); flex-shrink: 0;"></div>
             <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 4px 2px; background: var(--color-bg);">
                 <div style="font-size: 9px; font-weight: 700; line-height: 1.2;">Custom Gatepass</div>
                 <div style="font-size: 8px; color: var(--color-text-secondary); line-height: 1; text-transform: uppercase; margin-top: 2px;">General</div>
             </div>
          </div>

          <div onclick="applyTemplateBg(this, 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)', '#111827', '#64748b')" data-category="Corporate" class="card tpl-card" style="min-width: 90px; height: 130px; border: 1px solid var(--color-border); border-radius: var(--radius-md); display: flex; flex-direction: column; overflow: hidden; cursor: pointer; position: relative;">
             <div class="active-check" style="display:none; position: absolute; top: 4px; right: 4px; background: var(--color-primary); color: white; border-radius: 50%; width: 16px; height: 16px; align-items: center; justify-content: center; z-index:10;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
             <div style="width: 100%; height: 85px; background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%); flex-shrink: 0;"></div>
             <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 4px 2px; background: var(--color-bg);">
                 <div style="font-size: 9px; font-weight: 700; line-height: 1.2;">Corporate Clean</div>
                 <div style="font-size: 8px; color: var(--color-text-secondary); line-height: 1; text-transform: uppercase; margin-top: 2px;">Corporate</div>
             </div>
          </div>

          <div onclick="applyTemplateBg(this, 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)', '#831843', '#be185d')" data-category="Marriage" class="card tpl-card" style="min-width: 90px; height: 130px; border: 1px solid var(--color-border); border-radius: var(--radius-md); display: flex; flex-direction: column; overflow: hidden; cursor: pointer; position: relative;">
             <div class="active-check" style="display:none; position: absolute; top: 4px; right: 4px; background: var(--color-primary); color: white; border-radius: 50%; width: 16px; height: 16px; align-items: center; justify-content: center; z-index:10;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
             <div style="width: 100%; height: 85px; background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%); flex-shrink: 0;"></div>
             <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 4px 2px; background: var(--color-bg);">
                 <div style="font-size: 9px; font-weight: 700; line-height: 1.2;">Wedding Theme</div>
                 <div style="font-size: 8px; color: var(--color-text-secondary); line-height: 1; text-transform: uppercase; margin-top: 2px;">Marriage</div>
             </div>
          </div>
        `;
        
        // A. Render fully saved Global Templates from the Database
        globalTemplates.slice(0, 10).forEach(t => {
            const reqPlan = t.required_plan || 'Basic';
            const cat = t.category || 'General';
            
            // Check if the user's plan is high enough
            const isBasicUser = window.currentPlanTier.toLowerCase() === 'basic';
            const isProUser = window.currentPlanTier.toLowerCase() === 'pro';
            
            let isLocked = false;
            if (reqPlan === 'Premium' && (isBasicUser || isProUser)) isLocked = true;
            if (reqPlan === 'Pro' && isBasicUser) isLocked = true;
            
            const lockIcon = isLocked ? `<div style="position:absolute; top:4px; left:4px; background:rgba(0,0,0,0.7); color:white; border-radius:4px; padding:2px 6px; font-size:10px; z-index:10;">🔒 ${reqPlan}</div>` : '';
            
            const clickAction = isLocked 
                ? `openUpgradeModal('${reqPlan} Templates')` 
                : `handleTopGalleryClick('${t.id}')`;

            topGallery.innerHTML += `
              <div onclick="${clickAction}" data-category="${cat}" class="card tpl-card ${isLocked ? 'premium-locked' : ''}" style="min-width: 90px; height: 130px; border: 2px solid transparent; box-shadow: 0 0 0 1px var(--color-border); border-radius: var(--radius-md); display: flex; flex-direction: column; overflow: hidden; cursor: pointer; position: relative; transition: border 0.2s;">
                 ${lockIcon}
                 <div class="active-check" style="display:none; position: absolute; top: 4px; right: 4px; background: var(--color-primary); color: white; border-radius: 50%; width: 16px; height: 16px; align-items: center; justify-content: center; z-index:10;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
                 <div style="width: 100%; height: 85px; background: ${t.thumbnail_url} center/cover no-repeat; background-color: var(--color-surface-soft); flex-shrink: 0;"></div>
                 <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 4px 2px; background: var(--color-bg);">
                     <div style="font-size: 9px; font-weight: 700; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center;">${t.name}</div>
                     <div style="font-size: 8px; color: var(--color-text-secondary); line-height: 1; text-transform: uppercase; margin-top: 2px;">${cat}</div>
                 </div>
              </div>`;
        });

        // B. Render the "+ More" button if there are more than 10 Database Templates
        if (globalTemplates.length > 10) {
            topGallery.innerHTML += `
              <div onclick="openTemplatesModal('global')" class="card" style="min-width: 90px; height: 130px; border: 1px solid var(--color-border); background: var(--color-surface-soft); border-radius: var(--radius-md); display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; color: var(--color-primary);">
                 <div style="font-size: 16px; font-weight: 700;">+${globalTemplates.length - 10}</div>
                 <div style="font-size: 10px; font-weight: 600;">More</div>
              </div>`;
        }

        // C. Render the AI Generation Button at the very end
        topGallery.innerHTML += `
              <div onclick="alert('AI Generation feature is coming in V2!')" class="card" style="min-width: 150px; height: 130px; background: linear-gradient(135deg, #ea7e8c 0%, #9865a7 50%, #4a549a 100%); border-radius: var(--radius-md); display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; position: relative; border: none; color: white; box-shadow: 0 6px 16px rgba(152, 101, 167, 0.3); flex-shrink: 0;">
                 <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 8px;"><path d="M9 3L10.1241 6.55181C10.4287 7.51478 11.134 8.29177 12.0628 8.65345L15 9.79723L12.0628 10.941C11.134 11.3027 10.4287 12.0797 10.1241 13.0426L9 16.5945L7.87588 13.0426C7.57127 12.0797 6.86598 11.3027 5.93718 10.941L3 9.79723L5.93718 8.65345C6.86598 8.29177 7.57127 7.51478 7.87588 6.55181L9 3Z"></path></svg>
                 <span style="font-size: 13px; font-weight: 700;">Generate by AI</span>
              </div>`;
    }

    // 2. Inject Personal Templates (Bottom Gallery)
    const bottomGallery = document.getElementById('savedTemplatesGallery');
    const moreBtn = document.getElementById('moreTemplatesBtnContainer');
    if (!bottomGallery) return;

    bottomGallery.innerHTML = `
      <div onclick="resetTemplate()" class="card hide-on-mobile" style="min-width: 180px; height: 90px; border: 1px dashed var(--color-primary); background: var(--color-primary-soft); color: var(--color-primary); border-radius: var(--radius-md); display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;">
         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
         <div style="font-size: 11px; font-weight: 600; margin-top: 8px;">New Template</div>
      </div>
    `;

    myTemplates.slice(0, 4).forEach((t) => {
      const dateStr = new Date(t.created_at).toLocaleDateString();
      bottomGallery.innerHTML += `
        <div id="saved-card-${t.id}" class="card saved-tpl-card" style="min-width: 260px; height: 90px; padding: 12px; display: flex; gap: 12px; align-items: center; border: 1px solid var(--color-border); border-radius: var(--radius-md); position: relative; flex-shrink: 0; transition: 0.2s;">
           <div onclick="loadSavedTemplate('${t.id}')" style="display:flex; flex:1; gap:12px; cursor:pointer; align-items:center;" title="Click to Edit">
               <div style="width: 45px; height: 65px; background: ${t.thumbnail_url} center/cover no-repeat; background-color: var(--color-surface-soft); border-radius: 4px; border: 1px solid var(--color-border);"></div>
               <div><div style="font-size: 13px; font-weight: 700; color: var(--color-text); margin-bottom: 2px;">${t.name}</div><div style="font-size: 11px; color: var(--color-text-secondary);">${dateStr}</div></div>
           </div>
           <div style="display:flex; flex-direction:column; gap:6px;">
               <button onclick="loadSavedTemplate('${t.id}')" style="background:var(--color-primary-soft); color:var(--color-primary); border:none; border-radius:4px; padding:4px; cursor:pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg></button>
               <button onclick="deleteTemplate('${t.id}')" style="background:var(--color-danger-soft); color:var(--color-danger); border:none; border-radius:4px; padding:4px; cursor:pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
           </div>
        </div>
      `;
    });

    if (myTemplates.length > 4) {
        moreBtn.style.display = 'block';
        document.getElementById('moreTemplatesCount').innerText = '+' + (myTemplates.length - 4);
        moreBtn.onclick = () => openTemplatesModal('personal');
    } else {
        moreBtn.style.display = 'none';
    }
generateNotifications();
  }

  // Helper function to handle the modal popup for either Global or Personal templates
  function openTemplatesModal(type) {
      const grid = document.getElementById('allTemplatesGrid');
      grid.innerHTML = '';
      
      const templatesToShow = type === 'global' 
          ? windowSavedTemplates.filter(t => t.is_global === true) 
          : windowSavedTemplates.filter(t => t.is_global !== true);

      templatesToShow.forEach(t => {
          const dateStr = new Date(t.created_at).toLocaleDateString();
          grid.innerHTML += `
            <div id="saved-card-${t.id}" class="card saved-tpl-card" style="min-width: 260px; height: 90px; padding: 12px; display: flex; gap: 12px; align-items: center; border: 1px solid var(--color-border); border-radius: var(--radius-md); position: relative; flex-shrink: 0; transition: 0.2s;">
               <div onclick="loadSavedTemplate('${t.id}')" style="display:flex; flex:1; gap:12px; cursor:pointer; align-items:center;" title="Click to Edit">
                   <div style="width: 45px; height: 65px; background: ${t.thumbnail_url} center/cover no-repeat; background-color: var(--color-surface-soft); border-radius: 4px; border: 1px solid var(--color-border);"></div>
                   <div><div style="font-size: 13px; font-weight: 700; color: var(--color-text); margin-bottom: 2px;">${t.name}</div><div style="font-size: 11px; color: var(--color-text-secondary);">${dateStr}</div></div>
               </div>
               <div style="display:flex; flex-direction:column; gap:6px;">
                   <button onclick="loadSavedTemplate('${t.id}')" style="background:var(--color-primary-soft); color:var(--color-primary); border:none; border-radius:4px; padding:4px; cursor:pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg></button>
                   ${type === 'personal' ? `<button onclick="deleteTemplate('${t.id}')" style="background:var(--color-danger-soft); color:var(--color-danger); border:none; border-radius:4px; padding:4px; cursor:pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
               </div>
            </div>
          `;
      });
      document.getElementById('allTemplatesModal').classList.remove('hidden');
  }

  // --- ASSET LIBRARY LOGIC ---
  async function openAssetLibrary() {
      document.getElementById('assetLibraryModal').classList.remove('hidden');
      const grid = document.getElementById('assetLibraryGrid');
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--color-text-secondary); margin-top: 40px; font-size: 13px;">Loading your images...</div>';
      
      const folderPath = `tenant_${currentTenantId}`;
      const { data, error } = await supabaseClient.storage.from('gate-pass-assets').list(folderPath);
      
      if (error || !data || data.length === 0) {
          grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--color-text-secondary); margin-top: 40px; font-size: 13px;">No images found. Upload one to get started!</div>';
          return;
      }

      const files = data.filter(f => f.name !== '.emptyFolderPlaceholder');
      grid.innerHTML = '';
      
      files.forEach(file => {
          const { data: { publicUrl } } = supabaseClient.storage.from('gate-pass-assets').getPublicUrl(`${folderPath}/${file.name}`);
          grid.innerHTML += `
              <div onclick="setCanvasBackground('${publicUrl}')" style="aspect-ratio: 3/4; border-radius: var(--radius-sm); border: 1px solid var(--color-border); overflow: hidden; cursor: pointer; position: relative; background: var(--color-bg);" class="group" title="Click to use this image">
                  <div style="width: 100%; height: 100%; background: url('${publicUrl}') center/cover no-repeat;"></div>
              </div>
          `;
      });
  }

  function setCanvasBackground(url) {
      currentActiveBgString = `url('${url}')`;
      document.getElementById('editorCanvas').style.backgroundImage = currentActiveBgString;
      document.getElementById('assetLibraryModal').classList.add('hidden');
  }

  async function uploadToAssetLibrary(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      const grid = document.getElementById('assetLibraryGrid');
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--color-primary); font-weight: bold; margin-top: 40px; font-size: 14px;">Uploading image to your storage...</div>';

      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const folderPath = `tenant_${currentTenantId}/${fileName}`;

          const { error } = await supabaseClient.storage.from('gate-pass-assets').upload(folderPath, file, { upsert: false });
          if (error) throw error;
          
          // Refresh gallery to show the new image
          openAssetLibrary();
      } catch (err) {
          alert("Error uploading image: " + err.message);
          openAssetLibrary(); 
      } finally {
          event.target.value = ''; 
      }
  }

  // --- ADVANCED CANVAS ZOOM & PAN ---
  let canvasZoom = 0.26; 
  let panX = -50; // Using percentages for center transform
  let panY = -50;
  let isPanning = false;
  let startPanX = 0; let startPanY = 0;

  document.addEventListener('DOMContentLoaded', () => {
      const canvasWrapper = document.getElementById('editorCanvas').parentElement;
      const canvas = document.getElementById('editorCanvas');
      
      if(canvasWrapper && canvas) {
          // ZOOM TO CURSOR
          canvasWrapper.addEventListener('wheel', (e) => {
              if(e.ctrlKey || e.metaKey || e.shiftKey) return; 
              e.preventDefault();

              const zoomDirection = e.deltaY < 0 ? 1 : -1;
              const newZoom = Math.min(Math.max(canvasZoom + (zoomDirection * 0.05), 0.15), 1.5);
              
              if (newZoom !== canvasZoom) {
                  canvasZoom = newZoom;
                  canvas.style.transform = `translate(${panX}%, ${panY}%) scale(${canvasZoom})`;
              }
          });

          // MIDDLE MOUSE PANNING
          canvasWrapper.addEventListener('mousedown', (e) => {
              if (e.button === 1) { // Middle mouse button
                  e.preventDefault();
                  isPanning = true;
                  startPanX = e.clientX;
                  startPanY = e.clientY;
                  canvasWrapper.style.cursor = 'grabbing';
              }
          });

          window.addEventListener('mousemove', (e) => {
              if (!isPanning) return;
              
              // Calculate movement relative to screen size to adjust percentages
              const deltaX = (e.clientX - startPanX) * 0.1;
              const deltaY = (e.clientY - startPanY) * 0.1;
              
              panX += deltaX;
              panY += deltaY;
              
              startPanX = e.clientX;
              startPanY = e.clientY;
              
              canvas.style.transform = `translate(${panX}%, ${panY}%) scale(${canvasZoom})`;
          });

          window.addEventListener('mouseup', (e) => {
              if (e.button === 1) {
                  isPanning = false;
                  canvasWrapper.style.cursor = 'default';
              }
          });
      }
  });

  

  async function deleteTemplate(id) {
      if(confirm("Permanently delete this template?")) {
          await supabaseClient.from('templates').delete().eq('id', id);
          if (currentEditingTemplateId === id) resetTemplate();
          fetchSavedTemplates();
      }
  }

  // --- SAVE TEMPLATE (PRESERVES QR ID POSITION & STYLES) ---
  async function saveGatePassTemplate(saveAsNew = false) {
      const tplName = document.getElementById('tplName').value.trim();
      if (!tplName) return alert("Please enter a Template Name before saving!");

      document.querySelectorAll('.canvas-element').forEach(node => node.style.outline = "none");
      
      const canvasClone = document.getElementById('editorCanvas').cloneNode(true);
      const cQrSpot = canvasClone.querySelector('#canvasQRSpot');
      if (cQrSpot) {
          const inner = cQrSpot.querySelector('#qrInnerCode');
          if (inner) {
              inner.innerHTML = `<div style="width:100%; height:100%; background:#cbd5e1; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:30px; font-weight:bold;">QR SPOT</div>`;
          }
      }

      const cleanCanvasHtml = canvasClone.outerHTML;
      const assignedEventId = document.getElementById('tplEventSelect').value || null;
      const selectedGuestId = document.getElementById('tplGuestSelect').value || null;
	// NEW STRICT VALIDATION: ONE PASS PER GUEST
      if (selectedGuestId) {
          const guest = allFetchedGuests.find(g => g.id === selectedGuestId);
          if (guest && guest.template_id) {
              // Block if saving as new, OR if trying to attach a different template to this guest
              if (saveAsNew || !currentEditingTemplateId || String(guest.template_id) !== String(currentEditingTemplateId)) {
                  return alert("STRICT RULE: This guest already has a gate pass assigned to them.\n\nYou can only 'Update Pass' on their existing design, you cannot create multiple designs for one guest. Please select a different guest.");
              }
          }
      }
      const payload = {
         name: tplName, 
         event_type: 'Custom', 
         html_layout: cleanCanvasHtml, 
         thumbnail_url: currentActiveBgString,
         event_id: assignedEventId,
         is_global: false,            // Ensures it saves as personal
         tenant_id: currentTenantId   // Ensures it belongs only to this tenant
      };

      let savedTemplateId = currentEditingTemplateId;

      // Protection Logic: Block tenants from overwriting Admin templates
      if (currentEditingTemplateId && !saveAsNew) {
          if (isEditingGlobal) {
              alert("You cannot overwrite a Global System Template. Saving as a new personal template instead.");
              saveAsNew = true; 
          } else {
              const { error } = await supabaseClient.from('templates').update(payload).eq('id', currentEditingTemplateId);
              if (error) return alert("Error updating: " + error.message);
          }
      } 
      
      // If it's a new template, or saveAsNew was forced to true by the protection logic
      if (!currentEditingTemplateId || saveAsNew) {
          const { data, error } = await supabaseClient.from('templates').insert([payload]).select();
          if (error) return alert("Error saving: " + error.message);
          if (data && data[0]) {
              savedTemplateId = data[0].id;
              currentEditingTemplateId = savedTemplateId;
              isEditingGlobal = false; // They now own this copy
          }
      }

      if (selectedGuestId && savedTemplateId) {
          await supabaseClient.from('guests').update({ template_id: savedTemplateId }).eq('id', selectedGuestId);
      }

      alert("Template saved successfully!");
      await fetchSavedTemplates();
      await fetchAllGuestsForKPIs();
  }

 // Combined save function for BOTH the Profile Tab and the Dashboard Banner
  async function updateUserProfile(isFromBanner = false) {
      const name = isFromBanner ? document.getElementById('profileName').value.trim() : document.getElementById('settingName').value.trim();
      const comp = isFromBanner ? document.getElementById('profileCompany').value.trim() : document.getElementById('settingCompany').value.trim();
      
      // Combine Country Code and Number
      const phoneCode = isFromBanner ? document.getElementById('profilePhoneCode').value : document.getElementById('settingPhoneCode').value;
      const rawPhone = isFromBanner ? document.getElementById('profilePhone').value.trim() : document.getElementById('settingPhone').value.trim();
      const finalPhone = rawPhone ? (phoneCode + rawPhone.replace(/^0+/, '')) : '';
      
      if (!name) return alert("Full Name is required!");

      const { data: { session } } = await supabaseClient.auth.getSession();
      const { error } = await supabaseClient.from('tenants').update({ full_name: name, company_name: comp, phone: finalPhone }).eq('owner_id', session.user.id);
      
      if(error) {
          alert("Error updating profile: " + error.message);
      } else {
          alert("Profile updated successfully!");
          const profileBanner = document.getElementById('tenantProfileCard');
          if(profileBanner) profileBanner.classList.add('hidden');
          checkTenantProfile(session); 
      }
  }

  document.addEventListener('DOMContentLoaded', () => {
      loadCustomFonts(); // <-- Trigger Font Engine

      // FIX: Apply makeDraggable to ALL default canvas elements so they can be selected
      document.querySelectorAll('#editorCanvas .canvas-element').forEach(el => makeDraggable(el));

      document.addEventListener('keydown', (e) => {
          if (e.key === "Escape") {
              const prev = document.getElementById('previewModal');
              const qr = document.getElementById('qrModal');
              const all = document.getElementById('allTemplatesModal');
              if(prev) prev.classList.add('hidden');
              if(qr) qr.classList.add('hidden');
              if(all) all.classList.add('hidden');
          }

          // Protect canvasQRSpot and canvasQrLabel from keyboard deletion
          if ((e.key === "Delete" || e.key === "Backspace") && currentlySelectedElement) {
              if (currentlySelectedElement.contentEditable === "true") return; // Allow normal text typing deletion
              
              if (currentlySelectedElement.id === 'canvasQRSpot' || currentlySelectedElement.id === 'canvasQrLabel') {
                  return; // Cannot delete the QR spot or its permanent ID tag
              }
              
              e.preventDefault();
              currentlySelectedElement.remove();
              currentlySelectedElement = null;
          }
      });

      const colorPicker = document.getElementById('elementColor');
      const sizePicker = document.getElementById('elementFontSize');
      const fontPicker = document.getElementById('elementFontFamily');
      const alignPicker = document.getElementById('elementTextAlign');
      
      if (colorPicker) colorPicker.addEventListener('input', (e) => {
          if (currentlySelectedElement) currentlySelectedElement.style.color = e.target.value;
      });
      if (sizePicker) sizePicker.addEventListener('input', (e) => {
          if (currentlySelectedElement && e.target.value) currentlySelectedElement.style.fontSize = e.target.value + 'px';
      });
      if (fontPicker) fontPicker.addEventListener('change', (e) => {
          if (currentlySelectedElement) currentlySelectedElement.style.fontFamily = e.target.value;
      });
      if (alignPicker) alignPicker.addEventListener('change', (e) => {
          if (currentlySelectedElement) currentlySelectedElement.style.textAlign = e.target.value;
      });

// 1. Text Alignment Toggle Buttons
      document.querySelectorAll('.btn-align-toggle').forEach(btn => {
          btn.addEventListener('click', () => {
              document.querySelectorAll('.btn-align-toggle').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              if (currentlySelectedElement) {
                  currentlySelectedElement.style.textAlign = btn.dataset.align;
              }
          });
      });

      // 2. QR Live Customizer (Includes Padding Slider)
      const qrSizeInput = document.getElementById('qrCustomSize');
      const qrDarkInput = document.getElementById('qrDarkColor');
      const qrBgBoxToggle = document.getElementById('qrBgBoxToggle');
      const qrBgInput = document.getElementById('qrBgColor');
      const qrRadiusInput = document.getElementById('qrBoxRadius');
      const qrPaddingInput = document.getElementById('qrBoxPadding');

      // EXPOSED TO WINDOW: Fixes the 'Uncaught ReferenceError' in the console!
      window.updateQRProperties = function() {
          const qrSpot = document.getElementById('canvasQRSpot');
          if (!qrSpot) return;
          if (qrSizeInput) qrSpot.dataset.qrSize = qrSizeInput.value;
          if (qrDarkInput) qrSpot.dataset.qrDark = qrDarkInput.value;
          if (qrBgInput) qrSpot.dataset.qrBg = qrBgInput.value;
          if (qrBgBoxToggle) qrSpot.dataset.qrHasBox = qrBgBoxToggle.checked ? "true" : "false";
          if (qrRadiusInput) qrSpot.dataset.qrRadius = qrRadiusInput.value;
          if (qrPaddingInput) qrSpot.dataset.qrPadding = qrPaddingInput.value;

          const gDrop = document.getElementById('tplGuestSelect');
          const currentText = (gDrop && gDrop.value) ? gDrop.value : 'PREVIEW_QR';
          renderCanvasQR(currentText);
      }

      if (qrSizeInput) qrSizeInput.addEventListener('input', window.updateQRProperties);
      if (qrDarkInput) qrDarkInput.addEventListener('input', window.updateQRProperties);
      if (qrBgBoxToggle) qrBgBoxToggle.addEventListener('change', window.updateQRProperties);
      if (qrBgInput) qrBgInput.addEventListener('input', window.updateQRProperties);
      if (qrRadiusInput) qrRadiusInput.addEventListener('input', window.updateQRProperties);
      if (qrPaddingInput) qrPaddingInput.addEventListener('input', window.updateQRProperties);

      // 2. Dropdown Sync (Event Selection -> Auto-links to Guest and Saved Templates)
      const eventDropdown = document.getElementById('tplEventSelect');
      if (eventDropdown) {
          eventDropdown.addEventListener('change', (e) => {
              const eventId = e.target.value;
              const gDrop = document.getElementById('tplGuestSelect');
              if (!gDrop) return;

              // Check if a saved template exists for this event
              const matchedTpl = windowSavedTemplates.find(t => String(t.event_id) === String(eventId));
              if (matchedTpl && currentEditingTemplateId !== matchedTpl.id) {
                  loadSavedTemplate(matchedTpl.id);
                  return;
              }

              gDrop.innerHTML = '<option value="">Select Guest to Preview...</option>';
              if (!eventId) {
                  gDrop.dispatchEvent(new Event('change'));
                  return;
              }

              const filteredGuests = allFetchedGuests.filter(g => String(g.event_id) === String(eventId));
              filteredGuests.forEach(g => {
                  gDrop.innerHTML += `<option value="${g.id}">${g.guest_name}</option>`;
              });

              if (filteredGuests.length > 0) {
                  gDrop.value = filteredGuests[0].id;
              }
              gDrop.dispatchEvent(new Event('change'));
          });
      }

      // 3. Guest Selection -> Fills All Database Fields (Name, Event, Venue, Date, Time, QR)
      const guestDropdown = document.getElementById('tplGuestSelect');
      if(guestDropdown) {
          guestDropdown.addEventListener('change', (e) => {
              const guestId = e.target.value;
              const guest = allFetchedGuests.find(g => g.id === guestId);
              
              const guestNameEl = document.getElementById('canvasGuestName');
              const eventNameEl = document.getElementById('canvasEventName');
              const venueEl = document.getElementById('canvasVenue');
              const dtEl = document.getElementById('canvasDateTime');
              const qrLabelEl = document.getElementById('canvasQrLabel');

              if(!guest) {
                  if(guestNameEl) guestNameEl.innerText = 'Guest Name';
                  if(eventNameEl) eventNameEl.innerText = 'Event Name';
                  if(venueEl) venueEl.innerText = 'Venue Location';
                  if(dtEl) dtEl.innerText = 'Date & Time';
                  if(qrLabelEl) qrLabelEl.innerText = 'QR-001';
                  return;
              }

              // Fill Text Elements with Database Records
              if(guestNameEl) guestNameEl.innerText = guest.guest_name;
              if(eventNameEl && guest.events) eventNameEl.innerText = guest.events.event_name;
              if(qrLabelEl) qrLabelEl.innerText = 'QR-' + String(guest.ticket_number || 0).padStart(3, '0');

              // Find full event record to extract venue, date, and time
              const parentEv = allFetchedEvents.find(ev => ev.id === guest.event_id);
              if (parentEv) {
                  if(venueEl) venueEl.innerText = parentEv.venue || 'Venue TBD';
                  if(dtEl) {
                      const dStr = parentEv.event_date ? parentEv.event_date.split('T')[0] : '';
                      const tStr = parentEv.start_time ? ` · ${parentEv.start_time}` : '';
                      dtEl.innerText = dStr + tStr;
                  }
              }

              // Render Styled QR Code with Guest's ID
              renderCanvasQR(guest.id);
          });
      }
  });

// --- CANCEL EVENT CREATION ---
  function cancelEventCreation() {
      // 1. If you have an event form ID, reset the inputs (change 'eventForm' if your form has a different ID)
      const form = document.getElementById('eventForm');
      if (form) form.reset();

      // 2. Clear out specific fields manually just in case
      const eName = document.getElementById('eventName');
      const eDate = document.getElementById('eventDate');
      if (eName) eName.value = '';
      if (eDate) eDate.value = '';

      // 3. Redirect to the main Events / Create & Manage tab
      const eventsTabBtn = document.querySelector('button[onclick*="eventsView"]');
      if (eventsTabBtn) {
          eventsTabBtn.click();
      } else {
          // Fallback to the Dashboard tab if the Events tab can't be found
          document.querySelectorAll('.nav-item')[0].click(); 
      }
  }
// ==========================================
  // --- BULK UPLOAD & AUTO-GENERATE LOGIC ---
  // ==========================================

function getNextTicketNumber(eventId) {
      // Find all guests belonging to this specific event
      const eventGuests = allFetchedGuests.filter(g => g.event_id === eventId);
      let maxTicket = 0;
      
      // Find the highest existing ticket number
      eventGuests.forEach(g => {
          if (g.ticket_number && g.ticket_number > maxTicket) {
              maxTicket = g.ticket_number;
          }
      });
      
      return maxTicket;
  }  

function toggleGuestInputMode(mode) {
      const bulkZone = document.getElementById('bulkUploadZone');
      const autoZone = document.getElementById('autoGenerateZone');
      
      if (mode === 'bulk') {
          if (bulkZone.style.display === 'block') { bulkZone.style.display = 'none'; return; }
          bulkZone.style.display = 'block';
          autoZone.style.display = 'none';
      } else if (mode === 'auto') {
          if (autoZone.style.display === 'block') { autoZone.style.display = 'none'; return; }
          autoZone.style.display = 'block';
          bulkZone.style.display = 'none';
      }
  }

  function downloadGuestTemplate() {
      const ws_data = [ ["Guest Name", "Ticket Tier", "Capacity", "Email", "Phone"] ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      XLSX.utils.book_append_sheet(wb, ws, "Guests Template");
      XLSX.writeFile(wb, "QRGate_Guest_Import.xlsx");
  }

  function handleExcelFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      document.getElementById('excelFileNameDisplay').innerText = file.name;

      const reader = new FileReader();
      reader.onload = async function(e) {
          try {
              const data = new Uint8Array(e.target.result);
              const workbook = XLSX.read(data, { type: 'array' });
              const jsonRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

              const eventId = document.getElementById('addGuestEventSelect').value;
              if (!eventId) {
                  alert('Please select a Target Event from the dropdown above before uploading.');
                  document.getElementById('excelFileInput').value = '';
                  return;
              }

              // ====================================================================
              // 🔒 SECURITY FIX: LIVE VALIDATION FOR BULK UPLOAD
              // ====================================================================
              const { data: { session } } = await supabaseClient.auth.getSession();
              if (!session) return;
              
              const { data: liveTenant } = await supabaseClient
                  .from('tenants')
                  .select('subscription_status')
                  .eq('owner_id', session.user.id)
                  .single();
                  
              const { data: dbLimits } = await supabaseClient.from('plan_limits').select('*');
              const livePlanTier = liveTenant ? liveTenant.subscription_status : 'Basic';
              const currentPlanData = dbLimits ? dbLimits.find(p => p.plan_name.toLowerCase() === livePlanTier.toLowerCase()) : null;
              const trueMaxGuests = currentPlanData ? parseInt(currentPlanData.max_guests) : 50;

              // 1. Check if they are still allowed to use Bulk Upload
              if (livePlanTier.toLowerCase() === 'basic') {
                  openUpgradeModal('Bulk Excel Upload');
                  document.getElementById('excelFileInput').value = '';
                  applyAccountLocks();
                  return;
              }

              // 2. Check Live Guest Limit
              const { count: liveGuestCount, error: countErr } = await supabaseClient
                  .from('guests')
                  .select('*', { count: 'exact', head: true })
                  .eq('event_id', eventId);

              const currentEventGuests = countErr ? 0 : liveGuestCount;

              if ((currentEventGuests + jsonRows.length) > trueMaxGuests) {
                  openUpgradeModal(`Bulk Upload blocked. Your live plan limit is ${trueMaxGuests} guests per event. You currently have ${currentEventGuests} guests, and your Excel file has ${jsonRows.length} rows.`);
                  document.getElementById('excelFileInput').value = '';
                  return; // Stop upload
              }
              // ====================================================================

              let batchInserts = [];
              let currentMaxTicket = getNextTicketNumber(eventId); // Get starting sequence

              for (let i = 0; i < jsonRows.length; i++) {
                  let row = jsonRows[i];
                  let name = row['Guest Name'] || row['guest_name'] || row['Name'];
                  if (!name) {
                      alert(`Upload cancelled! Row ${i + 2} is missing a "Guest Name". Please fix your file and try again.`);
                      document.getElementById('excelFileInput').value = '';
                      return;
                  }
                  
                  currentMaxTicket++; // Climb by 1 for each row

                  batchInserts.push({
                      event_id: eventId, guest_name: String(name).trim(),
                      ticket_tier: String(row['Ticket Tier'] || 'General').trim(),
                      allowed_capacity: parseInt(row['Capacity']) || 1,
                      email: row['Email'] ? String(row['Email']).trim() : null,
                      phone: row['Phone'] ? String(row['Phone']).trim() : null,
                      ticket_number: currentMaxTicket,
                      invitation_status: 'Pending', sent_via: 'System'
                  });
              }

              const { error } = await supabaseClient.from('guests').insert(batchInserts);
              if (error) {
                  alert('Database bulk insert error: ' + error.message);
              } else {
                  alert(`Successfully imported ${batchInserts.length} guests!`);
                  document.getElementById('excelFileInput').value = '';
                  document.getElementById('excelFileNameDisplay').innerText = window.t('txt_no_file', 'No file chosen');
                  document.getElementById('bulkUploadZone').style.display = 'none';
                  fetchAllGuestsForKPIs();
                  switchView('guestListsView');
              }
          } catch (err) { alert('Error parsing Excel file. Ensure it is a valid .xlsx format.'); }
      };
      reader.readAsArrayBuffer(file);
  }

  async function executeAutoGenerate() {
      const eventId = document.getElementById('addGuestEventSelect').value;
      const countInput = parseInt(document.getElementById('autoGenCount').value);
      const tier = document.getElementById('autoGenTier').value.trim() || 'General';

      if (!eventId) { alert('Please select a target event.'); return; }
      if (!countInput || countInput <= 0) { alert('Please enter a valid pass count.'); return; }

      // ====================================================================
      // 🔒 SECURITY FIX: LIVE DATABASE VALIDATION
      // Fetch the absolute latest plan tier and guest count directly from DB
      // ====================================================================
      
      // A. Get the Live Tenant Plan
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return;
      
      const { data: liveTenant } = await supabaseClient
          .from('tenants')
          .select('subscription_status')
          .eq('owner_id', session.user.id)
          .single();
          
      const { data: dbLimits } = await supabaseClient.from('plan_limits').select('*');
      
      const livePlanTier = liveTenant ? liveTenant.subscription_status : 'Basic';
      const currentPlanData = dbLimits ? dbLimits.find(p => p.plan_name.toLowerCase() === livePlanTier.toLowerCase()) : null;
      const trueMaxGuests = currentPlanData ? parseInt(currentPlanData.max_guests) : 50;

      // B. Get the Live Guest Count for this event (highly efficient count query)
      const { count: liveGuestCount, error: countErr } = await supabaseClient
          .from('guests')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId);

      const currentEventGuests = countErr ? 0 : liveGuestCount;

      // 1. Check Live SaaS Plan Limit
      if ((currentEventGuests + countInput) > trueMaxGuests) {
          openUpgradeModal(`Auto-Generate blocked. Your current plan limit is ${trueMaxGuests} guests per event. You already have ${currentEventGuests} guests in this event.`);
          return; // Instantly blocks the generation!
      }

      // 2. Check Physical Event Venue Capacity
      const targetEvent = allFetchedEvents.find(e => e.id === eventId);
      const eventName = targetEvent ? targetEvent.event_name : 'Event';
      const eventCapacity = targetEvent ? parseInt(targetEvent.total_capacity) || 100 : 100;
      const remainingSpots = eventCapacity - currentEventGuests;

      if (countInput > remainingSpots) {
          alert(`Cannot generate ${countInput} passes. Only ${remainingSpots} spots remaining for this physical venue!`);
          return;
      }

      // ====================================================================
      // 3. Generate Passes (Safe to proceed)
      // ====================================================================
      let batchInserts = [];
      let currentMaxTicket = getNextTicketNumber(eventId); // Get starting sequence

      for (let i = 0; i < countInput; i++) {
          currentMaxTicket++; // Climb by 1

          batchInserts.push({
              event_id: eventId, 
              guest_name: `${eventName} - ${String(currentMaxTicket).padStart(3, '0')}`, 
              ticket_tier: tier, 
              allowed_capacity: 1,
              email: null, phone: null, 
              ticket_number: currentMaxTicket,
              invitation_status: 'Active', sent_via: 'System'
          });
      }

      const { error } = await supabaseClient.from('guests').insert(batchInserts);
      if (error) {
          alert('Error generating passes: ' + error.message);
      } else {
          alert(`Successfully auto-generated ${countInput} passes!`);
          document.getElementById('autoGenCount').value = '';
          document.getElementById('autoGenerateZone').style.display = 'none';
          fetchAllGuestsForKPIs();
          switchView('guestListsView');
      }
  }


// ==========================================
  // --- GATE MANAGEMENT LOGIC ---
  // ==========================================

  // Global Variables for Gate Routing
  window.currentGateEventFilterId = null;
  window.currentSpecificGateFilterId = null; // 'null' means 'All Gates'
  let currentEditingGateId = null;

  // Handles clicking an Event Pill
  function setGateEventFilter(eventId) {
      window.currentGateEventFilterId = eventId;
      window.currentSpecificGateFilterId = null; // Reset gate specific filter when changing events
      fetchEvents(); // Refresh UI to update pill colors
      loadGateManagementData();
  }

  // Handles clicking a Gate Filter Pill above the table
  function setSpecificGateFilter(gateId, btnElement) {
      window.currentSpecificGateFilterId = gateId;
      // Update UI pill active states
      document.querySelectorAll('#gateSpecificFilters button').forEach(b => b.classList.remove('active'));
      btnElement.classList.add('active');
      loadGateManagementData(); // Re-render table
  }

  // Gate Type UI Selector
  function selectGateTypeUI(type) {
      document.getElementById('newGateType').value = type;
      const bBoth = document.getElementById('gtBtnBoth');
      const bEntry = document.getElementById('gtBtnEntry');
      const bExit = document.getElementById('gtBtnExit');
      
      [bBoth, bEntry, bExit].forEach(b => b.className = 'flex-1 py-2 rounded-lg font-bold border-2 border-transparent bg-gray-100 text-gray-500 text-xs transition');
      
      if (type === 'Both') bBoth.className = 'flex-1 py-2 rounded-lg font-bold border-2 border-purple-500 bg-purple-50 text-purple-700 text-xs transition';
      if (type === 'Entry') bEntry.className = 'flex-1 py-2 rounded-lg font-bold border-2 border-green-500 bg-green-50 text-green-700 text-xs transition';
      if (type === 'Exit') bExit.className = 'flex-1 py-2 rounded-lg font-bold border-2 border-blue-500 bg-blue-50 text-blue-700 text-xs transition';
  }

  function openAddGateModal() {
      currentEditingGateId = null;
      document.getElementById('gateModalTitle').innerText = 'Add New Gate';
      
      // Auto-select the currently viewed event in the modal dropdown
      const modalSelect = document.getElementById('modalGateEventSelect');
      if (window.currentGateEventFilterId) modalSelect.value = window.currentGateEventFilterId;
      
      document.getElementById('newGateName').value = '';
      selectGateTypeUI('Both');
      document.getElementById('addGateModal').classList.remove('hidden');
  }

  function closeAddGateModal() {
      document.getElementById('addGateModal').classList.add('hidden');
  }

  async function saveNewGate() {
      const eventId = document.getElementById('modalGateEventSelect').value;
      const name = document.getElementById('newGateName').value.trim();
      const type = document.getElementById('newGateType').value;

      if (!eventId || !name) return alert("Event and Gate name are required.");

      const payload = {
          tenant_id: currentTenantId,
          event_id: eventId,
          gate_name: name,
          gate_type: type,
          status: 'Active'
      };

      if (currentEditingGateId) {
          const { error } = await supabaseClient.from('gates').update(payload).eq('id', currentEditingGateId);
          if (error) return alert("Error updating gate: " + error.message);
      } else {
          const { error } = await supabaseClient.from('gates').insert([payload]);
          if (error) return alert("Error adding gate: " + error.message);
      }
      
      closeAddGateModal();
      
      // Auto-switch view to the event we just assigned it to
      window.currentGateEventFilterId = eventId;
      fetchEvents();
      loadGateManagementData();
updateRecentGatesWidget(); 
  }


// --- ADD GATEMAN LOGIC ---
  function openAddGatemanModal() {
      const eventId = window.currentGateEventFilterId;
      if (!eventId) return alert("Please select a specific event from the top cards first.");
      
      const assignGateSelect = document.getElementById('assignGateSelect');
      assignGateSelect.innerHTML = '<option value="">Select Gate...</option>';
      
      if (window.currentEventGates && window.currentEventGates.length > 0) {
          window.currentEventGates.forEach(g => {
              assignGateSelect.innerHTML += `<option value="${g.id}">${g.gate_name}</option>`;
          });
      } else {
          return alert("You must create at least one Gate before assigning a Gateman.");
      }

      document.getElementById('newGatemanName').value = '';
      document.getElementById('newGatemanPhone').value = '';
      document.getElementById('newGatemanPin').value = '';
      document.getElementById('addGatemanModal').classList.remove('hidden');
  }

  function closeAddGatemanModal() {
      document.getElementById('addGatemanModal').classList.add('hidden');
  }

  async function saveNewGateman() {
      const name = document.getElementById('newGatemanName').value.trim();
      const phone = document.getElementById('newGatemanPhone').value.trim();
      const pin = document.getElementById('newGatemanPin').value.trim();
      const gateId = document.getElementById('assignGateSelect').value;

      if (!name || !pin || !gateId) return alert("Staff Name, PIN, and Gate assignment are required.");

      const payload = {
          tenant_id: currentTenantId,
          name: name,
          phone: phone,
          access_code: pin,
          assigned_gate_id: gateId
      };

      const { error } = await supabaseClient.from('gatemen').insert([payload]);
      
      if (error) {
          if (error.code === '23505') return alert("Error: That PIN is already in use. Please choose a unique PIN.");
          alert("Error assigning staff: " + error.message);
      } else {
          closeAddGatemanModal();
          loadGateManagementData(); 
      }
  }

  // --- ACTIONS: EDIT, TOGGLE, DELETE ---
  function editGate(id) {
      const gate = window.currentEventGates.find(g => g.id === id);
      if (!gate) return;
      currentEditingGateId = id;
      
      document.getElementById('gateModalTitle').innerText = 'Edit Gate';
      document.getElementById('modalGateEventSelect').value = gate.event_id;
      document.getElementById('newGateName').value = gate.gate_name;
      selectGateTypeUI(gate.gate_type);
      
      document.getElementById('addGateModal').classList.remove('hidden');
  }

  async function toggleGateStatus(id, currentStatus) {
      const newStatus = currentStatus === 'Active' ? 'Closed' : 'Active';
      const { error } = await supabaseClient.from('gates').update({ status: newStatus }).eq('id', id);
      if (error) alert("Error updating status: " + error.message);
      else loadGateManagementData();
  }

  async function deleteGate(id) {
      if(confirm("Are you sure you want to permanently delete this gate? This will also remove assigned staff connections.")) {
          const { error } = await supabaseClient.from('gates').delete().eq('id', id);
          if (error) alert("Error deleting gate: " + error.message);
          else {
              loadGateManagementData();
              updateRecentGatesWidget(); // NEW: Update sidebar when gate is deleted
          }
      }
  }

// --- FETCH RECENT GATES FOR SIDEBAR ---
  async function updateRecentGatesWidget() {
      const recentGatesList = document.getElementById('eventsTabRecentGatesList');
      if (!recentGatesList || !currentTenantId) return;

      const { data: recentGates } = await supabaseClient
          .from('gates')
          .select('*, events(event_name)')
          .eq('tenant_id', currentTenantId)
          .order('created_at', { ascending: false })
          .limit(5);

      recentGatesList.innerHTML = '';
      if (!recentGates || recentGates.length === 0) {
          recentGatesList.innerHTML = '<div style="font-size: 11px; color: var(--color-text-secondary); padding: 4px;">No gates created yet.</div>';
          return;
      }

      recentGates.forEach(g => {
          const dateObj = getSafeDate(g.created_at);
          const timeStr = dateObj.toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' });
          const dateStr = dateObj.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
          const evName = g.events ? g.events.event_name : 'Unknown Event';
          
          let badgeColor = g.gate_type === 'Entry' ? 'var(--color-success)' : (g.gate_type === 'Exit' ? 'var(--color-info)' : 'var(--color-primary)');
          let badgeBg = g.gate_type === 'Entry' ? 'var(--color-success-soft)' : (g.gate_type === 'Exit' ? 'var(--color-info-soft)' : 'var(--color-primary-soft)');

          recentGatesList.innerHTML += `
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--color-border); padding-bottom: 12px;">
                <div>
                  <div style="font-size: 12px; font-weight: 600;">${g.gate_name}</div>
                  <div style="font-size: 11px; color: var(--color-text-secondary); margin-top: 2px;">${evName} · <span style="font-size: 9px; font-weight: 700; color: ${badgeColor}; background: ${badgeBg}; padding: 2px 6px; border-radius: 4px;">${g.gate_type}</span></div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size: 11px;">${timeStr}</div>
                  <div style="font-size: 11px; color: var(--color-text-secondary);">${dateStr}</div>
                </div>
              </div>
          `;
      });
  }


  // --- FETCH & RENDER DATA ---
  async function loadGateManagementData() {
      // NEW FIX: Safety Guard to prevent 400 Bad Request Crash!
      if (!currentTenantId) return; 
      
      const eventId = window.currentGateEventFilterId;
      const tbody = document.getElementById('gateManagementTableBody');
      const filterCont = document.getElementById('gateSpecificFilters');

      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--color-text-secondary);">Loading gates...</td></tr>';

      // 1. Fetch Gates (If eventId is null, fetch ALL gates for this tenant)
      let gateQuery = supabaseClient.from('gates').select('*');
      if (eventId) {
          gateQuery = gateQuery.eq('event_id', eventId);
      } else {
          gateQuery = gateQuery.eq('tenant_id', currentTenantId);
      }

      const { data: gates, error: gatesError } = await gateQuery;

      if (gatesError) return console.error(gatesError);
      window.currentEventGates = gates || [];

      // Render Gate Filter Pills above table
      let filterHtml = `<button onclick="setSpecificGateFilter(null, this)" class="btn-filter-nav ${window.currentSpecificGateFilterId === null ? 'active' : ''}" style="font-size: 11px;">${window.t('filter_all_gates', 'All Gates')}</button>`;
      gates.forEach(g => {
          const isActive = window.currentSpecificGateFilterId === g.id ? 'active' : '';
          filterHtml += `<button onclick="setSpecificGateFilter('${g.id}', this)" class="btn-filter-nav ${isActive}" style="font-size: 11px;">${g.gate_name}</button>`;
      });
      filterCont.innerHTML = filterHtml;

      // Filter Gates for Table Display
      let displayGates = gates;
      if (window.currentSpecificGateFilterId) {
          displayGates = gates.filter(g => g.id === window.currentSpecificGateFilterId);
      }

      // 2. Fetch Gatemen & Scan Logs for the active gates
      const gateIds = gates.map(g => g.id);
      let staff = [];
      let logs = [];
      if (gateIds.length > 0) {
          const [staffRes, logRes] = await Promise.all([
              supabaseClient.from('gatemen').select('*').in('assigned_gate_id', gateIds),
              supabaseClient.from('scan_logs').select('*, guests(guest_name)').in('gate_id', gateIds)
          ]);
          staff = staffRes.data || [];
          logs = logRes.data || [];
      }

      // KPI Variables
      let grandTotalEntries = 0;
      let grandTotalExits = 0;
      let grandTotalScans = logs.length;

      // Render the table
      tbody.innerHTML = '';
      if (displayGates.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--color-text-secondary);">No gates found for this filter.</td></tr>';
      } else {
          displayGates.forEach(g => {
              const assignedStaff = staff.filter(s => s.assigned_gate_id === g.id);
              const gateLogs = logs.filter(l => l.gate_id === g.id);
              
              let entries = 0; let exits = 0;
              gateLogs.forEach(l => {
                  if (l.scan_type === 'Entry') entries++;
                  if (l.scan_type === 'Exit') exits++;
              });
              
              grandTotalEntries += entries;
              grandTotalExits += exits;
              const inside = entries - exits;

              let staffHtml = '<span style="color: var(--color-text-muted); font-size: 11px;">Unassigned</span>';
              if (assignedStaff.length > 0) {
                  staffHtml = assignedStaff.map(s => `
                      <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                          <div style="width:24px; height:24px; border-radius:50%; background:var(--color-primary-soft); color:var(--color-primary); font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center;">${s.name.charAt(0)}</div>
                          <div>
                              <div style="font-size:12px; font-weight:600;">${s.name}</div>
                              <div style="font-size:10px; color:var(--color-text-secondary);">PIN: ${s.access_code}</div>
                          </div>
                      </div>
                  `).join('');
              }

              const statusBadge = g.status === 'Active' 
                  ? `<span style="padding:4px 10px; border-radius:99px; background:var(--color-success-soft); color:var(--color-success); font-size:11px; font-weight:600;">Active</span>`
                  : `<span style="padding:4px 10px; border-radius:99px; background:var(--color-danger-soft); color:var(--color-danger); font-size:11px; font-weight:600;">Inactive</span>`;
              
              const eyeIcon = g.status === 'Active' 
                  ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
                  : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

              // --- DRILL DOWN DATA GENERATION FOR GATES ---
              const sortedGateLogs = gateLogs.sort((a,b) => new Date(b.scanned_at) - new Date(a.scanned_at));
              let logsHtml = sortedGateLogs.length === 0 
                  ? '<div style="font-size:11px; color:var(--color-text-secondary); padding: 4px;">No scan records at this gate yet.</div>' 
                  : sortedGateLogs.map(l => {
                      const time = new Date(l.scanned_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                      const color = l.scan_type === 'Entry' ? 'var(--color-success)' : 'var(--color-info)';
                      const gName = l.guests?.guest_name || 'Unknown Guest';
                      return `<div style="border-left: 3px solid ${color}; padding-left: 10px; min-width: 140px; background: var(--color-bg); padding: 8px 10px; border-radius: 4px; border: 1px solid var(--color-border); flex-shrink: 0;">
                          <div style="font-size:11px; font-weight:700; color:${color}; margin-bottom: 2px;">${l.scan_type.toUpperCase()} • ${time}</div>
                          <div style="font-size:12px; font-weight:600; color: var(--color-text);">${gName}</div>
                      </div>`;
                  }).join('');

              tbody.innerHTML += `
                  <tr onclick="toggleDrilldown('drilldown-gate-${g.id}', event)" style="cursor:pointer; border-bottom: 1px solid var(--color-border); transition: background 0.2s; ${g.status === 'Closed' ? 'opacity: 0.6;' : ''}" onmouseover="this.style.background='var(--color-surface-soft)'" onmouseout="this.style.background='transparent'">
                      <td style="padding: 14px 20px;">
                          <div style="font-weight: 600; font-size: 13px;">${g.gate_name}</div>
                          <div style="font-size: 10px; color: var(--color-text-secondary); font-family: monospace;">ID: ${g.id.substring(0,8)}</div>
                      </td>
                      <td style="padding: 14px 20px;"><div style="font-size: 12px; font-weight: 500;">${g.gate_type}</div></td>
                      <td style="padding: 14px 20px;">${staffHtml}</td>
                      <td style="padding: 14px 20px;">${statusBadge}</td>
                      <td style="padding: 14px 20px; font-weight: 600;">${entries} <span style="font-size:9px; color:var(--color-success);">&uarr;</span></td>
                      <td style="padding: 14px 20px; font-weight: 600;">${exits} <span style="font-size:9px; color:var(--color-info);">&darr;</span></td>
                      <td style="padding: 14px 20px; font-weight: 700; color: #B4790C;">${inside}</td>
                      <td style="padding: 14px 20px;">
                          <div style="display:flex; gap:6px;">
                              <button onclick="toggleGateStatus('${g.id}', '${g.status}')" style="padding:6px; background:var(--color-bg); border-radius:6px; border:1px solid var(--color-border); color:var(--color-text-secondary); cursor:pointer;" title="Toggle Active/Inactive">${eyeIcon}</button>
                              <button onclick="editGate('${g.id}')" style="padding:6px; background:var(--color-bg); border-radius:6px; border:1px solid var(--color-border); color:var(--color-info); cursor:pointer;" title="Edit Gate"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg></button>
                              <button onclick="deleteGate('${g.id}')" style="padding:6px; background:var(--color-bg); border-radius:6px; border:1px solid var(--color-danger-soft); color:var(--color-danger); cursor:pointer;" title="Delete Gate"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                          </div>
                      </td>
                  </tr>
                  <tr id="drilldown-gate-${g.id}" class="drilldown-row" style="display:none; background: var(--color-surface-soft);">
                    <td colspan="8" style="padding: 12px 20px; border-bottom: 1px solid var(--color-border);">
                      <div style="display:flex; gap:12px; overflow-x:auto; padding-bottom:4px;" class="no-scrollbar">
                         ${logsHtml}
                      </div>
                    </td>
                  </tr>
              `;
          });
      }

      // 3. Update the Top KPI Cards
      const kpiTotalGates = document.getElementById('kpiTotalGates');
      const kpiTotalEntries = document.getElementById('kpiTotalEntries');
      const kpiTotalExits = document.getElementById('kpiTotalExits');
      const kpiCurrentlyInside = document.getElementById('kpiCurrentlyInside');
      const kpiTotalScanned = document.getElementById('kpiTotalScanned');

      if (kpiTotalGates) kpiTotalGates.innerText = displayGates.length;
      if (kpiTotalEntries) kpiTotalEntries.innerText = grandTotalEntries;
      if (kpiTotalExits) kpiTotalExits.innerText = grandTotalExits;
      if (kpiCurrentlyInside) kpiCurrentlyInside.innerText = grandTotalEntries - grandTotalExits;
      if (kpiTotalScanned) kpiTotalScanned.innerText = grandTotalScans;
  }


// --- MOUSE DRAG TO SCROLL (For Horizontal Pills & Filters) ---
  document.addEventListener('DOMContentLoaded', () => {
      const scrollContainers = document.querySelectorAll('.no-scrollbar');
      scrollContainers.forEach(ele => {
          let isDown = false;
          let startX;
          let scrollLeft;
          
          ele.addEventListener('mousedown', (e) => {
              // FIX: Allow sliders to be clicked and dragged without moving the container!
              if (e.target.tagName.toLowerCase() === 'input') return; 
              
              isDown = true;
              startX = e.pageX - ele.offsetLeft;
              scrollLeft = ele.scrollLeft;
              ele.style.cursor = 'grabbing';
          });
          
          ele.addEventListener('mouseleave', () => { isDown = false; ele.style.cursor = 'pointer'; });
          ele.addEventListener('mouseup', () => { isDown = false; ele.style.cursor = 'pointer'; });
          
          ele.addEventListener('mousemove', (e) => {
              if (!isDown) return;
              e.preventDefault();
              const x = e.pageX - ele.offsetLeft;
              const walk = (x - startX) * 1.5; // Scroll speed
              ele.scrollLeft = scrollLeft - walk;
          });
      });
  });


// --- ADD GUEST: SMART DYNAMIC GATE DROPDOWNS ---
  document.addEventListener('DOMContentLoaded', () => {
      const addGuestEventSelect = document.getElementById('addGuestEventSelect');
      if (addGuestEventSelect) {
          addGuestEventSelect.addEventListener('change', async (e) => {
              const evId = e.target.value;
              const enGate = document.getElementById('agEntryGateSelect');
              const exGate = document.getElementById('agExitGateSelect');
              
              if(enGate) enGate.innerHTML = '<option value="">Any Gate Allowed</option>';
              if(exGate) exGate.innerHTML = '<option value="">Any Gate Allowed</option>';

              // --- NEW: LIVE CAPACITY UI & WARNING BANNERS ---
              const submitBtn = document.getElementById('submitAddGuestBtn');
              let banner = document.getElementById('guestLimitWarningBanner');
              
              // Create the red banner if it doesn't exist yet
              if (!banner) {
                  banner = document.createElement('div');
                  banner.id = 'guestLimitWarningBanner';
                  banner.className = 'bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg text-xs font-bold mb-4 hidden';
                  const singleGuestZone = document.getElementById('singleGuestZone');
                  if (singleGuestZone && singleGuestZone.parentElement) {
                      singleGuestZone.parentElement.prepend(banner);
                  }
              }

              if(!evId) {
                  // Reset Side Panel if no event is selected
                  if(document.getElementById('agCurrentGuests')) document.getElementById('agCurrentGuests').innerText = '0';
                  if(document.getElementById('agMaxGuests')) document.getElementById('agMaxGuests').innerText = '0';
                  if(document.getElementById('agStatAdded')) document.getElementById('agStatAdded').innerText = '0';
                  if(document.getElementById('agStatRemain')) document.getElementById('agStatRemain').innerText = '0';
                  if(document.getElementById('agStatTotal')) document.getElementById('agStatTotal').innerText = '0';
                  if(submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; submitBtn.style.cursor = 'pointer'; }
                  if(banner) banner.classList.add('hidden');
                  return;
              }

              // Calculate current guests for THIS specific event
              const maxGuestsLimit = window.activeMaxGuests || 50; // Fallback to 50 if missing
              const currentEventGuests = allFetchedGuests.filter(g => g.event_id === evId).length;
              const remaining = Math.max(0, maxGuestsLimit - currentEventGuests);

              // Update the Side Panel UI Live!
              if(document.getElementById('agCurrentGuests')) document.getElementById('agCurrentGuests').innerText = currentEventGuests;
              if(document.getElementById('agMaxGuests')) document.getElementById('agMaxGuests').innerText = maxGuestsLimit;
              if(document.getElementById('agStatAdded')) document.getElementById('agStatAdded').innerText = currentEventGuests;
              if(document.getElementById('agStatRemain')) document.getElementById('agStatRemain').innerText = remaining;
              if(document.getElementById('agStatTotal')) document.getElementById('agStatTotal').innerText = currentEventGuests;
              if(document.getElementById('agLimitGuest')) document.getElementById('agLimitGuest').innerText = maxGuestsLimit;

              // LOCK UI IF FULL
              if (currentEventGuests >= maxGuestsLimit && !currentEditGuestId) {
                  banner.innerHTML = `${window.t('warn_guest_limit', '⚠️ LIMIT REACHED: This event has hit your plan limit of')} ${maxGuestsLimit} ${window.t('warn_guest_limit_2', 'guests. You cannot add more.')}`;
                  banner.classList.remove('hidden');
                  if(submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.5'; submitBtn.style.cursor = 'not-allowed'; }
              } else {
                  banner.classList.add('hidden');
                  if(submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; submitBtn.style.cursor = 'pointer'; }
              }

              // Fetching gate_type to apply smart filters
              const { data: gates } = await supabaseClient.from('gates').select('id, gate_name, gate_type').eq('event_id', evId);
              
              if(gates) {
                  gates.forEach(g => {
                      // Only show 'Entry' or 'Both' in the Entry Dropdown
                      if(enGate && (g.gate_type === 'Entry' || g.gate_type === 'Both')) {
                          enGate.innerHTML += `<option value="${g.id}">${g.gate_name}</option>`;
                      }
                      // Only show 'Exit' or 'Both' in the Exit Dropdown
                      if(exGate && (g.gate_type === 'Exit' || g.gate_type === 'Both')) {
                          exGate.innerHTML += `<option value="${g.id}">${g.gate_name}</option>`;
                      }
                  });
              }
          });
      }
  });

  // --- DRILL-DOWN ROW TOGGLE LOGIC ---
  function toggleDrilldown(rowId, event) {
      // Ignore clicks on buttons inside the row
      if(event.target.closest('button') || event.target.closest('svg') || event.target.closest('.table-avatar')) return;
      
      const targetRow = document.getElementById(rowId);
      const isCurrentlyOpen = targetRow.style.display === 'table-row';

      // 1. Close ALL open drill-down rows first
      document.querySelectorAll('.drilldown-row').forEach(row => {
          row.style.display = 'none';
      });

      // 2. Open the clicked one if it wasn't already open
      if (!isCurrentlyOpen) {
          targetRow.style.display = 'table-row';
      }
  }

  // --- CLICK OUTSIDE TO CLOSE ---
  document.addEventListener('click', (e) => {
      // If click is outside any data table, close all drill-downs
      if (!e.target.closest('.data-table')) {
          document.querySelectorAll('.drilldown-row').forEach(row => {
              row.style.display = 'none';
          });
      }
  });
// --- COLLAPSE TOOLS ON OUTSIDE CLICK (MOBILE) ---
  document.addEventListener('click', (e) => {
      if (window.innerWidth > 768) return; // Only apply this behavior on mobile screens
      
      // Check if the click happened inside the text tools or QR tools
      const isAaClick = e.target.closest('#btnToggleAa') || e.target.closest('.text-expanded-panel') || e.target.closest('.text-format-mobile-row');
      const isQrClick = e.target.closest('#btnToggleQR') || e.target.closest('.qr-expanded-panel') || e.target.closest('.qr-mobile-row');
      
      // If clicking completely outside both tool groups (like on the canvas or background), collapse them!
      if (!isAaClick && !isQrClick) {
          const txtPanel = document.querySelector('.text-expanded-panel');
          const qrPanel = document.querySelector('.qr-expanded-panel');
          if(txtPanel) txtPanel.classList.add('mobile-hidden');
          if(qrPanel) qrPanel.classList.add('mobile-hidden');
      }
  });


// ==========================================
  // --- SMART NOTIFICATION ENGINE (UPDATED) ---
  // ==========================================

  async function toggleNotifications() {
      const dropdown = document.getElementById('notificationDropdown');
      if (!dropdown) return;
      
      if (dropdown.style.display === 'none' || dropdown.classList.contains('hidden')) {
          // LIVE UPDATE: Fetch latest data securely from Supabase right before opening!
          if (currentTenantId) {
              const { data: evData } = await supabaseClient.from('events').select('*').eq('tenant_id', currentTenantId);
              if (evData) allFetchedEvents = evData;
              
              const { data: tplData } = await supabaseClient.from('templates').select('*').or(`tenant_id.eq.${currentTenantId},is_global.eq.true`);
              if (tplData) windowSavedTemplates = tplData;
              
              generateNotifications(); // Re-calculate warnings with the fresh data
          }
          
          dropdown.style.display = 'flex';
          dropdown.classList.remove('hidden');
      } else {
          dropdown.style.display = 'none';
      }
  }
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('notificationDropdown');
      const bell = document.getElementById('notificationBellBtn');
      if (dropdown && dropdown.style.display !== 'none' && !dropdown.contains(e.target) && !bell.contains(e.target)) {
          dropdown.style.display = 'none';
      }
  });

// Persistent Notification Memory System
  function addPersistentNotification(title, desc, icon, color, bg) {
      if (!currentTenantId) return;
      let history = JSON.parse(localStorage.getItem('qrg_notifs_' + currentTenantId) || '[]');
      history.unshift({ title, desc, icon, color, bg, time: new Date().getTime(), id: Date.now() });
      if (history.length > 20) history = history.slice(0, 20); // Keep last 20 so memory doesn't bloat
      localStorage.setItem('qrg_notifs_' + currentTenantId, JSON.stringify(history));
      generateNotifications();
  }

  function clearAllNotifications() {
      if (currentTenantId) localStorage.removeItem('qrg_notifs_' + currentTenantId);
      document.getElementById('notificationBadge').style.display = 'none';
      document.getElementById('notificationDropdown').style.display = 'none';
      generateNotifications();
  } 


 function generateNotifications() {
      const list = document.getElementById('notificationList');
      const badge = document.getElementById('notificationBadge');
      const countText = document.getElementById('notificationCountText');
      if (!list || !badge) return;

      let notifications = [];
      const now = new Date();
      
      // 1. Scan Events
      if (typeof allFetchedEvents !== 'undefined') {
          allFetchedEvents.forEach(e => {
              const createdDate = new Date(e.created_at);
              const daysSinceCreation = (now - createdDate) / (1000 * 60 * 60 * 24);
              
              // Event Tomorrow Check
              const evDateStr = e.event_date ? e.event_date.split('T')[0] : null;
              if (evDateStr) {
                  const evDate = new Date(evDateStr);
                  const daysUntil = (evDate - now) / (1000 * 60 * 60 * 24);
                  if (daysUntil > 0 && daysUntil <= 1.5) { 
                      notifications.push({
                          title: 'Event Tomorrow!', desc: `"${e.event_name}" is happening tomorrow. Ensure your gates are ready.`,
                          time: now, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
                          color: '#B4790C', bg: '#FEF6E2',
                          action: `switchView('eventsView'); document.getElementById('notificationDropdown').style.display='none';`
                      });
                  }
              }
              
              // Approved Recently
              if (e.is_approved && daysSinceCreation <= 5) {
                  notifications.push({
                      title: 'Event Approved', desc: `Super Admin approved "${e.event_name}".`,
                      time: createdDate, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
                      color: 'var(--color-success)', bg: 'var(--color-success-soft)',
                      action: `switchView('eventsView'); document.getElementById('notificationDropdown').style.display='none';`
                  });
              } else if (!e.is_approved && daysSinceCreation <= 3) {
                  notifications.push({
                      title: 'New Event Pending', desc: `You added "${e.event_name}". Awaiting admin approval.`,
                      time: createdDate, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>',
                      color: 'var(--color-info)', bg: 'var(--color-info-soft)',
                      action: `switchView('createManageView'); document.getElementById('notificationDropdown').style.display='none';`
                  });
              }
          });
      }
      
      // 2. Scan Global Templates
      if (typeof windowSavedTemplates !== 'undefined') {
          windowSavedTemplates.forEach(t => {
              if (t.is_global) {
                  const createdDate = new Date(t.created_at);
                  const daysSinceCreation = (now - createdDate) / (1000 * 60 * 60 * 24);
                  if (daysSinceCreation <= 14) { 
                      notifications.push({
                          title: 'New Global Template', desc: `Admin added "${t.name}". Check Design Templates!`,
                          time: createdDate, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>',
                          color: 'var(--color-primary)', bg: 'var(--color-primary-soft)',
                          action: `switchView('designTemplatesView'); handleTopGalleryClick('${t.id}'); document.getElementById('notificationDropdown').style.display='none';`
                      });
                  }
              }
          });
      }

      // --- NEW: Add Persistent Memory History (Approvals & Plan Changes) ---
      if (currentTenantId) {
          let history = JSON.parse(localStorage.getItem('qrg_notifs_' + currentTenantId) || '[]');
          history.forEach(h => {
              notifications.push({
                  title: h.title, desc: h.desc,
                  time: new Date(h.time), icon: h.icon,
                  color: h.color, bg: h.bg,
                  action: `document.getElementById('notificationDropdown').style.display='none';`
              });
          });
      }

      // Sort by newest first
      notifications.sort((a,b) => b.time - a.time);
      
      // Render to DOM
      list.innerHTML = '';
      if (notifications.length === 0) {
          list.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--color-text-secondary); font-size: 12px;">You are all caught up!</div>';
          badge.style.display = 'none';
          countText.innerText = '0 New';
      } else {
          badge.style.display = 'flex';
          badge.innerText = notifications.length > 9 ? '9+' : notifications.length;
          countText.innerText = `${notifications.length} New`;
          
          notifications.slice(0, 8).forEach(n => {
              let timeStr = "Recently";
              const diffMins = Math.round((now - n.time) / 60000);
              if (diffMins < 60) timeStr = diffMins + 'm ago';
              else if (diffMins < 1440) timeStr = Math.floor(diffMins/60) + 'h ago';
              else timeStr = Math.floor(diffMins/1440) + 'd ago';
              if (n.title === 'Event Tomorrow!') timeStr = 'Just now'; 

              list.innerHTML += `
                <div onclick="${n.action}" style="display: flex; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--color-border); transition: background 0.2s; cursor: pointer;" onmouseover="this.style.background='var(--color-surface-soft)'" onmouseout="this.style.background='transparent'">
                   <div style="width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: ${n.bg}; color: ${n.color}; flex-shrink: 0; margin-top: 2px;">${n.icon}</div>
                   <div style="flex: 1;">
                     <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                       <span style="font-size: 12px; font-weight: 700; color: var(--color-text);">${n.title}</span>
                       <span style="font-size: 9px; font-weight: 600; color: var(--color-text-secondary);">${timeStr}</span>
                     </div>
                     <p style="font-size: 11px; color: var(--color-text-secondary); margin: 0; line-height: 1.4;">${n.desc}</p>
                   </div>
                </div>
              `;
          });
      }
  }

// ==========================================
  // --- TICKET SHARING & DOWNLOADING LOGIC ---
  // ==========================================

  // Helper to safely escape quotes for inline HTML (Kept for your other UI elements!)
  function escapeHTML(str) {
      if (!str) return '';
      return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  // 1. Download as Image or PDF (Fixed Cropping & Syntax Errors!)
  async function downloadTicketFile(encodedGuestName, encodedEventName, format) {
      // Decode the names safely back into normal text
      const guestName = decodeURIComponent(encodedGuestName);
      const eventName = decodeURIComponent(encodedEventName);
      
      const container = document.getElementById('ticketContainer');
      
      // Temporarily remove transforms, overflow, and radius for a perfect capture
      const originalTransform = container.style.transform;
      const originalOverflow = container.style.overflow;
      const originalRadius = container.style.borderRadius;
      
      container.style.transform = "none";
      container.style.overflow = "visible";
      container.style.borderRadius = "0px"; 
      
      try {
          const canvas = await html2canvas(container, {
              scale: 2, 
              useCORS: true, 
              backgroundColor: '#ffffff', // Force white background
              logging: false
          });

          if (format === 'png') {
              const link = document.createElement('a');
              link.download = `${guestName} - ${eventName} Pass.png`;
              link.href = canvas.toDataURL('image/png');
              link.click();
          } 
          else if (format === 'pdf') {
              const { jsPDF } = window.jspdf;
              const imgData = canvas.toDataURL('image/png');
              const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width / 2, canvas.height / 2] });
              pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
              pdf.save(`${guestName} - ${eventName} Pass.pdf`);
          }
      } catch (err) {
          console.error("Error generating file:", err);
          alert("Failed to generate file. Please try again.");
      } finally {
          // Restore exact original styling
          container.style.transform = originalTransform; 
          container.style.overflow = originalOverflow;
          container.style.borderRadius = originalRadius;
      }
  }

  // 2. Share via WhatsApp
  function shareToWhatsApp(guestId, encodedPhone, encodedGuestName, encodedEventName, ticketNumber) {
      const phone = decodeURIComponent(encodedPhone);
      const guestName = decodeURIComponent(encodedGuestName);
      const eventName = decodeURIComponent(encodedEventName);

      if (!phone || phone.trim() === '' || phone === 'No phone provided') return alert("This guest does not have a valid phone number saved.");
      
      const cleanPhone = phone.replace(/[^\d+]/g, '');
      const qrId = 'QR-' + String(ticketNumber).padStart(3, '0');
      const publicTicketLink = `https://digidatas.github.io/QRGate/view-pass.html?id=${guestId}`;
      const message = `Hello ${guestName},%0A%0AHere is your official Gate Pass for *${eventName}*.%0A%0AYour Ticket ID is: *${qrId}*%0A%0AView your digital pass here:%0A${publicTicketLink}`;
      
      // Opens instantly without browser blocking!
      window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
      
      // Fire-and-forget DB update so it doesn't delay the popup
      supabaseClient.from('guests').update({ invitation_status: 'Sent' }).eq('id', guestId).then(() => fetchEvents());
  }

  // 3. Share via Email
  function shareToEmail(guestId, encodedEmail, encodedGuestName, encodedEventName, ticketNumber) {
      const email = decodeURIComponent(encodedEmail);
      const guestName = decodeURIComponent(encodedGuestName);
      const eventName = decodeURIComponent(encodedEventName);

      if (!email || email.trim() === '' || email === 'No email provided') return alert("This guest does not have a valid email address saved.");
      
      const qrId = 'QR-' + String(ticketNumber).padStart(3, '0');
      const subject = encodeURIComponent(`Your Gate Pass for ${eventName}`);
      const publicTicketLink = `https://digidatas.github.io/QRGate/view-pass.html?id=${guestId}`;
      const body = encodeURIComponent(`Hello ${guestName},\n\nHere is your official Gate Pass for ${eventName}.\n\nYour Ticket ID is: ${qrId}\n\nView your digital pass here:\n${publicTicketLink}\n\nPlease present this at the entry gate.\n\nBest regards,\nEvent Management`);
      
      window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
      
      supabaseClient.from('guests').update({ invitation_status: 'Sent' }).eq('id', guestId).then(() => fetchEvents());
  }


// ==========================================
  // --- LIVE REALTIME TENANT ENGINE ---
  // ==========================================
  
  // Custom Live Toast Alert (Pops up in the bottom right)
  function showLiveToast(title, message) {
      const toast = document.createElement('div');
      toast.style.cssText = `position: fixed; bottom: -100px; right: 24px; background: #111827; border: 1px solid var(--color-primary); color: white; padding: 16px 24px; border-radius: var(--radius-md); box-shadow: 0 10px 25px rgba(124, 58, 237, 0.3); z-index: 10000; transition: bottom 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); display: flex; flex-direction: column; gap: 4px;`;
      toast.innerHTML = `<div style="font-weight: 800; font-size: 14px; color: var(--color-primary-soft);">${title}</div><div style="font-size: 12px; color: var(--color-text-muted);">${message}</div>`;
      
      document.body.appendChild(toast);
      
      // Slide in
      setTimeout(() => { toast.style.bottom = '24px'; }, 100);
      
      // Slide out and destroy after 5 seconds
      setTimeout(() => {
          toast.style.bottom = '-100px';
          setTimeout(() => toast.remove(), 400);
      }, 5000);
  }

  function startTenantRealtimeEngine() {
      if (!currentTenantId) return;

      supabaseClient.channel('tenant-dashboard-sync')
          // 1. LISTEN FOR ADMIN UPGRADES
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tenants', filter: `id=eq.${currentTenantId}` }, async (payload) => {
              const newPlan = payload.new.subscription_status;
              const isApproved = payload.new.account_status === 'Approved';
              
              let planChanged = newPlan !== window.currentPlanTier;
              let approvalChanged = isApproved !== (window.currentAccountStatus === 'Approved');

              if (planChanged || approvalChanged) {
                  const { data: { session } } = await supabaseClient.auth.getSession();
                  await checkTenantProfile(session); // Instantly updates UI Locks & Limits Cards
                  
                  if (planChanged) {
                      showLiveToast('Plan Updated!', `Your account is now on the ${newPlan} plan!`);
                      addPersistentNotification('Plan Updated', `Your account is now on the ${newPlan} plan.`, '⭐', 'var(--color-primary)', 'var(--color-primary-soft)');
                  }
                  if (approvalChanged && isApproved) {
                      showLiveToast('Account Approved!', `Your organizer account has been approved!`);
                      addPersistentNotification('Account Approved', `Your organizer account has been officially approved.`, '✅', 'var(--color-success)', 'var(--color-success-soft)');
                  }
              }
          })
          // 2. LISTEN FOR EVENT APPROVALS
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `tenant_id=eq.${currentTenantId}` }, (payload) => {
              if (payload.new.is_approved && payload.old && !payload.old.is_approved) {
                  fetchEvents(); // Instantly turns tags green and unlocks QR passes
                  showLiveToast('Event Approved!', `Your event "${payload.new.event_name}" is now live!`);
                  addPersistentNotification('Event Approved', `Your event "${payload.new.event_name}" is now live!`, '📅', 'var(--color-success)', 'var(--color-success-soft)');
              }
          })
          // 3. LISTEN FOR LIVE GATE SCANS
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scan_logs' }, (payload) => {
              if (allFetchedEvents.some(e => e.id === payload.new.event_id)) {
                  console.log("Live Scan Detected at Gate!");
                  fetchAllGuestsForKPIs();
                  loadGateManagementData();
              }
          })
          .subscribe();
  }

  // Start the Live Engine 2 seconds after the page loads
  setTimeout(startTenantRealtimeEngine, 2000);

  
  // Ensure this remains last
  init();