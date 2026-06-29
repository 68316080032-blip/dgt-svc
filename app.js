// app.js - ระบบสลับปุ่มสมบูรณ์แบบ (แก้ปัญหา F5 แล้วแวบ) + Custom Toast ป็อปอัพแจ้งเตือน + ดึงผลงานทุกคนแสดงผลเรียลไทม์ + เมนูลบคอมเมนต์ 3 จุด
import { db, auth } from "./firebase-config.js";
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, addDoc, orderBy, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { convertDriveUrl, convertDriveVideoUrl } from "./utils.js";

// Global Live States
let activePostId = null;
let currentUserId = null;
let currentUserName = "Anonymous";
let currentUserAvatar = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
let currentUserRole = "user"; // เก็บสิทธิ์เพื่อใช้ในตรรกะการลบคอมเมนต์
let commentUnsubscribe = null;

let expandState = {
    "Graphic Design": false,
    "Video Editor": false,
    "Motion Graphic / 3D": false
};

// 🔔 ระบบ Pop-up Toast แจ้งเตือนสไตล์มินิมอล หรูหรา ลื่นไหล
const showToast = (message, type = "success") => {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `pointer-events-auto flex items-center p-4 rounded-2xl shadow-xl border border-white/60 transition-all duration-300 transform translate-y-2 opacity-0 max-w-sm ${
        type === "success" 
        ? "bg-emerald-500 text-white" 
        : type === "error" 
        ? "bg-rose-500 text-white" 
        : "bg-amber-500 text-white"
    }`;

    const icon = type === "success" ? "✨" : type === "error" ? "❌" : "⚠️";

    toast.innerHTML = `
        <span class="mr-2.5 text-sm">${icon}</span>
        <p class="text-xs font-bold tracking-wide">${message}</p>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove("translate-y-2", "opacity-0");
    }, 10);

    setTimeout(() => {
        toast.classList.add("opacity-0", "translate-y-[-10px]");
        setTimeout(() => toast.remove(), 300);
    }, 3500);
};

// 🛡️ ตรวจสอบสถานะผู้ใช้งาน แบบ Realtime (แก้ปัญหาเรื่องแวบตอนกดรีเฟรชอย่างถาวร)
onAuthStateChanged(auth, async (user) => {
    const adminLinkElement = document.getElementById("admin-link");
    const loginBtnElement = document.getElementById("login-btn");
    const userProfileMenu = document.getElementById("user-profile-menu");

    if (user) {
        currentUserId = user.uid;
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const uData = userDoc.data();
                currentUserName = uData.name || uData.displayName || "Anonymous";
                currentUserAvatar = uData.avatarUrl || uData.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
                currentUserRole = (uData.role || "").toLowerCase().trim();

                if (currentUserRole === "admin" || currentUserRole === "dev") {
                    if (adminLinkElement) adminLinkElement.classList.remove("hidden");
                } else {
                    if (adminLinkElement) adminLinkElement.classList.add("hidden");
                }

                const navAvatarZone = document.getElementById("nav-avatar-zone");
                const navUsername = document.getElementById("nav-username");
                const dropdownUserName = document.getElementById("dropdown-user-name");

                if (navAvatarZone) {
                    if (currentUserAvatar.startsWith("http")) {
                        navAvatarZone.innerHTML = `<img src="${convertDriveUrl(currentUserAvatar)}" class="w-full h-full object-cover">`;
                    } else {
                        navAvatarZone.innerText = currentUserName.charAt(0).toUpperCase();
                    }
                }
                if (navUsername) navUsername.innerText = currentUserName;
                if (dropdownUserName) dropdownUserName.innerText = currentUserName;

                if (loginBtnElement) loginBtnElement.classList.add("hidden");
                if (userProfileMenu) userProfileMenu.classList.remove("hidden");
            } else {
                // สมัครข้อมูลให้อัตโนมัติหากใช้ Google เข้าสู่ระบบเป็นครั้งแรกในระบบ
                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    name: user.displayName || "Google User",
                    displayName: user.displayName || "Google User",
                    email: user.email,
                    phone: "-",
                    tel: "-",
                    line: "-",
                    lineId: "-",
                    role: "user",
                    avatarUrl: user.photoURL || "",
                    createdAt: new Date().toISOString()
                });
                showToast("ยินดีต้อนรับ! ระบบลงทะเบียนบัญชี Google ของคุณสำเร็จแล้ว");
                setTimeout(() => window.location.reload(), 1000);
            }
        } catch (e) {
            console.error(e);
        }
    } else {
        currentUserId = null;
        currentUserName = "Anonymous";
        currentUserRole = "user";
        
        if (adminLinkElement) adminLinkElement.classList.add("hidden");
        if (loginBtnElement) loginBtnElement.classList.remove("hidden");
        if (userProfileMenu) userProfileMenu.classList.add("hidden");
    }
});

// ================= 🔓 REALTIME AUTH POP-UP CONTROLLER =================
const authPopupModal = document.getElementById("auth-popup-modal");
const btnLoginNav = document.getElementById("login-btn");
const btnLoginGuard = document.getElementById("btn-trigger-login-pop");
const btnCloseAuthPop = document.getElementById("btn-close-auth-pop");
const authGuardModal = document.getElementById("auth-guard-modal");

const loginSection = document.getElementById("auth-pop-login-section");
const registerSection = document.getElementById("auth-pop-register-section");
const btnToRegister = document.getElementById("btn-switch-to-register");
const btnToLogin = document.getElementById("btn-switch-to-login");

const popLoginForm = document.getElementById("pop-login-form");
const popRegisterForm = document.getElementById("pop-register-form");
const btnGoogleAuth = document.getElementById("btn-pop-google");

const openAuthPopup = () => {
    if (authPopupModal) authPopupModal.classList.remove("hidden");
    if (authGuardModal) authGuardModal.classList.add("hidden");
    showLoginSection(); 
};
const closeAuthPopup = () => {
    if (authPopupModal) authPopupModal.classList.add("hidden");
    if (popLoginForm) popLoginForm.reset();
    if (popRegisterForm) popRegisterForm.reset();
};

const showLoginSection = () => {
    if (loginSection) loginSection.classList.remove("hidden");
    if (registerSection) registerSection.classList.add("hidden");
};
const showRegisterSection = () => {
    if (loginSection) loginSection.classList.add("hidden");
    if (registerSection) registerSection.classList.remove("hidden");
};

if (btnLoginNav) btnLoginNav.onclick = openAuthPopup;
if (btnLoginGuard) btnLoginGuard.onclick = openAuthPopup;
if (btnCloseAuthPop) btnCloseAuthPop.onclick = closeAuthPopup;
if (btnToRegister) btnToRegister.onclick = showRegisterSection;
if (btnToLogin) btnToLogin.onclick = showLoginSection;

// 🌐 [Google Login Pop-up Sign In]
if (btnGoogleAuth) {
    btnGoogleAuth.onclick = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            showToast("เชื่อมต่อเข้าสู่ระบบผ่าน Google สำเร็จเรียบร้อยแล้ว!");
            closeAuthPopup();
        } catch (error) {
            console.error(error);
            showToast("การเชื่อมต่อบัญชีถูกยกเลิก หรือเกิดข้อผิดพลาด", "error");
        }
    };
}

// 🟩 [Email Login System]
if (popLoginForm) {
    popLoginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById("pop-login-email").value.trim();
        const password = document.getElementById("pop-login-password").value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            showToast("เข้าสู่ระบบเสร็จสมบูรณ์ ยินดีต้อนรับกลับครับ!");
            closeAuthPopup();
        } catch (err) {
            showToast("อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง", "error");
        }
    };
}

// 🟨 [Email Register System]
if (popRegisterForm) {
    popRegisterForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById("pop-reg-name").value.trim();
        const email = document.getElementById("pop-reg-email").value.trim();
        const phone = document.getElementById("pop-reg-phone").value.trim();
        const password = document.getElementById("pop-reg-password").value;
        const confirmPassword = document.getElementById("pop-reg-confirm-password").value;

        if (password !== confirmPassword) {
            showToast("รหัสผ่านทั้งสองช่องไม่ตรงกัน! กรุณาตรวจสอบอีกครั้ง", "error");
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name: name,
                displayName: name,
                email: email,
                phone: phone,
                tel: phone,
                line: "-",
                lineId: "-",
                role: "user", 
                avatarUrl: "",
                createdAt: new Date().toISOString()
            });

            showToast("สมัครสมาชิกและบันทึกข้อมูลเข้าสู่ระบบสำเร็จแล้ว!");
            closeAuthPopup();
        } catch (err) {
            if (err.code === "auth/email-already-in-use") {
                showToast("อีเมลนี้ถูกใช้งานในระบบแล้ว ไม่สามารถสมัครซ้ำได้", "error");
            } else {
                showToast(err.message, "error");
            }
        }
    };
}

// ================= 🚪 NAVBAR PROFILE DROPDOWN ENGINE =================
const dropdownToggle = document.getElementById("btn-dropdown-toggle");
const navDropdownBox = document.getElementById("nav-dropdown-box");
const dropdownArrow = document.getElementById("dropdown-arrow");
const btnNavLogout = document.getElementById("btn-nav-logout");

if (dropdownToggle && navDropdownBox) {
    dropdownToggle.onclick = (e) => {
        e.stopPropagation();
        const isHidden = navDropdownBox.classList.contains("hidden");
        if (isHidden) {
            navDropdownBox.classList.remove("hidden");
            if (dropdownArrow) dropdownArrow.classList.add("rotate-180");
        } else {
            navDropdownBox.classList.add("hidden");
            if (dropdownArrow) dropdownArrow.classList.remove("rotate-180");
        }
    };
    document.addEventListener("click", () => {
        navDropdownBox.classList.add("hidden");
        if (dropdownArrow) dropdownArrow.classList.remove("rotate-180");
    });
}

if (btnNavLogout) {
    btnNavLogout.onclick = async () => {
        try {
            await signOut(auth);
            showToast("ออกจากระบบเรียบร้อยแล้ว พบกันใหม่คราวหน้าครับ");
            setTimeout(() => window.location.reload(), 800);
        } catch (err) { 
            showToast("เกิดข้อผิดพลาด: " + err.message, "error"); 
        }
    };
}

// ================= 📂 REALTIME PORTFOLIOS DATA RENDERING =================
const initRealtimePortfolios = () => {
    const portfolioQuery = query(collection(db, "portfolios"), orderBy("createdAt", "desc"));
    
    onSnapshot(portfolioQuery, (snapshot) => {
        const posts = [];
        snapshot.forEach(docSnap => {
            posts.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderCategorizedGrids(posts);
    }, (error) => {
        console.error("Firebase listen failed, falling back to simple load:", error);
        onSnapshot(collection(db, "portfolios"), (snapshot) => {
            const posts = [];
            snapshot.forEach(docSnap => {
                posts.push({ id: docSnap.id, ...docSnap.data() });
            });
            renderCategorizedGrids(posts);
        });
    });
};

const renderCategorizedGrids = (posts) => {
    const approvedPosts = posts.filter(p => {
        const status = (p.status || "").toLowerCase().trim();
        return status === "approved" || status === "" || status === "public";
    });

    const categories = [
        { key: "Graphic Design", gridId: "grid-graphic", countId: "count-graphic", btnId: "btn-more-graphic" },
        { key: "Video Editor", gridId: "grid-video", countId: "count-video", btnId: "btn-more-video" },
        { key: "Motion Graphic / 3D", gridId: "grid-motion", countId: "count-motion", btnId: "btn-more-motion" }
    ];

    categories.forEach(({ key, gridId, countId, btnId }) => {
        const grid = document.getElementById(gridId);
        const countBadge = document.getElementById(countId);
        const moreBtn = document.getElementById(btnId);

        if (!grid) return;

        // ฟิลเตอร์ตรวจสอบตัวอักษรพิมพ์เล็ก-ใหญ่และช่องว่าง ป้องกันงานหลุดไม่ยอมแสดงที่หน้าหลัก
        const catPosts = approvedPosts.filter(p => {
            const pCat = (p.category || "").toLowerCase().replace(/\s+/g, '');
            const targetCat = key.toLowerCase().replace(/\s+/g, '');
            return pCat === targetCat || pCat.includes(targetCat) || targetCat.includes(pCat);
        });

        if (countBadge) countBadge.innerText = catPosts.length;

        if (catPosts.length > 4) {
            if (moreBtn) moreBtn.classList.remove("hidden");
        } else {
            if (moreBtn) moreBtn.classList.add("hidden");
        }

        const displayPosts = expandState[key] ? catPosts : catPosts.slice(0, 4);
        grid.innerHTML = "";

        if (displayPosts.length === 0) {
            grid.innerHTML = `<div class="text-slate-400 text-xs font-medium py-6 pl-2">ยังไม่มีผลงานที่ได้รับการอนุมัติในหมวดหมู่นี้...</div>`;
            return;
        }

        displayPosts.forEach(post => {
            const card = document.createElement("div");
            card.className = "w-[260px] md:w-[280px] bg-white border border-slate-100 rounded-2xl p-3.5 space-y-3 shrink-0 snap-start shadow-xs hover:shadow-md hover:border-slate-200/60 transition-all group cursor-pointer";
            
            let rawImg = post.image || post.imgLink || post.coverUrl || post.imageUrl || "";
            if (!rawImg && post.likedBy) rawImg = post.likedBy.image || "";
            const finalImg = convertDriveUrl(rawImg) || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500";

            let likeNum = 0;
            if (post.likedBy) {
                if (Array.isArray(post.likedBy)) likeNum = post.likedBy.length;
                else if (typeof post.likedBy === "object") likeNum = Object.keys(post.likedBy).filter(k => k !== "image" && k !== "status").length;
            }

            card.innerHTML = `
                <div class="aspect-video bg-slate-900 rounded-xl overflow-hidden relative border border-slate-100">
                    <img src="${finalImg}" class="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300" referrerpolicy="no-referrer">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                        <span class="bg-white/90 text-slate-800 text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-2xs">🔍 ดูรายละเอียด</span>
                    </div>
                </div>
                <div class="space-y-1">
                    <h3 class="font-black text-slate-800 text-xs truncate group-hover:text-orange-600 transition-colors">${post.title || "Untitled Work"}</h3>
                    <div class="flex items-center justify-between pt-1">
                        <p class="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">โดย: <span class="text-slate-600 font-bold">${post.ownerName || "Unknown"}</span></p>
                        <span class="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md">❤️ ${likeNum}</span>
                    </div>
                </div>
            `;

            card.onclick = () => openPortfolioModal(post);
            grid.appendChild(card);
        });
    });
};

// ================= 📂 MULTIMEDIA PORTFOLIO VIEW MODAL CONTROLLER =================
const portModal = document.getElementById("portfolio-modal");
const modalImg = document.getElementById("modal-img");
const modalVideo = document.getElementById("modal-video");
const modalCategory = document.getElementById("modal-category");
const modalTitle = document.getElementById("modal-title");
const modalDesc = document.getElementById("modal-desc");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalLikeBtn = document.getElementById("modal-like-btn");
const modalLikeCount = document.getElementById("modal-like-count");
const modalCommentCount = document.getElementById("modal-comment-count");
const modalCommentsContainer = document.getElementById("modal-comments-container");

const openPortfolioModal = async (post) => {
    if (!currentUserId) {
        if (authGuardModal) authGuardModal.classList.remove("hidden");
        return;
    }

    activePostId = post.id;
    if (portModal) portModal.classList.remove("hidden");

    if (modalCategory) modalCategory.innerText = post.category || "GENERAL";
    if (modalTitle) modalTitle.innerText = post.title || "Untitled Work";
    if (modalDesc) {
        modalDesc.innerHTML = `${post.description || 'ครีเอเตอร์ไม่ได้ระบุคำอธิบายผลงานเพิ่มเติมไว้...'}\n\n<button id="btn-reveal-contact" class="mt-3 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-600 text-[10px] font-black rounded-xl transition-all block">📞 คลิกดูข้อมูลติดต่อครีเอเตอร์</button>`;
        
        setTimeout(() => {
            const contactBtn = document.getElementById("btn-reveal-contact");
            if (contactBtn) contactBtn.onclick = () => fetchAndShowCreatorContact(post.ownerId);
        }, 50);
    }

    const videoUrl = post.video || post.videoLink || "";
    if (videoUrl) {
        if (modalImg) modalImg.classList.add("hidden");
        if (modalVideo) {
            modalVideo.classList.remove("hidden");
            modalVideo.src = convertDriveVideoUrl(videoUrl);
        }
    } else {
        if (modalVideo) {
            modalVideo.classList.add("hidden");
            modalVideo.src = "";
        }
        if (modalImg) {
            modalImg.classList.remove("hidden");
            let rawImg = post.image || post.imgLink || post.coverUrl || post.imageUrl || "";
            if (!rawImg && post.likedBy) rawImg = post.likedBy.image || "";
            modalImg.src = convertDriveUrl(rawImg) || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500";
        }
    }

    updateLikeUI(post);

    if (commentUnsubscribe) commentUnsubscribe();
    const commentsQuery = query(collection(db, "portfolios", post.id, "comments"), orderBy("createdAt", "asc"));
    commentUnsubscribe = onSnapshot(commentsQuery, (commentSnap) => {
        if (modalCommentsContainer) modalCommentsContainer.innerHTML = "";
        if (modalCommentCount) modalCommentCount.innerText = commentSnap.size;

        if (commentSnap.size === 0) {
            if (modalCommentsContainer) modalCommentsContainer.innerHTML = `<p class="text-[10px] text-slate-400 italic py-2">ยังไม่มีข้อความตอบกลับ มาร่วมแชร์ความเห็นกันคนแรกเลยครับ!</p>`;
            return;
        }

        commentSnap.forEach(cDoc => {
            const cData = cDoc.data();
            const cId = cDoc.id;
            const isOwner = cData.ownerId === currentUserId;
            const isAdmin = currentUserRole === "admin" || currentUserRole === "dev";

            const cDiv = document.createElement("div");
            cDiv.className = "bg-white border border-slate-100 p-2.5 rounded-xl space-y-1 shadow-2xs relative group/item";
            
            // ปุ่มจัดการ 3 จุดลบคอมเมนต์สำหรับแอดมินหรือเจ้าของคอมเมนต์
            let actionMenuHtml = "";
            if (isOwner || isAdmin) {
                actionMenuHtml = `
                    <div class="absolute right-2 top-2 opacity-0 group-hover/item:opacity-100 transition-opacity dropdown-comment">
                        <button class="text-slate-400 hover:text-slate-600 text-xs p-1" onclick="this.nextElementSibling.classList.toggle('hidden'); event.stopPropagation();">⋮</button>
                        <div class="hidden absolute right-0 mt-1 bg-white border border-slate-100 shadow-md rounded-lg py-1 w-20 z-50 text-center">
                            <button class="text-rose-500 hover:bg-rose-50 text-[10px] font-bold block w-full py-1 text-center btn-delete-comment" data-id="${cId}">ลบ</button>
                        </div>
                    </div>
                `;
            }

            cDiv.innerHTML = `
                <div class="flex items-center space-x-1.5">
                    <span class="text-[10px] font-bold text-slate-700">${cData.ownerName || "Anonymous"}</span>
                    <span class="text-[8px] text-slate-400 font-medium">${cData.createdAt ? new Date(cData.createdAt).toLocaleDateString('th-TH', {hour:'2-digit', minute:'2-digit'}) : ""}</span>
                </div>
                <p class="text-[11px] text-slate-500 font-medium leading-relaxed pr-6">${cData.text || ""}</p>
                ${actionMenuHtml}
            `;
            if (modalCommentsContainer) modalCommentsContainer.appendChild(cDiv);
        });

        // Event Listener สำหรับปุ่มลบคอมเมนต์
        document.querySelectorAll(".btn-delete-comment").forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const commentId = btn.getAttribute("data-id");
                if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบความคิดเห็นนี้?")) {
                    try {
                        await deleteDoc(doc(db, "portfolios", activePostId, "comments", commentId));
                        showToast("ลบความคิดเห็นสำเร็จเรียบร้อยแล้ว");
                    } catch (err) {
                        showToast("ไม่สามารถลบได้: " + err.message, "error");
                    }
                }
            };
        });

        if (modalCommentsContainer) modalCommentsContainer.scrollTop = modalCommentsContainer.scrollHeight;
    });
};

const updateLikeUI = (post) => {
    let likeNum = 0;
    let hasLiked = false;

    if (post.likedBy) {
        if (Array.isArray(post.likedBy)) {
            likeNum = post.likedBy.length;
            hasLiked = post.likedBy.includes(currentUserId);
        } else if (typeof post.likedBy === "object") {
            const keys = Object.keys(post.likedBy).filter(k => k !== "image" && k !== "status");
            likeNum = keys.length;
            hasLiked = !!post.likedBy[currentUserId];
        }
    }

    if (modalLikeCount) modalLikeCount.innerText = likeNum;
    if (modalLikeBtn) {
        if (hasLiked) {
            modalLikeBtn.innerHTML = `<span>❤️ ถูกใจผลงานแล้ว</span>`;
            modalLikeBtn.className = "flex items-center space-x-2 bg-rose-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all";
        } else {
            modalLikeBtn.innerHTML = `<span>🤍 ถูกใจผลงานนี้</span>`;
            modalLikeBtn.className = "flex items-center space-x-2 bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 rounded-xl border border-rose-200/50 text-xs font-bold transition-all";
        }
    }
};

if (modalCloseBtn) {
    modalCloseBtn.onclick = () => {
        if (portModal) portModal.classList.add("hidden");
        if (modalVideo) modalVideo.src = "";
        if (commentUnsubscribe) commentUnsubscribe();
        activePostId = null;
    };
}

const guardCloseBtn = document.getElementById("btn-close-auth-modal");
if (guardCloseBtn) {
    guardCloseBtn.onclick = () => { if (authGuardModal) authGuardModal.classList.add("hidden"); };
}

// ================= ⚙️ REALTIME SYSTEM LIKE ENGINE (เวอร์ชันเสถียรป้องกันการแครช) =================
if (modalLikeBtn) {
    modalLikeBtn.onclick = async () => {
        if (!activePostId) return;
        if (!currentUserId) {
            showToast("กรุณาเข้าสู่ระบบก่อนร่วมกดถูกใจให้ครีเอเตอร์นะครับ", "warning");
            if (authGuardModal) authGuardModal.classList.remove("hidden");
            return;
        }

        try {
            const postRef = doc(db, "portfolios", activePostId);
            const postSnap = await getDoc(postRef);
            if (!postSnap.exists()) return;

            const postData = postSnap.data();
            let currentLikes = postData.likedBy || {};

            // ตรวจสอบและแปลงประเภทข้อมูล ป้องกันความผิดพลาดของชนิดข้อมูล Array / Object ในฐานข้อมูลเก่า
            if (Array.isArray(currentLikes)) {
                let converted = {};
                currentLikes.forEach(uid => { if(uid) converted[uid] = true; });
                currentLikes = converted;
            } else if (typeof currentLikes !== "object") {
                currentLikes = {};
            }

            if (currentLikes[currentUserId]) {
                delete currentLikes[currentUserId];
                showToast("ยกเลิกการถูกใจแล้ว");
            } else {
                currentLikes[currentUserId] = true;
                showToast("คุณถูกใจผลงานชิ้นนี้ ✨");
            }

            await updateDoc(postRef, { likedBy: currentLikes });
            updateLikeUI({ id: activePostId, ...postData, likedBy: currentLikes });

        } catch (err) { 
            console.error(err); 
            showToast("ไม่สามารถกดไลก์ได้ในขณะนี้เนื่องจากปัญหาด้าน Permission", "error");
        }
    };
}

// ================= 💬 COMMENT POST SYSTEM =================
const commentForm = document.getElementById("modal-comment-form");
if (commentForm) {
    commentForm.onsubmit = async (e) => {
        e.preventDefault();
        const input = document.getElementById("modal-comment-input");
        if (!activePostId || !input.value.trim()) return;
        if (!currentUserId) return showToast("กรุณาเข้าสู่ระบบก่อนที่จะร่วมส่งความคิดเห็นครับ", "warning");

        try {
            await addDoc(collection(db, "portfolios", activePostId, "comments"), {
                ownerId: currentUserId,
                ownerName: currentUserName,
                ownerAvatar: currentUserAvatar,
                text: input.value.trim(),
                createdAt: new Date().toISOString()
            });
            input.value = "";
        } catch (err) { showToast("ล้มเหลวในการส่งคอมเมนต์: " + err.message, "error"); }
    };
}

// Systems View See More (แสดงงานทั้งหมด/ย่อลง)
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
            btn.innerText = expandState[key] ? "▲ ย่อลง" : "ดูทั้งหมด ➔";
            // สั่งล้างข้อมูลเพื่อรีเรนเดอร์จัดโครงกริดใหม่ทันทีแบบเรียลไทม์ โดยไม่ต้องรีโหลดหน้าเพจให้หน้าจอแวบกระตุก
            renderCategorizedGrids([]); 
            initRealtimePortfolios();
        };
    }
});

// ================= 📞 FETCH CREATOR CONTACT SYSTEM =================
const contactModal = document.getElementById("creator-contact-modal");
const contactCloseBtn = document.getElementById("contact-modal-close-btn");

const fetchAndShowCreatorContact = async (creatorUid) => {
    if (!creatorUid) return;
    try {
        const cSnap = await getDoc(doc(db, "users", creatorUid));
        if (cSnap.exists()) {
            const cData = cSnap.data();
            
            if (document.getElementById("contact-pop-name")) document.getElementById("contact-pop-name").innerText = cData.name || "Unknown Creator";
            if (document.getElementById("contact-pop-phone")) document.getElementById("contact-pop-phone").innerText = cData.phone || cData.tel || "-";
            if (document.getElementById("contact-pop-line")) document.getElementById("contact-pop-line").innerText = cData.line || cData.lineId || "-";

            const avArea = document.getElementById("contact-pop-avatar");
            const avImg = cData.avatarUrl || cData.avatar || "";
            if (avArea) {
                if (avImg.startsWith("http")) avArea.innerHTML = `<img src="${convertDriveUrl(avImg)}" class="w-full h-full object-cover">`;
                else avArea.innerHTML = `<div class="w-full h-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-lg">${(cData.name || "C").charAt(0).toUpperCase()}</div>`;
            }

            if (contactModal) contactModal.classList.remove("hidden");
        } else { showToast("ไม่พบข้อมูลติดต่อของครีเอเตอร์รายนี้ในระบบ", "error"); }
    } catch (err) { showToast("เกิดข้อผิดพลาด: " + err.message, "error"); }
};

if (contactCloseBtn) {
    contactCloseBtn.onclick = () => { if (contactModal) contactModal.classList.add("hidden"); };
}

// 🚀 รันระบบสตรีมข้อมูลขึ้นหน้าแรกแบบ Realtime ทันที
initRealtimePortfolios();
