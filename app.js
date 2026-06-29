// utils.js

// แปลงลิงก์รูปภาพ หรือดึง Thumbnail จาก Google Drive ให้แสดงผล 100%
export function convertDriveUrl(url) {
    if (!url) return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop";
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes("drive.google.com")) {
        let fileId = "";
        if (lowerUrl.includes("/file/d/")) {
            fileId = url.split("/file/d/")[1].split("/")[0];
        } else if (lowerUrl.includes("id=")) {
            fileId = url.split("id=")[1].split("&")[0];
        }
        if (fileId) {
            // 🛠️ แก้ไข: เปลี่ยนมาใช้ endpoint thumbnail และปรับขนาดให้ภาพชัดเจนขึ้น (sz=w1000) ป้องกันการโดนบล็อก
            return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
        }
    }
    return url;
}

// แปลงลิงก์วิดีโอ Google Drive ให้กลายเป็นหน้า Preview สำหรับสตรีมมิ่งบน iframe
export function convertDriveVideoUrl(url) {
    if (!url) return "";
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("drive.google.com")) {
        try {
            let fileId = "";
            if (lowerUrl.includes("/file/d/")) {
                fileId = url.split("/file/d/")[1].split("/")[0];
            } else if (lowerUrl.includes("id=")) {
                fileId = url.split("id=")[1].split("&")[0];
            }
            if (fileId) {
                return `https://drive.google.com/file/d/${fileId}/preview`;
            }
        } catch (err) { console.error(err); }
    }
    return url;
}

// ฟังก์ชันสลับหน้าจอ (Navigation)
export function navigateTo(viewName) {
    const views = ["gallery", "auth", "dashboard"];
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) {
            if (v === viewName) {
                el.classList.remove("hidden");
            } else {
                el.classList.add("hidden");
            }
        }
    });
    // เลื่อนหน้าจอกลับไปด้านบนสุดทุกครั้งที่เปลี่ยนหน้า
    window.scrollTo({ top: 0, behavior: "smooth" });
}