// app.js
import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { convertDriveUrl, convertDriveVideoUrl, navigateTo } from "./utils.js";
import { fetchUserPortfolio, initUploadEngine, openProfileModal } from "./dashboard.js";
import { fetchAdminPendingWorks } from "./admin.js";

let allPortfolios = [];
let cachedUsers = {}; // แคชข้อมูลเพื่อความเร็วและลดการดึงซ้ำ
let currentUser = null;
let userData = null;
let authMode = "login";
let activeCommentUnsubscribe = null; 
let currentReplyParentId = null; 

window.currentUser = null;
window.filterGalleryByCategory = filterGalleryByCategory;
window.navigateTo = navigateTo;
window.openCreatorPopupModal = openCreatorPopupModal; 

// Helper สำหรับแปลงลิงก์ Social
function extractSocialUsername(url, platform) {
    if (!url || url.trim() === "") return "-";
    try {
        let cleaned = url.trim().replace(/\/$/, "");
        const urlObj = new URL(cleaned.startsWith("http") ? cleaned : `https://${cleaned}`);
        let pathname = urlObj.pathname;
        
        if (platform === "instagram" || platform === "tiktok") {
            let parts = pathname.split("/").filter(p => p);
            if (parts.length > 0) return parts[0].startsWith("@") ? parts[0] : `@${parts[0]}`;
        }
        if (platform === "facebook") {
            let parts = pathname.split("/").filter(p => p && p !== "profile.php");
            if (parts.length > 0) return parts[0];
        }
        return "เปิดลิงก์";
    } catch (e) {
        return "เปิดลิงก์";
    }
}

// โหลดฐานข้อมูล User เก็บไว้ใน Cache เผื่อดึงชื่อทันที
async function prefetchAllUsers() {
    try {
        const snap = await getDocs(collection(db, "users"));
        snap.forEach(docSnap => {
            cachedUsers[docSnap.id] = docSnap.data();
        });
    } catch (e) {
        console.error("Error prefetching users:", e);
    }
}

// 🔴 แก้ไข: ฟังก์ชันแสดงป๊อปอัปโปรไฟล์ดึงชื่อที่ถูกต้อง
async function openCreatorPopupModal(e, ownerId) {
    e.stopPropagation(); // กันไม่ให้หลุดไปคลิกเปิดหน้าดีเทลงานซ้อนกัน
    
    let targetUser = cachedUsers[ownerId];
    // ถ้าไม่มีใน Cache ให้ดึงตรงจาก Firestore ณ ตอนนั้น
    if (!targetUser) {
        const uDoc = await getDoc(doc(db, "users", ownerId));
        if (uDoc.exists()) {
            targetUser = uDoc.data();
            cachedUsers[ownerId] = targetUser; // เก็บเข้าแคชไว้คราวหน้า
        }
    }
    
    // ตั้งค่าแสดงชื่อ (ตรวจสอบเผื่อระบบเก็บเป็น name หรือ username หรือ fallback เป็น email)
    let displayName = "ไม่ระบุชื่อ";
    if (targetUser) {
        displayName = targetUser.name || targetUser.username || (targetUser.email ? targetUser.email.split('@')[0] : "Creator");
    }

    // อัปเดตข้อมูลลง UI ของ Pop-up
    document.getElementById("pop-creator-name").innerText = displayName;
    document.getElementById("pop-phone").innerText = (targetUser && targetUser.phone) ? targetUser.phone : "-";
    document.getElementById("pop-line").innerText = (targetUser && targetUser.line) ? targetUser.line : "-";
    document.getElementById("pop-other").innerText = (targetUser && targetUser.other) ? targetUser.other : "-";

    const avatarBox = document.getElementById("pop-creator-avatar");
    if (avatarBox) {
        if (targetUser && targetUser.avatar) {
            avatarBox.innerHTML = `<img src="${convertDriveUrl(targetUser.avatar)}" class="w-full h-full object-cover">`;
        } else {
            avatarBox.innerHTML = "👤";
        }
    }

    // ผูกลิงก์ช่องทางโซเชียลมีเดียต่างๆ
    const fbBtn = document.getElementById("pop-fb");
    const igBtn = document.getElementById("pop-ig");
    const ttBtn = document.getElementById("pop-tt");

    if (targetUser && targetUser.facebook) { fbBtn.href = targetUser.facebook; fbBtn.innerText = extractSocialUsername(targetUser.facebook, "facebook"); fbBtn.className = "p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 truncate block"; }
    else { fbBtn.href = "#"; fbBtn.innerText = "-"; fbBtn.className = "p-1.5 rounded-lg bg-neutral-900 text-neutral-600 border border-white/5 pointer-events-none truncate block"; }

    if (targetUser && targetUser.instagram) { igBtn.href = targetUser.instagram; igBtn.innerText = extractSocialUsername(targetUser.instagram, "instagram"); igBtn.className = "p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 truncate block"; }
    else { igBtn.href = "#"; igBtn.innerText = "-"; igBtn.className = "p-1.5 rounded-lg bg-neutral-900 text-neutral-600 border border-white/5 pointer-events-none truncate block"; }

    if (targetUser && targetUser.tiktok) { ttBtn.href = targetUser.tiktok; ttBtn.innerText = extractSocialUsername(targetUser.tiktok, "tiktok"); ttBtn.className = "p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 truncate block"; }
    else { ttBtn.href = "#"; ttBtn.innerText = "-"; ttBtn.className = "p-1.5 rounded-lg bg-neutral-900 text-neutral-600 border border-white/5 pointer-events-none truncate block"; }

    document.getElementById("modal-creator-popup").classList.remove("hidden");
}

window.toggleCommentMenu = function(e, commentId) {
    e.stopPropagation(); 
    document.querySelectorAll('.comment-menu-dropdown').forEach(el => {
        if (el.id !== `menu-dropdown-${commentId}`) el.classList.add('hidden');
    });
    const dropdown = document.getElementById(`menu-dropdown-${commentId}`);
    if (dropdown) dropdown.classList.toggle('hidden');
};

document.addEventListener("click", () => {
    document.querySelectorAll('.comment-menu-dropdown').forEach(el => el.classList.add('hidden'));
});

window.toggleRepliesVisibility = function(parentId) {
    const el = document.getElementById(`replies-container-${parentId}`);
    const btn = document.getElementById(`btn-toggle-replies-${parentId}`);
    if (el && btn) {
        if (el.classList.contains("hidden")) {
            el.classList.remove("hidden");
            btn.innerText = "🔼 ซ่อนข้อความตอบกลับ";
        } else {
            el.classList.add("hidden");
            btn.innerText = `💬 ดูข้อความตอบกลับเพิ่มเติม...`;
        }
    }
};

window.deleteCommentAction = async function(portfolioId, commentId) {
    if (!confirm("คุณต้องการลบความคิดเห็นนี้ใช่หรือไม่?")) return;
    try {
        await deleteDoc(doc(db, "portfolios", portfolioId, "comments", commentId));
        alert("ลบความคิดเห็นสำเร็จ");
    } catch (err) {
        alert("ไม่สามารถลบได้: " + err.message);
    }
};

onAuthStateChanged(auth, async (user) => {
    const authZone = document.getElementById("navbar-auth-zone");
    await prefetchAllUsers(); 

    if (user) {
        currentUser = user; window.currentUser = user; 
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) { userData = userDoc.data(); } 
        else {
            userData = { name: user.email.split('@')[0], email: user.email, role: "user", phone: "", line: "", facebook: "", instagram: "", tiktok: "", other: "", avatar: user.photoURL || "" };
            await setDoc(doc(db, "users", user.uid), userData);
        }
        
        const usernameDisplay = document.getElementById("profile-username-display");
        if (usernameDisplay) usernameDisplay.innerText = userData.name || userData.username || user.email;
        const avatarContainer = document.getElementById("dashboard-avatar-container");
        if (userData.avatar && avatarContainer) avatarContainer.innerHTML = `<img src="${convertDriveUrl(userData.avatar)}" class="w-full h-full object-cover rounded-full">`;
        
        if (userData.role === "admin") {
            document.getElementById("admin-approval-section")?.classList.remove("hidden");
            fetchAdminPendingWorks();
        } else {
            document.getElementById("admin-approval-section")?.classList.add("hidden");
        }

        if (authZone) {
            authZone.innerHTML = `
                <button id="nav-btn-dash" class="text-xs bg-neutral-900 border border-white/10 hover:bg-neutral-800 text-white font-medium px-4 py-2 rounded-xl transition">พื้นที่ทำงาน</button>
                <button id="nav-btn-logout" class="text-xs text-neutral-400 hover:text-rose-400 transition cursor-pointer">ออกจากระบบ</button>
            `;
            document.getElementById("nav-btn-dash").onclick = () => navigateTo("dashboard");
            document.getElementById("nav-btn-logout").onclick = () => signOut(auth).then(() => location.reload());
        }
        fetchUserPortfolio(currentUser); initUploadEngine(currentUser, userData);   
    } else {
        currentUser = null; window.currentUser = null; userData = null;
        document.getElementById("admin-approval-section")?.classList.add("hidden");
        if (authZone) {
            authZone.innerHTML = `<button id="nav-btn-login" class="text-xs bg-white text-black font-semibold px-4 py-2 rounded-xl hover:bg-neutral-200 transition">เข้าสู่ระบบ</button>`;
            document.getElementById("nav-btn-login").onclick = () => navigateTo("auth");
        }
    }
    fetchAllPortfolios();
});

function fetchAllPortfolios() {
    const q = query(collection(db, "portfolios"), where("status", "==", "approved"));
    onSnapshot(q, (snapshot) => {
        allPortfolios = []; snapshot.forEach(doc => { allPortfolios.push({ id: doc.id, ...doc.data() }); });
        renderGallerySegmented(allPortfolios);
    });
}

function renderGallerySegmented(items) {
    const categories = [
        { id: "Graphic & Photo", gridId: "grid-graphic" },
        { id: "Video Editor", gridId: "grid-video" },
        { id: "Motion / 3D", gridId: "grid-motion" }
    ];

    categories.forEach(cat => {
        const grid = document.getElementById(cat.gridId);
        if (!grid) return;
        grid.innerHTML = "";
        
        const catItems = items.filter(item => item.category === cat.id);
        const limitedItems = catItems.slice(0, 6);

        if (limitedItems.length === 0) {
            grid.innerHTML = `<p class="text-xs text-neutral-600 italic py-6 col-span-full">ยังไม่มีผลงานในหมวดหมู่นี้...</p>`;
            return;
        }

        limitedItems.forEach(item => {
            grid.appendChild(createPortfolioCard(item));
        });
    });
}

function createPortfolioCard(item) {
    const card = document.createElement("div");
    card.className = "premium-card group relative overflow-hidden flex flex-col justify-between cursor-pointer";
    
    const isYouTube = item.image?.toLowerCase().includes("youtube.com") || item.image?.toLowerCase().includes("youtu.be");
    const isVideo = item.category === "Video Editor" || item.category === "Motion / 3D";
    
    let tag = `<img src="${convertDriveUrl(item.image)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-700">`;
    if (isYouTube) {
        let vid = item.image.includes("youtu.be/") ? item.image.split("youtu.be/")[1].split(/[?#]/)[0] : item.image.split("v=")[1]?.split("&")[0];
        tag = `<img src="https://img.youtube.com/vi/${vid}/mqdefault.jpg" class="w-full h-full object-cover">`;
    } else if (isVideo && !item.image.includes("drive.google.com") && (item.image.includes(".mp4") || item.image.includes(".mov"))) {
        tag = `<video src="${item.image}" muted autoplay loop playsinline class="w-full h-full object-cover pointer-events-none"></video>`;
    }
    
    const uData = cachedUsers[item.ownerId];
    const avatarUrl = uData && uData.avatar ? convertDriveUrl(uData.avatar) : "";
    const creatorAvatarHTML = avatarUrl 
        ? `<img src="${avatarUrl}" class="w-5 h-5 rounded-full object-cover border border-white/20">`
        : `<div class="w-5 h-5 rounded-full bg-neutral-800 text-[9px] flex items-center justify-center border border-white/10 text-white">👤</div>`;

    // จัดการชื่อแสดงผลหน้าการ์ดให้ถูกต้องและปลอดภัย
    let finalOwnerName = item.ownerName || "ไม่ระบุชื่อ";
    if (uData) {
        finalOwnerName = uData.name || uData.username || finalOwnerName;
    }
    if (finalOwnerName.length > 20 && finalOwnerName.match(/^[a-zA-Z0-9]+$/)) {
        // หากชื่อยังหลุดเป็น uid ยาวๆ ให้ใช้คำเซฟๆ หรือดึงจากหน้าอีเมล
        if (uData && uData.email) finalOwnerName = uData.email.split('@')[0];
    }

    card.innerHTML = `
        <div class="aspect-video w-full bg-neutral-900 overflow-hidden relative border-b border-white/5">${tag}</div>
        <div class="p-5 flex items-center justify-between space-x-2">
            <div class="truncate flex-grow">
                <h4 class="font-bold text-white text-sm truncate">${item.title}</h4>
                <div onclick="window.openCreatorPopupModal(event, '${item.ownerId}')" class="flex items-center space-x-1.5 mt-1 hover:text-indigo-400 group/author transition max-w-max">
                    ${creatorAvatarHTML}
                    <p class="text-[11px] text-neutral-400 group-hover/author:text-indigo-400 font-medium truncate max-w-[140px]">${finalOwnerName}</p>
                </div>
            </div>
            <div class="text-xs text-neutral-400 font-mono flex-shrink-0 bg-neutral-900/50 px-2 py-1 rounded-xl border border-white/5">❤️ ${item.likesCount || 0}</div>
        </div>
    `;
    card.onclick = () => openPortfolioDetailModal(item);
    return card;
}

function renderGallerySingleGrid(items) {
    const grid = document.getElementById("grid-top-liked");
    if (!grid) return; grid.innerHTML = "";
    if (items.length === 0) {
        grid.innerHTML = `<p class="text-xs text-neutral-500 italic col-span-full py-12 text-center">ไม่พบข้อมูลในหมวดหมู่นี้</p>`; return;
    }
    items.forEach(item => {
        grid.appendChild(createPortfolioCard(item));
    });
}

function filterGalleryByCategory(category) {
    const segmentView = document.getElementById("gallery-segmented-container");
    const singleGridView = document.getElementById("grid-top-liked");
    
    ["cat-all", "cat-graphic", "cat-video", "cat-motion"].forEach(id => {
        document.getElementById(id)?.classList.remove("bg-indigo-600", "text-white");
        document.getElementById(id)?.classList.add("text-neutral-400");
    });

    if (category === "all") {
        document.getElementById("cat-all")?.classList.add("bg-indigo-600", "text-white");
        segmentView.classList.remove("hidden");
        singleGridView.classList.add("hidden");
        renderGallerySegmented(allPortfolios);
        return;
    }

    segmentView.classList.add("hidden");
    singleGridView.classList.remove("hidden");

    let filtered = [];
    if (category === "graphic") {
        document.getElementById("cat-graphic")?.classList.add("bg-indigo-600", "text-white");
        filtered = allPortfolios.filter(item => (item.category || "").toLowerCase().includes("graphic") || (item.category || "").toLowerCase().includes("photo"));
    } else if (category === "video") {
        document.getElementById("cat-video")?.classList.add("bg-indigo-600", "text-white");
        filtered = allPortfolios.filter(item => (item.category || "").toLowerCase().includes("video"));
    } else if (category === "motion") {
        document.getElementById("cat-motion")?.classList.add("bg-indigo-600", "text-white");
        filtered = allPortfolios.filter(item => (item.category || "").toLowerCase().includes("motion") || (item.category || "").toLowerCase().includes("3d"));
    }
    renderGallerySingleGrid(filtered);
}

async function openPortfolioDetailModal(item) {
    if (activeCommentUnsubscribe) activeCommentUnsubscribe();
    resetReplyState();
    
    let ownerAvatar = ""; let phone = "-", line = "-", other = "-";
    let facebook = "", instagram = "", tiktok = "";
    let liveOwnerName = item.ownerName || "ไม่ระบุชื่อ";
    
    const uDoc = await getDoc(doc(db, "users", item.ownerId));
    if (uDoc.exists()) {
        const uData = uDoc.data(); ownerAvatar = uData.avatar || "";
        phone = uData.phone || "-"; line = uData.line || "-"; other = uData.other || "-";
        facebook = uData.facebook || ""; instagram = uData.instagram || ""; tiktok = uData.tiktok || "";
        liveOwnerName = uData.name || uData.username || liveOwnerName;
    }

    document.getElementById("md-view-title").innerText = item.title;
    document.getElementById("md-view-category-display").innerText = item.category || "ทั่วไป";
    document.getElementById("md-creator-profile-name").innerText = liveOwnerName;
    document.getElementById("md-view-likes-count").innerText = item.likesCount || 0;
    
    const phoneEl = document.getElementById("md-contact-phone");
    const lineEl = document.getElementById("md-contact-line");
    const otherEl = document.getElementById("md-contact-other");
    
    phoneEl.innerText = phone;
    phoneEl.className = phone !== "-" ? "truncate font-mono text-[11px] font-bold tracking-wide text-amber-400" : "truncate text-neutral-600 font-mono text-[10px]";
    
    lineEl.innerText = line;
    lineEl.className = line !== "-" ? "truncate font-sans text-[11px] font-bold tracking-wide text-emerald-400" : "truncate text-neutral-600 font-sans text-[10px]";
    
    otherEl.innerText = other;
    otherEl.className = other !== "-" ? "truncate font-sans text-[11px] font-medium text-neutral-200" : "truncate text-neutral-600 font-sans text-[10px]";

    const fbEl = document.getElementById("md-link-facebook");
    const igEl = document.getElementById("md-link-instagram");
    const ttEl = document.getElementById("md-link-tiktok");

    if(facebook && facebook.trim() !== "") { fbEl.href = facebook; fbEl.innerText = extractSocialUsername(facebook, "facebook"); fbEl.className = "text-[10px] text-blue-400 font-black hover:text-blue-300 transition duration-300 underline tracking-wide drop-shadow-[0_0_4px_rgba(59,130,246,0.4)] text-center truncate w-full"; }
    else { fbEl.href = "javascript:void(0)"; fbEl.innerText = "-"; fbEl.className = "text-[10px] text-neutral-600 font-medium cursor-default text-center truncate w-full"; }

    if(instagram && instagram.trim() !== "") { igEl.href = instagram; igEl.innerText = extractSocialUsername(instagram, "instagram"); igEl.className = "text-[10px] text-rose-400 font-black hover:text-rose-300 transition duration-300 underline tracking-wide drop-shadow-[0_0_4px_rgba(244,63,94,0.4)] text-center truncate w-full"; }
    else { igEl.href = "javascript:void(0)"; igEl.innerText = "-"; igEl.className = "text-[10px] text-neutral-600 font-medium cursor-default text-center truncate w-full"; }

    if(tiktok && tiktok.trim() !== "") { ttEl.href = tiktok; ttEl.innerText = extractSocialUsername(tiktok, "tiktok"); ttEl.className = "text-[10px] text-cyan-400 font-black hover:text-cyan-300 transition duration-300 underline tracking-wide drop-shadow-[0_0_4px_rgba(34,211,238,0.4)] text-center truncate w-full"; }
    else { ttEl.href = "javascript:void(0)"; ttEl.innerText = "-"; ttEl.className = "text-[10px] text-neutral-600 font-medium cursor-default text-center truncate w-full"; }

    const avBox = document.getElementById("md-user-avatar-placeholder");
    if (avBox) avBox.innerHTML = ownerAvatar ? `<img src="${convertDriveUrl(ownerAvatar)}" class="w-full h-full object-cover rounded-xl">` : "👤";

    const mediaContainer = document.getElementById("media-display-container");
    if (mediaContainer) {
        const url = item.image || "";
        const isVideoCategory = item.category === "Video Editor" || item.category === "Motion / 3D";
        if (url.includes("youtube.com") || url.includes("youtu.be")) {
            let vid = url.includes("youtu.be/") ? url.split("youtu.be/")[1].split(/[?#]/)[0] : url.split("v=")[1]?.split("&")[0];
            mediaContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${vid}" class="w-full h-full max-h-[80vh] aspect-video border-0 rounded-2xl shadow-xl" allowfullscreen></iframe>`;
        } else if (url.includes("drive.google.com") && isVideoCategory) {
            mediaContainer.innerHTML = `<iframe src="${convertDriveVideoUrl(url)}" class="w-full h-full max-h-[80vh] aspect-video border-0 rounded-2xl shadow-xl" allowfullscreen></iframe>`;
        } else if (url.includes("drive.google.com")) {
            mediaContainer.innerHTML = `<img src="${convertDriveUrl(url)}" class="w-full h-full max-h-[80vh] object-contain rounded-2xl">`;
        } else if (url.includes(".mp4") || url.includes(".mov")) {
            mediaContainer.innerHTML = `<video src="${url}" controls autoplay class="w-full h-full max-h-[80vh] object-contain rounded-2xl bg-black"></video>`;
        } else {
            mediaContainer.innerHTML = `<img src="${convertDriveUrl(url)}" class="w-full h-full max-h-[80vh] object-contain rounded-2xl">`;
        }
    }

    const likeIcon = document.getElementById("like-icon");
    likeIcon.innerText = (currentUser && item.likedBy?.includes(currentUser.uid)) ? "❤️" : "🤍";

    document.getElementById("btn-md-like").onclick = async () => {
        if (!currentUser) return alert("กรุณาเข้าสู่ระบบก่อนครับ");
        const pRef = doc(db, "portfolios", item.id);
        const snap = await getDoc(pRef); if (!snap.exists()) return;
        let likes = snap.data().likedBy || []; let cnt = snap.data().likesCount || 0;
        if (likes.includes(currentUser.uid)) { likes = likes.filter(id => id !== currentUser.uid); cnt = Math.max(0, cnt - 1); } 
        else { likes.push(currentUser.uid); cnt += 1; }
        await updateDoc(pRef, { likedBy: likes, likesCount: cnt });
        document.getElementById("md-view-likes-count").innerText = cnt;
        likeIcon.innerText = likes.includes(currentUser.uid) ? "❤️" : "🤍";
    };

    const dlZone = document.getElementById("md-download-zone");
    if (item.license === "free" && item.downloadLink) {
        document.getElementById("btn-md-download").href = item.downloadLink; dlZone.classList.remove("hidden");
    } else { dlZone.classList.add("hidden"); }

    const list = document.getElementById("md-comments-list");
    activeCommentUnsubscribe = onSnapshot(query(collection(db, "portfolios", item.id, "comments"), orderBy("createdAt", "asc")), (snap) => {
        list.innerHTML = snap.empty ? `<p class="text-[11px] text-neutral-600 italic py-2">ยังไม่มีคอมเมนต์...</p>` : "";
        const arr = []; snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        
        arr.filter(c => !c.parentId).forEach(parent => {
            let tagHTML = "";
            if (parent.userId === item.ownerId) tagHTML = `<span class="ml-1.5 text-[9px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded font-bold">ผู้เขียน</span>`;
            else if (parent.role === "admin") tagHTML = `<span class="ml-1.5 text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded font-bold">ผู้ดูแลระบบ</span>`;

            let deleteMenuHTML = "";
            const isMyComment = currentUser && parent.userId === currentUser.uid;
            const isPostOwner = currentUser && item.ownerId === currentUser.uid;
            const isSystemAdmin = userData && userData.role === "admin";

            if (isMyComment || isPostOwner || isSystemAdmin) {
                deleteMenuHTML = `
                    <div class="relative self-start">
                        <button onclick="window.toggleCommentMenu(event, '${parent.id}')" class="text-neutral-500 hover:text-neutral-300 text-xs px-2 py-0.5 rounded hover:bg-white/5 transition">⋮</button>
                        <div id="menu-dropdown-${parent.id}" class="comment-menu-dropdown hidden absolute right-0 top-full mt-1 bg-neutral-950 border border-white/10 rounded-xl shadow-2xl py-1 z-30 min-w-[80px]">
                            <button onclick="window.deleteCommentAction('${item.id}', '${parent.id}')" class="w-full text-left px-3 py-1.5 text-[11px] text-rose-400 hover:bg-rose-500/10 transition">ลบ</button>
                        </div>
                    </div>
                `;
            }

            const pDiv = document.createElement("div");
            pDiv.className = "space-y-1.5 border-b border-white/[0.02] pb-3";
            
            const childReplies = arr.filter(r => r.parentId === parent.id);
            let repliesToggleBtnHTML = "";
            if (childReplies.length > 0) repliesToggleBtnHTML = `<button id="btn-toggle-replies-${parent.id}" onclick="window.toggleRepliesVisibility('${parent.id}')" class="text-[10px] text-neutral-500 hover:text-indigo-400 ml-9 block mt-1 transition">💬 ดูข้อความตอบกลับเพิ่มเติม (${childReplies.length})</button>`;

            pDiv.innerHTML = `
                <div class="flex items-start space-x-2.5 bg-neutral-900/20 p-2.5 rounded-xl border border-white/[0.01] hover:border-white/5 transition group relative">
                    <div class="w-7 h-7 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0">${parent.userAvatar ? `<img src="${convertDriveUrl(parent.userAvatar)}" class="w-full h-full object-cover">` : '👤'}</div>
                    <div class="flex-grow min-w-0">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-neutral-300 text-[11px] flex items-center">${parent.userName} ${tagHTML}</span>
                            <div class="flex items-center space-x-2">
                                <button class="btn-rep text-[10px] text-indigo-400/80 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition" data-id="${parent.id}" data-name="${parent.userName}">ตอบกลับ</button>
                                ${deleteMenuHTML}
                            </div>
                        </div>
                        <p class="text-neutral-400 text-xs break-words mt-0.5">${parent.text}</p>
                    </div>
                </div>
                ${repliesToggleBtnHTML}
                <div id="replies-container-${parent.id}" class="replies pl-7 space-y-2 hidden"></div>
            `;
            
            pDiv.querySelector(".btn-rep").onclick = (e) => setReplyState(e.target.dataset.id, e.target.dataset.name);
            const rContainer = pDiv.querySelector(".replies");
            
            childReplies.forEach(reply => {
                let rTagHTML = "";
                if (reply.userId === item.ownerId) rTagHTML = `<span class="ml-1 text-[8px] px-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded font-bold">ผู้เขียน</span>`;
                else if (reply.role === "admin") rTagHTML = `<span class="ml-1 text-[8px] px-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded font-bold">ผู้ดูแลระบบ</span>`;

                let rDeleteMenuHTML = "";
                if (currentUser && reply.userId === currentUser.uid || isPostOwner || isSystemAdmin) {
                    rDeleteMenuHTML = `
                        <div class="relative">
                            <button onclick="window.toggleCommentMenu(event, '${reply.id}')" class="text-neutral-600 hover:text-neutral-400 text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5">⋮</button>
                            <div id="menu-dropdown-${reply.id}" class="comment-menu-dropdown hidden absolute right-0 top-full mt-1 bg-neutral-950 border border-white/10 rounded-xl shadow-2xl py-0.5 z-30 min-w-[70px]">
                                <button onclick="window.deleteCommentAction('${item.id}', '${reply.id}')" class="w-full text-left px-2.5 py-1 text-[10px] text-rose-400 hover:bg-rose-500/10 transition">ลบ</button>
                            </div>
                        </div>
                    `;
                }

                const rDiv = document.createElement("div");
                rDiv.className = "flex items-start space-x-2 bg-neutral-950/40 p-2.5 border-l-2 border-indigo-500/30 pl-3 rounded-r-xl group/reply";
                rDiv.innerHTML = `
                    <div class="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-neutral-800">${reply.userAvatar ? `<img src="${convertDriveUrl(reply.userAvatar)}" class="w-full h-full object-cover">` : '👤'}</div>
                    <div class="min-w-0 flex-grow">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-[10px] text-neutral-300 flex items-center">${reply.userName} ${rTagHTML}</span>
                            ${rDeleteMenuHTML}
                        </div>
                        <p class="text-neutral-400 text-xs break-words mt-0.5">${reply.text}</p>
                    </div>
                `;
                rContainer.appendChild(rDiv);
            });
            list.appendChild(pDiv);
        });
    });

    const emojiToggleBtn = document.getElementById("btn-emoji-toggle");
    const emojiPicker = document.getElementById("md-emoji-picker");
    const commentInputText = document.getElementById("input-md-comment-text");

    if (emojiToggleBtn && emojiPicker) {
        emojiToggleBtn.onclick = (e) => { e.stopPropagation(); emojiPicker.classList.toggle("hidden"); };
        emojiPicker.querySelectorAll(".emoji-item").forEach(emItem => {
            emItem.onclick = (e) => { if (commentInputText) { commentInputText.value += e.target.innerText; commentInputText.focus(); } emojiPicker.classList.add("hidden"); };
        });
    }

    document.getElementById("form-md-comment").onsubmit = async (e) => {
        e.preventDefault(); if (!currentUser) return alert("กรุณาเข้าสู่ระบบก่อนครับ");
        const ip = document.getElementById("input-md-comment-text"); if (!ip.value.trim()) return;
        
        await addDoc(collection(db, "portfolios", item.id, "comments"), { 
            text: ip.value.trim(), userId: currentUser.uid, userName: userData?.name || currentUser.email.split('@')[0], 
            userAvatar: userData?.avatar || "", role: userData?.role || "user", createdAt: new Date().toISOString(), parentId: currentReplyParentId || null 
        });
        ip.value = ""; resetReplyState();
    };

    document.getElementById("modal-portfolio-detail").classList.remove("hidden");
}

function setReplyState(id, name) { currentReplyParentId = id; document.getElementById("reply-target-name").innerText = name; document.getElementById("reply-status-bar").classList.remove("hidden"); }
function resetReplyState() { currentReplyParentId = null; document.getElementById("reply-status-bar").classList.add("hidden"); }
function closePortfolioDetailModal() { if (activeCommentUnsubscribe) activeCommentUnsubscribe(); document.getElementById("media-display-container").innerHTML = ""; document.getElementById("modal-portfolio-detail").classList.add("hidden"); }

const bindClick = (id, cb) => { const el = document.getElementById(id); if (el) el.onclick = cb; };
bindClick("btn-nav-home", () => navigateTo("gallery"));
bindClick("btn-open-profile-modal", () => openProfileModal(currentUser));
bindClick("btn-close-profile-bg", () => document.getElementById("modal-profile-update").classList.add("hidden"));
bindClick("btn-close-profile-x", () => document.getElementById("modal-profile-update").classList.add("hidden"));
bindClick("btn-close-detail-bg", () => closePortfolioDetailModal());
bindClick("btn-close-detail-x", () => closePortfolioDetailModal());
bindClick("btn-close-edit-bg", () => document.getElementById("modal-portfolio-edit").classList.add("hidden"));
bindClick("btn-close-edit-x", () => document.getElementById("modal-portfolio-edit").classList.add("hidden"));
bindClick("btn-cancel-reply", () => resetReplyState());
bindClick("btn-close-creator-bg", () => document.getElementById("modal-creator-popup").classList.add("hidden"));
bindClick("btn-close-creator-x", () => document.getElementById("modal-creator-popup").classList.add("hidden"));

bindClick("cat-all", () => filterGalleryByCategory('all'));
bindClick("cat-graphic", () => filterGalleryByCategory('graphic'));
bindClick("cat-video", () => filterGalleryByCategory('video'));
bindClick("cat-motion", () => filterGalleryByCategory('motion'));

const formAuth = document.getElementById("form-auth");
if (formAuth) {
    formAuth.onsubmit = async (e) => {
        e.preventDefault(); const em = document.getElementById("input-username").value; const pa = document.getElementById("input-password").value;
        try {
            if (authMode === "login") { await signInWithEmailAndPassword(auth, em, pa); } 
            else {
                const cred = await createUserWithEmailAndPassword(auth, em, pa);
                await setDoc(doc(db, "users", cred.user.uid), { name: em.split('@')[0], email: em, role: "user", phone: "", line: "", facebook: "", instagram: "", tiktok: "", other: "", avatar: "" });
            }
            navigateTo("gallery");
        } catch (err) { alert(err.message); }
    };
}

bindClick("btn-toggle-auth", () => {
    authMode = authMode === "login" ? "register" : "login";
    document.getElementById("auth-header-title").innerText = authMode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิกใหม่";
    document.getElementById("btn-toggle-auth").innerText = authMode === "login" ? "ยังไม่มีบัญชี? สมัครใหม่ที่นี่" : "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ";
});

bindClick("btn-google-auth", async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); navigateTo("gallery"); } catch (err) { alert(err.message); } });
navigateTo("gallery");