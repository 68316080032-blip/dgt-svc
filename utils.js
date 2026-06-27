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

// =========================================================================
// 🔍 🌟 ระบบคัดกรองถ้อยคำไม่เหมาะสมอัตโนมัติ (Profanity Filter Engine)
// =========================================================================

// คลังคำหยาบหลัก (ไทย-อังกฤษ) สามารถพิมพ์เพิ่มคำในอาร์เรย์นี้ได้ตลอดเวลาครับ
const PROFANITY_DICT = [
    // ภาษาไทย
    "ควย", "เย็ด", "เหี้ย", "สัส", "ชาติต้น", "ระยำ", "มึง", "กู", "แรด", "ตอแหล", "ดอกทอง", "ชิบหาย", "ฉิบหาย", "จัญไร", "กาลกิณี", "หน้าหี", "หน้าควย", "ไอปัญญาอ่อน", "ควาย", "อีควาย", "ไอ้ควาย", "สถด",
    // ภาษาอังกฤษ
    "fuck", "shit", "bitch", "asshole", "bastard", "dick", "pussy", "cunt", "whore", "slut", "fucker", "motherfucker", "crap", "wanker"
];

/**
 * ฟังก์ชันตรวจสอบคำหยาบในข้อความ
 * @param {string} text - ข้อความที่ต้องการให้ระบบเข้าไปสแกนหาคำหยาบ
 * @returns {boolean} - คืนค่า true หากพบคำหยาบแม้แต่คำเดียว, คืนค่า false ถ้าปลอดภัย
 */
export function containsProfanity(text) {
    if (!text) return false;
    
    // แปลงเป็นพิมพ์เล็ก ลบเว้นวรรค และสัญลักษณ์พิเศษออก เพื่อป้องกันผู้ใช้งานพิมพ์เลี่ยงคำ (เช่น ค_ว_ย หรือ f-u-c-k)
    const cleanText = text.toLowerCase().replace(/[\s\-_.]/g, "");
    
    // ค้นหาคำหยาบ
    for (const word of PROFANITY_DICT) {
        if (cleanText.includes(word.toLowerCase())) {
            return true; 
        }
    }
    return false;
}
