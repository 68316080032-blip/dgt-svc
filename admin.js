// admin.js
import { db } from "./firebase-config.js";
import { collection, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ดึงผลงานที่รอการอนุมัติ (Status: pending)
export function fetchAdminPendingWorks() {
    onSnapshot(collection(db, "portfolios"), (snapshot) => {
        const grid = document.getElementById("admin-pending-grid");
        if (!grid) return; 
        grid.innerHTML = "";
        
        snapshot.forEach(docData => {
            const data = docData.data();
            if (data.status === "pending") {
                const box = document.createElement("div");
                box.className = "bg-neutral-900 border p-3 rounded-2xl flex items-center justify-between";
                box.innerHTML = `
                    <span class="text-xs text-white truncate">${data.title}</span>
                    <button class="bg-amber-500 text-black text-xs px-3 py-1.5 rounded-xl">อนุมัติ</button>
                `;
                box.querySelector("button").onclick = async () => {
                    await updateDoc(doc(db, "portfolios", docData.id), { status: "approved" });
                    alert("อนุมัติงานชิ้นนี้แล้ว");
                };
                grid.appendChild(box);
            }
        });
    });
}