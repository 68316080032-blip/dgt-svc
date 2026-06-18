// utils.js

// แปลงลิงก์รูปภาพ หรือดึง Thumbnail จาก Google Drive
export function convertDriveUrl(url) {
    if (!url) return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe";
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("drive.google.com/file/d/")) {
        try {
            const fileId = url.split("/file/d/")[1].split("/")[0];
            return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
        } catch (err) { return url; }
    }
    return url;
}

// แปลงลิงก์วิดีโอ Google Drive ให้กลายเป็นหน้า Preview สำหรับสตรีมมิ่ง
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
        const element = document.getElementById(`view-${v}`);
        if (element) element.classList.add("hidden");
    });
    const targetElement = document.getElementById(`view-${viewName}`);
    if (targetElement) targetElement.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: 'smooth' });
}