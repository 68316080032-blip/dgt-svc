// app.js - ฉบับแก้ไขปัญหาสมาชิกไม่ขึ้นโชว์ (ดักจับคำสะกดหมวดหมู่ + ดึงข้อมูลทุกคนแบบ Realtime)
import { db, auth } from "./firebase-config.js";
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, addDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { convertDriveUrl, convertDriveVideoUrl } from "./utils.js";

// Global Live States
let activePostId = null;
let currentUserId = null;
let currentUserName = "Anonymous";
let currentUserAvatar = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
let commentUnsubscribe = null;

let expandState = {
    "Graphic Design": true, 
    "Video Editor": true,
    "Motion Graphic / 3D": true
};

// 🛡️ ตรวจสอบสถานะผู้ใช้งาน และ ควบคุมปุ่มล็อกอิน/Dropdown โปรไฟล์ บน Navbar
onAuthStateChanged(auth, async (user) => {
    const adminLinkElement = document.getElementById("admin-link");
    const loginBtnElement = document.getElementById("login-btn");
    const userProfileMenu = document.getElementById("user-profile-menu");
    
    if (user) {
        currentUserId = user.uid;
        
        if (loginBtnElement) loginBtnElement.classList.add("hidden");
        if (userProfileMenu) userProfileMenu.classList.remove("hidden");

        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const uData = userDoc.data();
                currentUserName = uData.name || uData.displayName || user.email;
                currentUserAvatar = uData.avatarUrl || uData.avatar || uData.photoURL || "";
                
                if (document.getElementById("nav-username")) document.getElementById("nav-username").innerText = currentUserName;
                if (document.getElementById("dropdown-user-name")) document.getElementById("dropdown-user-name").innerText = currentUserName;
                
                const avatarZone = document.getElementById("nav-avatar-zone");
                if (avatarZone) {
                    if (currentUserAvatar) {
                        avatarZone.innerHTML = `<img src="${currentUserAvatar}" class="w-full h-full object-cover" onerror="this.onerror=null; this.parentNode.innerText='${currentUserName.charAt(0).toUpperCase()}';">`;
                    } else {
                        avatarZone.innerText = currentUserName.charAt(0).toUpperCase();
                    }
                }

                // ตรวจสอบสิทธิ์แอดมิน
                const userRole = (uData.role || "").toLowerCase().trim();
                if (adminLinkElement) {
                    if (userRole === "admin" || userRole === "dev") {
                        adminLinkElement.classList.remove("hidden"); 
                    } else {
                        adminLinkElement.classList.add("hidden");    
                    }
                }
            }
        } catch (e) { 
            console.error("Error setting user context & role check:", e); 
        }
    } else {
        currentUserId = null;
        currentUserName = "Anonymous";
        currentUserAvatar = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
        
        if (loginBtnElement) loginBtnElement.classList.remove("hidden");
        if (adminLinkElement) adminLinkElement.classList.add("hidden");
        if (userProfileMenu) userProfileMenu.classList.add("hidden");
    }
});

// ================= 📂 1. REALTIME GALLERY ENGINE =================
function initGalleryStream() {
    const grids = {
        "Graphic Design": document.getElementById("grid-graphic"),
        "Video Editor": document.getElementById("grid-video"),
        "Motion Graphic / 3D": document.getElementById("grid-motion")
    };

    if (!grids["Graphic Design"] || !grids["Video Editor"] || !grids["Motion Graphic / 3D"]) return;

    // ดึงงานทั้งหมดมาประมวลผล ไม่ล็อค status
    const q = query(collection(db, "portfolios"));

    onSnapshot(q, (snapshot) => {
        let lists = { "Graphic Design": [], "Video Editor": [], "Motion Graphic / 3D": [] };

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            let rawCategory = (data.category || "").trim();
            let mappedCategory = "";

            // 🔍 ระบบจับคู่คำสะกด (Normalize Category): ป้องกันกรณีคนอื่นกรอกหมวดหมู่สะกดต่างกัน
            if (rawCategory.includes("Graphic") && !rawCategory.includes("3D") && !rawCategory.includes("Motion")) {
                mappedCategory = "Graphic Design";
            } else if (rawCategory.includes("Video") || rawCategory.includes("Editor")) {
                mappedCategory = "Video Editor";
            } else if (rawCategory.includes("3D") || rawCategory.includes("Motion") || rawCategory.includes("3d") || rawCategory.includes("2D")) {
                mappedCategory = "Motion Graphic / 3D";
            }

            // นำผลงานยัดเข้าลิสต์เพื่อนำไปแสดงผล
            if (mappedCategory && lists[mappedCategory]) {
                lists[mappedCategory].push({ id: docSnap.id, ...data });
            } else {
                // หากไม่เข้าเงื่อนไขใดๆ เลย (เช่น ค่าว่าง) ให้สำรองไปแสดงไว้ที่แถวแรก เพื่อให้เห็นงานชิ้นนั้นๆ ทันที
                lists["Graphic Design"].push({ id: docSnap.id, ...data });
            }
        });

        // จัดเรียงงานใหม่ล่าสุดขึ้นก่อน
        Object.keys(lists).forEach(cat => {
            lists[cat].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        });

        const mapping = [
            { key: "Graphic Design", grid: grids["Graphic Design"], btn: "btn-more-graphic", count: "count-graphic" },
            { key: "Video Editor", grid: grids["Video Editor"], btn: "btn-more-video", count: "count-video" },
            { key: "Motion Graphic / 3D", grid: grids["Motion Graphic / 3D"], btn: "btn-more-motion", count: "count-motion" }
        ];

        mapping.forEach(({ key, grid, btn, count }) => {
            if (document.getElementById(count)) document.getElementById(count).innerText = lists[key].length;
            grid.className = "flex overflow-x-auto gap-6 pb-4 pt-1 snap-x no-scrollbar";
            renderCategoryRow(lists[key], key, grid, btn);
        });
    });
}

function renderCategoryRow(itemsArray, categoryName, targetGridElement, moreButtonId) {
    targetGridElement.innerHTML = "";
    const btnMore = document.getElementById(moreButtonId);

    if (itemsArray.length === 0) {
        targetGridElement.innerHTML = `<p class="text-xs text-slate-400 italic py-8 text-center w-full">📭 ยังไม่มีผลงานในหมวดหมู่นี้</p>`;
        if (btnMore) btnMore.classList.add("hidden");
        return;
    }

    if (btnMore) {
        if (itemsArray.length > 6) {
            btnMore.classList.remove("hidden");
            btnMore.innerText = expandState[categoryName] ? "แสดงน้อยลง ▴" : `ดูเพิ่มเติม (${itemsArray.length - 6}) ➔`;
        } else {
            btnMore.classList.add("hidden");
        }
    }

    const displayItems = expandState[categoryName] ? itemsArray : itemsArray.slice(0, 6);

    displayItems.forEach((item) => {
        const currentImg = item.imgLink || item.image || item.coverUrl || item.imageUrl || "";
        const targetUid = item.ownerUid || item.ownerId || item.uid || item.userId;
        const cardId = `card-${item.id}`;
        
        let timeDisplay = "ไม่ระบุเวลา";
        if (item.createdAt) {
            const dateObj = new Date(item.createdAt);
            if (!isNaN(dateObj.getTime())) {
                timeDisplay = dateObj.toLocaleDateString("th-TH", { day: 'numeric', month: 'short' }) + " " + dateObj.toLocaleTimeString("th-TH", { hour: '2-digit', minute:'2-digit' });
            }
        }

        const card = document.createElement("div");
        card.id = cardId;
        card.className = "premium-card rounded-2xl overflow-hidden cursor-pointer flex flex-col justify-between p-3 space-y-3 flex-shrink-0 w-[290px] snap-start bg-white border border-slate-100 shadow-xs";
        card.innerHTML = `
            <div class="relative aspect-video bg-slate-900 rounded-xl overflow-hidden shrink-0 section-media">
                <img src="${convertDriveUrl(currentImg)}" referrerpolicy="no-referrer" class="w-full h-full object-cover transition-transform duration-500 hover:scale-105" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600';">
                <span class="absolute bottom-2 right-2 bg-slate-950/70 backdrop-blur-xs text-[8px] text-slate-300 px-2 py-0.5 rounded font-mono font-medium tracking-tight">${timeDisplay}</span>
            </div>
            <div class="space-y-2 flex-grow flex flex-col justify-between">
                <div class="section-content">
                    <h4 class="text-xs font-bold text-slate-800 line-clamp-1">${item.title || "Untitled Work"}</h4>
                    <p class="text-[10px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">${item.description || "คลิกเพื่อดูข้อมูลผลงาน..."}</p>
                </div>
                <div class="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                    <div class="flex items-center space-x-2 truncate max-w-[75%] creator-profile-btn group/profile p-1 rounded-lg hover:bg-orange-50 transition-all">
                        <div class="w-5 h-5 rounded-full overflow-hidden bg-slate-200 shrink-0 border border-slate-100 placeholder-avatar flex items-center justify-center text-[9px] font-bold text-slate-500">
                            -
                        </div>
                        <span class="text-slate-500 font-medium truncate">By <span class="text-slate-700 font-bold group-hover/profile:text-orange-600 name-display">${item.ownerName || "Creator"}</span></span>
                    </div>
                    <span class="text-rose-500 font-bold shrink-0">❤️ ${item.likedBy?.likesCount || item.likes || 0}</span>
                </div>
            </div>
        `;

        if (targetUid) {
            getDoc(doc(db, "users", targetUid)).then((userDoc) => {
                if (userDoc.exists()) {
                    const uData = userDoc.data();
                    const liveName = uData.name || uData.displayName || item.ownerName || "Creator";
                    const liveAvatar = uData.avatarUrl || uData.avatar || uData.photoURL || "";
                    
                    const element = document.getElementById(cardId);
                    if (element) {
                        element.querySelector(".name-display").innerText = liveName;
                        if (liveAvatar) {
                            element.querySelector(".placeholder-avatar").innerHTML = `<img src="${liveAvatar}" class="w-full h-full object-cover" onerror="this.onerror=null; this.parentNode.innerText='${liveName.charAt(0).toUpperCase()}';">`;
                        } else {
                            element.querySelector(".placeholder-avatar").innerText = liveName.charAt(0).toUpperCase();
                        }
                    }
                }
            }).catch(e => console.error(e));
        }

        const handleCardAction = (e, callback) => {
            e.stopPropagation();
            if (!currentUserId) {
                const authModal = document.getElementById("auth-guard-modal");
                if (authModal) authModal.classList.remove("hidden");
            } else {
                callback();
            }
        };

        card.querySelector(".section-media").onclick = (e) => { handleCardAction(e, () => openPortfolioDetailModal(item)); };
        card.querySelector(".section-content").onclick = (e) => { handleCardAction(e, () => openPortfolioDetailModal(item)); };
        card.querySelector(".creator-profile-btn").onclick = (e) => { handleCardAction(e, () => openCreatorContactModal(targetUid, item.ownerName)); };

        targetGridElement.appendChild(card);
    });
}

// ================= 👤 2. POP-UP MODAL แสดงช่องทางติดต่อ =================
async function openCreatorContactModal(uid, fallbackName) {
    const contactModal = document.getElementById("creator-contact-modal");
    if (!contactModal) return;

    const popName = document.getElementById("contact-pop-name");
    const popPhone = document.getElementById("contact-pop-phone");
    const popLine = document.getElementById("contact-pop-line");
    const popAvatarZone = document.getElementById("contact-pop-avatar");

    if (popName) popName.innerText = fallbackName || "กำลังโหลด...";
    if (popPhone) popPhone.innerText = "กำลังโหลด...";
    if (popLine) popLine.innerText = "กำลังโหลด...";

    if (uid) {
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
                const uData = userDoc.data();
                const finalName = uData.name || uData.displayName || fallbackName || "Creator";
                if (popName) popName.innerText = finalName;
                if (popPhone) popPhone.innerText = uData.phone || uData.tel || "ไม่มีข้อมูลติดต่อโทรศัพท์";
                if (popLine) popLine.innerText = uData.line || uData.lineId || "ไม่มีข้อมูลไอดี Line";
                
                const userAvatar = uData.avatarUrl || uData.avatar || uData.photoURL || "";
                if (popAvatarZone) {
                    if (userAvatar) {
                        popAvatarZone.innerHTML = `<img src="${userAvatar}" class="w-full h-full object-cover" onerror="this.onerror=null; this.parentNode.innerText='${finalName.charAt(0).toUpperCase()}';">`;
                    } else {
                        popAvatarZone.innerHTML = "";
                        popAvatarZone.innerText = finalName.charAt(0).toUpperCase();
                        popAvatarZone.className = "w-20 h-20 mx-auto rounded-full bg-orange-500 text-white font-black text-xl flex items-center justify-center shadow-md";
                    }
                }
            } else {
                if (popPhone) popPhone.innerText = "ไม่พบโปรไฟล์ในฐานข้อมูล";
                if (popLine) popLine.innerText = "ไม่พบโปรไฟล์ในฐานข้อมูล";
            }
        } catch (err) {
            console.error(err);
            if (popPhone) popPhone.innerText = "เกิดข้อผิดพลาด";
            if (popLine) popLine.innerText = "เกิดข้อผิดพลาด";
        }
    }

    contactModal.classList.remove("hidden");
}

// ================= 🖼️ 3. POP-UP MODAL แสดงรายละเอียดชิ้นงาน =================
async function openPortfolioDetailModal(item) {
    activePostId = item.id;
    const modal = document.getElementById("portfolio-modal");
    const modalImg = document.getElementById("modal-img");
    const modalVideo = document.getElementById("modal-video");
    if (!modal) return;

    const mediaLink = item.imgLink || item.image || item.coverUrl || item.imageUrl || "";
    if (mediaLink.includes(".mp4") || mediaLink.includes("drive.google.com/file/d/") || mediaLink.includes("youtube.com")) {
        modalImg.classList.add("hidden");
        modalVideo.classList.remove("hidden");
        modalVideo.src = convertDriveVideoUrl(mediaLink);
    } else {
        modalVideo.classList.add("hidden"); modalVideo.src = "";
        modalImg.classList.remove("hidden"); modalImg.src = convertDriveUrl(mediaLink);
    }

    document.getElementById("modal-category").innerText = item.category || "GENERAL";
    document.getElementById("modal-title").innerText = item.title || "Untitled";
    document.getElementById("modal-desc").innerText = item.description || "No description provided.";
    document.getElementById("modal-like-count").innerText = item.likedBy?.likesCount || item.likes || 0;

    initCommentStream(item.id);
    modal.classList.remove("hidden");
}

// ================= 💬 4. COMMENT SYSTEM ENGINE =================
function initCommentStream(postId) {
    if (commentUnsubscribe) commentUnsubscribe();
    const container = document.getElementById("modal-comments-container");
    const countText = document.getElementById("modal-comment-count");
    if (!container) return;

    const q = query(collection(db, "portfolios", postId, "comments"), orderBy("createdAt", "asc"));
    commentUnsubscribe = onSnapshot(q, (snapshot) => {
        container.innerHTML = "";
        if (countText) countText.innerText = snapshot.size;

        if (snapshot.empty) {
            container.innerHTML = `<p class="text-[10px] text-slate-400 italic py-2 text-center">ยังไม่มีความคิดเห็น มาร่วมพิมพ์ทักทายเป็นคนแรกกัน!</p>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const c = docSnap.data();
            const commentAuthor = c.ownerName || c.userName || c.name || "ไม่ระบุชื่อ";
            const commentAvatar = c.ownerAvatar || c.avatarUrl || c.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
            const commenterUid = c.ownerId || c.uid || null;

            const div = document.createElement("div");
            div.className = "bg-white p-2.5 rounded-xl border border-slate-200/50 flex items-start space-x-3 shadow-2xs text-left";
            div.innerHTML = `
                <img src="${commentAvatar}" class="w-6 h-6 rounded-full object-cover shrink-0 border border-slate-100 cursor-pointer hover:ring-2 hover:ring-orange-500/50 comment-avatar-btn" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png';">
                <div class="flex-grow min-w-0">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-slate-800 text-[11px] truncate cursor-pointer hover:text-orange-600 comment-author-btn">${commentAuthor}</span>
                        <span class="text-[9px] text-slate-400 shrink-0">${c.createdAt ? new Date(c.createdAt).toLocaleDateString("th-TH") : ""}</span>
                    </div>
                    <p class="text-slate-600 text-xs mt-0.5 whitespace-pre-wrap">${c.text || c.comment || ""}</p>
                </div>
            `;

            if (commenterUid) {
                div.querySelector(".comment-avatar-btn").onclick = () => openCreatorContactModal(commenterUid, commentAuthor);
                div.querySelector(".comment-author-btn").onclick = () => openCreatorContactModal(commenterUid, commentAuthor);
            }

            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    });
}

// ================= 🛠️ 5. EVENT LISTENERS MOUNT ZONE =================
document.addEventListener("DOMContentLoaded", () => {
    
    // Dropdown Controller
    const btnToggle = document.getElementById("btn-dropdown-toggle");
    const dropdownBox = document.getElementById("nav-dropdown-box");
    const arrowIcon = document.getElementById("dropdown-arrow");

    if (btnToggle && dropdownBox) {
        btnToggle.onclick = (e) => {
            e.stopPropagation();
            const isHidden = dropdownBox.classList.contains("hidden");
            if (isHidden) {
                dropdownBox.classList.remove("hidden");
                if (arrowIcon) arrowIcon.classList.add("rotate-180");
            } else {
                dropdownBox.classList.add("hidden");
                if (arrowIcon) arrowIcon.classList.remove("rotate-180");
            }
        };

        document.addEventListener("click", () => {
            dropdownBox.classList.add("hidden");
            if (arrowIcon) arrowIcon.classList.remove("rotate-180");
        });
    }

    // Logout Event
    const logoutBtn = document.getElementById("btn-nav-logout");
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            try {
                await auth.signOut();
                window.location.reload();
            } catch (err) { 
                console.error(err);
                alert("เกิดข้อผิดพลาดทางระบบ กรุณาลองใหม่อีกครั้งครับ"); 
            }
        };
    }

    const closeBtn = document.getElementById("modal-close-btn");
    if (closeBtn) {
        closeBtn.onclick = () => {
            document.getElementById("portfolio-modal").classList.add("hidden");
            document.getElementById("modal-video").src = "";
            if (commentUnsubscribe) commentUnsubscribe();
        };
    }

    const closeContactBtn = document.getElementById("contact-modal-close-btn");
    if (closeContactBtn) {
        closeContactBtn.onclick = () => {
            document.getElementById("creator-contact-modal").classList.add("hidden");
        };
    }

    const closeAuthModalBtn = document.getElementById("btn-close-auth-modal");
    if (closeAuthModalBtn) {
        closeAuthModalBtn.onclick = () => {
            const authModal = document.getElementById("auth-guard-modal");
            if (authModal) authModal.classList.add("hidden");
        };
    }

    const likeBtn = document.getElementById("modal-like-btn");
    if (likeBtn) {
        likeBtn.onclick = async () => {
            if (!activePostId) return;
            try {
                const freshDoc = await getDoc(doc(db, "portfolios", activePostId));
                if (freshDoc.exists()) {
                    let currentLikes = freshDoc.data().likedBy?.likesCount || freshDoc.data().likes || 0;
                    let nextCount = currentLikes + 1;
                    await updateDoc(doc(db, "portfolios", activePostId), { "likedBy.likesCount": nextCount, "likes": nextCount });
                    document.getElementById("modal-like-count").innerText = nextCount;
                }
            } catch (err) { console.error(err); }
        };
    }

    const commentForm = document.getElementById("modal-comment-form");
    if (commentForm) {
        commentForm.onsubmit = async (e) => {
            e.preventDefault();
            const input = document.getElementById("modal-comment-input");
            if (!activePostId || !input.value.trim()) return;
            if (!currentUserId) return alert("🔒 กรุณาเข้าสู่ระบบก่อนที่จะร่วมส่งความคิดเห็นครับ");

            try {
                await addDoc(collection(db, "portfolios", activePostId, "comments"), {
                    ownerId: currentUserId,
                    ownerName: currentUserName,
                    ownerAvatar: currentUserAvatar,
                    text: input.value.trim(),
                    createdAt: new Date().toISOString()
                });
                input.value = "";
            } catch (err) { alert("ล้มเหลวในการส่งคอมเมนต์: " + err.message); }
        };
    }

    const viewButtons = [
        { id: "btn-more-graphic", key: "Graphic Design" },
        { id: "btn-more-video", key: "Video Editor" },
        { id: "btn-more-motion", key: "Motion Graphic / 3D" }
    ];

    viewButtons.forEach(({ id, key }) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.onclick = () => {
                expandState[key] = !expandState[key];
                initGalleryStream();
            };
        }
    });

    initGalleryStream();
});