// login.js
import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. ระบบล็อกอินด้วย Email & Password แบบปกติ
const formLogin = document.getElementById("form-login");
if (formLogin) {
    formLogin.onsubmit = async (e) => {
        e.preventDefault();
        const emailVal = document.getElementById("login-email").value.trim();
        const passwordVal = document.getElementById("login-password").value;

        try {
            await signInWithEmailAndPassword(auth, emailVal, passwordVal);
            alert("🔒 เข้าสู่ระบบสำเร็จ!");
            window.location.href = "dashboard.html";
        } catch (error) {
            console.error("Login Error:", error);
            alert("❌ อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
        }
    };
}

// ฟังก์ชันดักเช็กข้อมูลสมาชิก เพื่อนำไปสร้างโปรไฟล์อัตโนมัติ (กรณีที่ยูสเซอร์เพิ่งเคยล็อกอินผ่าน Google ครั้งแรก)
async function handleSocialUserRecord(user) {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    // ถ้ายังไม่มีประวัติในคอลเลกชัน "users" เลย ให้สร้างชุดฟีลด์เริ่มต้นทันทีเพื่อป้องกันบักหน้าแอดมินพัง
    if (!userDoc.exists()) {
        await setDoc(userDocRef, {
            uid: user.uid,
            name: user.displayName || "Anonymous Creator",
            email: user.email || "",
            phone: "-",
            line: "-",
            role: "user",                // สิทธิ์ตั้งต้นเมื่อสมัครใหม่
            avatar: user.photoURL || "", // ดึงรูปประจำตัวของบัญชี Google มาใช้เป็นอวาตาร์แรกเริ่ม
            lastActive: new Date().getTime()
        });
    }
}

// 2. ระบบล็อกอินด้วย Google (Popup)
const btnGoogle = document.getElementById("btn-google-login");
if (btnGoogle) {
    btnGoogle.onclick = async () => {
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            // ส่งไปให้ฟังก์ชันช่วยเช็กประวัติข้อมูลสมาชิกในฐานข้อมูล
            await handleSocialUserRecord(result.user);
            
            alert("✨ เข้าสู่ระบบด้วย Google สำเร็จ!");
            window.location.href = "dashboard.html";
        } catch (error) {
            console.error("Google Auth Error:", error);
            alert("❌ ไม่สามารถเข้าสู่ระบบด้วย Google ได้: " + error.message);
        }
    };
}