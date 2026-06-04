import React, { useState } from "react";
import axios from "axios";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "./firebase"; 

function Login({ onLogin }) {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const signInWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      // 1. Trigger Firebase Popup
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user; 
      
      // 2. Get the secure Firebase ID Token
      const idToken = await user.getIdToken();

      // 3. Send token to your Django backend
      const djangoRes = await axios.post("http://127.0.0.1:8000/api/google-login/", {
        idToken: idToken,
      });
      
      // 4. Store the Django Token and username for persistent session
      localStorage.setItem("token", djangoRes.data.token);
      localStorage.setItem("username", djangoRes.data.username);
      
      // 5. Update React state to enter the App
      onLogin(djangoRes.data.username);

    } catch (error) {
      setLoading(false);
      if (error.code === "auth/popup-closed-by-user") {
          console.log("Google Sign-In popup closed.");
      } else if (error.response?.data?.detail) {
          setError(`Login failed: ${error.response.data.detail}`);
      } else {
          setError(`Google Sign-In failed. Please try again.`);
          console.error("Google Sign-In Error:", error);
      }
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#121212" }}>
      <div style={{ padding: 40, background: "#1e1e1e", borderRadius: 24, border: "1px solid #333", textAlign: "center", width: "350px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
        <h1 style={{ color: "white", marginBottom: 10, fontWeight: "900", letterSpacing: "-1.5px", fontSize: "32px" }}>
          TASK<span style={{ color: "#00adb5" }}>HUB</span>
        </h1>
        <p style={{ color: "#888", fontSize: "14px", marginBottom: 30 }}>Efficient Collaboration Starts Here</p>
        
        {error && (
          <div style={{ background: "rgba(255, 77, 77, 0.1)", color: '#ff4d4d', padding: "10px", borderRadius: "8px", fontSize: "12px", marginBottom: "20px", border: "1px solid rgba(255, 77, 77, 0.2)" }}>
            {error}
          </div>
        )}
        
        <button 
          onClick={signInWithGoogle} 
          disabled={loading}
          style={{ 
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            background: 'white', 
            color: '#1a1a1a', 
            border: 'none', 
            padding: '14px', 
            borderRadius: 12, 
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: '700',
            fontSize: "15px",
            transition: "transform 0.2s",
            opacity: loading ? 0.7 : 1
          }}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="google" width="20" />
          {loading ? "Authenticating..." : "Continue with Google"}
        </button>

        <div style={{ marginTop: 30, color: "#444", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>
          Secure Enterprise Login
        </div>
      </div>
    </div>
  );
}

export default Login;