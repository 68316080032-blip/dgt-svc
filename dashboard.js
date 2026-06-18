// dashboard.js
import { db } from "./firebase-config.js";
import { collection, addDoc, onSnapshot, doc, deleteDoc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { convertDriveUrl } from "./utils.js";

// ดึงรายการผลงานเฉพาะของ User คนนั้นๆ มาแสดงใน Dashboard
export function fetchUserPortfolio(currentUser, userData) {
    if (!currentUser) return;
    onSnapshot(collection(db, "portfolios"), (snapshot) => {
        const grid = document.getElementById("dashboard-works-grid");
        if (!grid) return; 
        grid.innerHTML = "";
        
        snapshot.forEach(docData => {
            const data = docData.data();
            if (data.ownerId === currentUser.uid) {
                const itemBox = document.createElement("div");
                itemBox.className = "bg-neutral-900/60 p-3 rounded-2xl flex items-center justify-between border border-white/5";
                itemBox.innerHTML = `
                    <div class="flex items-center space-x-3 overflow-hidden">
                        <img src="${convertDriveUrl(data.image)}" class="w-10 h-10 rounded-xl object-cover">
                        <div class="truncate"><p class="text-xs font-bold text-white truncate">${data.title}</p></div>
                    </div>
                    <div class="flex items-center space-x-1 flex-shrink-0">
                        <button class="btn-edit-work text-[10px] bg-white/5 border border-white/5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-neutral-300">แก้ไข</button>
                        <button class="btn-delete-work text-[10px] bg-rose-500/10 border border-rose-500/10 px-2.5 py-1.5 rounded-xl hover:bg-rose-500/20 text-rose-400">ลบ</button>
                    </div>
                `;
                itemBox.querySelector(".btn-edit-work").onclick = () => openEditPortfolioModal(docData.id, data);
                itemBox.querySelector(".btn-delete-work").onclick = async () => {
                    if (confirm("ต้องการลบผลงานชิ้นนี้ใช่หรือไม่?")) {
                        await deleteDoc(doc(db, "portfolios", docData.id));
                        alert("ลบผลงานสำเร็จ");
                    }
                };
                grid.appendChild(itemBox);
            }
        });
    });
}

export function initUploadEngine(currentUser, userData) {
    const form = document.getElementById("form-portfolio-upload");
    if (!form) return;
    form.onsubmit = async (e) => {
        e.preventDefault();
        if (!currentUser) return alert("กรุณาเข้าสู่ระบบ");
        
        const payload = {
            title: document.getElementById("work-title").value,
            category: document.getElementById("work-category").value,
            image: document.getElementById("work-image").value,
            link: document.getElementById("work-link").value || "",
            license: document.getElementById("work-license").value,
            downloadLink: document.getElementById("work-download-link").value || "",
            ownerId: currentUser.uid,
            ownerName: userData?.name || currentUser.email.split('@')[0],
            status: "pending",
            likesCount: 0,
            likedBy: [],
            createdAt: new Date().toISOString()
        };
        
        await addDoc(collection(db, "portfolios"), payload);
        alert("ส่งอัปโหลดผลงานเรียบร้อย รอแอดมินตรวจสอบสำเร็จ!");
        form.reset();
    };
}

function openEditPortfolioModal(id, data) {
    document.getElementById("edit-work-id").value = id;
    document.getElementById("edit-work-title").value = data.title;
    document.getElementById("edit-work-category").value = data.category;
    document.getElementById("edit-work-image").value = data.image;
    document.getElementById("edit-work-link").value = data.link || "";
    document.getElementById("edit-work-download-link").value = data.downloadLink || "";
    document.getElementById("modal-portfolio-edit").classList.remove("hidden");
}

const formEdit = document.getElementById("form-portfolio-edit-submit");
if (formEdit) {
    formEdit.onsubmit = async (e) => {
        e.preventDefault();
        const updatePayload = {
            title: document.getElementById("edit-work-title").value,
            category: document.getElementById("edit-work-category").value,
            image: document.getElementById("edit-work-image").value,
            link: document.getElementById("edit-work-link").value,
            downloadLink: document.getElementById("edit-work-download-link").value
        };
        await updateDoc(doc(db, "portfolios", document.getElementById("edit-work-id").value), updatePayload);
        alert("แก้ไขข้อมูลเรียบร้อยแล้ว"); 
        document.getElementById("modal-portfolio-edit").classList.add("hidden");
    };
}

// เปิดและบันทึกข้อมูลหน้าแก้ไขโปรไฟล์ส่วนตัว ดึงและเซฟตัวแปร Facebook, IG, Tiktok
export async function openProfileModal(currentUser) {
    if (!currentUser) return;
    const uDoc = await getDoc(doc(db, "users", currentUser.uid));
    if (uDoc.exists()) {
        const data = uDoc.data();
        document.getElementById("db-avatar").value = data.avatar || "";
        document.getElementById("db-phone").value = data.phone || "";
        document.getElementById("db-line").value = data.line || "";
        document.getElementById("db-facebook").value = data.facebook || "";
        document.getElementById("db-instagram").value = data.instagram || "";
        document.getElementById("db-tiktok").value = data.tiktok || "";
        document.getElementById("db-other").value = data.other || "";
    }
    document.getElementById("modal-profile-update").classList.remove("hidden");
}

const formProfileUpdate = document.getElementById("form-profile-update");
if (formProfileUpdate) {
    formProfileUpdate.onsubmit = async (e) => {
        e.preventDefault();
        await setDoc(doc(db, "users", window.currentUser.uid), {
            avatar: document.getElementById("db-avatar").value,
            phone: document.getElementById("db-phone").value,
            line: document.getElementById("db-line").value,
            facebook: document.getElementById("db-facebook").value,
            instagram: document.getElementById("db-instagram").value,
            tiktok: document.getElementById("db-tiktok").value,
            other: document.getElementById("db-other").value
        }, { merge: true });
        alert("อัปเดตข้อมูลผู้ติดต่อและลิงก์โซเชียลมีเดียสำเร็จ!");
        document.getElementById("modal-profile-update").classList.add("hidden");
    };
}