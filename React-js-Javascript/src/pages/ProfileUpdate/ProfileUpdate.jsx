import React, { useContext, useEffect, useState } from "react";
import "./ProfileUpdate.css";
import assets from "../../assets/assets";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "react-toastify";
import { AppContext } from "../../context/AppContext";
import ImageKit from "imagekit-javascript";

// ✅ Upload function with fresh ImageKit instance
const upload = async (file) => {
  if (!file) return null;
  try {
    const ik = new ImageKit({
      publicKey: "public_QNONAWZ6yKSuzoKyG1Ruo3u8cX8=",
      urlEndpoint: "https://ik.imagekit.io/prat123/",
      authenticationEndpoint: "http://localhost:3001/auth", // backend auth
    });

    const response = await ik.upload({
      file,
      fileName: file.name,
      folder: "/profile_Pics", // optional folder
    });

    return response.url;
  } catch (error) {
    console.error("ImageKit Upload Error:", error);
    toast.error("Image upload failed!");
    return null;
  }
};

const ProfileUpdate = () => {
  const [image, setImage] = useState(null);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [uid, setUid] = useState("");
  const [prevImage, setPrevImage] = useState("");
  const { setUserData } = useContext(AppContext);
  const navigate = useNavigate();

  // ✅ Save Profile
  const profileUpdate = async (event) => {
    event.preventDefault();
    try {
      if (!prevImage && !image) {
        toast.error("Upload profile picture");
        return;
      }

      const docRef = doc(db, "users", uid);
      let newImageUrl = prevImage;

      if (image) {
        newImageUrl = await upload(image);
        if (!newImageUrl) return; // stop if upload failed
      }

      await updateDoc(docRef, {
        avatar: newImageUrl,
        bio,
        username,
      });

      const snap = await getDoc(docRef);
      setUserData(snap.data());
      toast.success("Profile updated!");
      navigate("/chat");
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error(error.message);
    }
  };

  // ✅ Load Profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUid(user.uid);
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data();
        if (data) {
          setUsername(data.username || "");
          setBio(data.bio || "");
          setPrevImage(data.avatar || "");
        }
      } else {
        navigate("/");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  return (
    <div className="profile">
      <div className="profile-container">
        <form onSubmit={profileUpdate}>
          <h3>Profile Details</h3>

          {/* Upload Avatar */}
          <label htmlFor="avatar" className="upload-label">
            <input
              onChange={(e) => setImage(e.target.files[0])}
              id="avatar"
              type="file"
              accept=".png, .jpg, .jpeg"
              hidden
            />
            <img
              src={image ? URL.createObjectURL(image) : prevImage || assets.avatar_icon}
              alt="avatar preview"
              className="avatar-preview"
            />
            <span>Upload Profile Image</span>
          </label>

          {/* Username */}
          <input
            onChange={(e) => setUsername(e.target.value)}
            value={username}
            placeholder="Your name"
            type="text"
            required
          />

          {/* Bio */}
          <textarea
            onChange={(e) => setBio(e.target.value)}
            value={bio}
            placeholder="Write profile bio"
            required
          />

          <button type="submit">Save</button>
        </form>

        {/* Right Side Profile Image */}
        <img
          className="profile-pic"
          src={image ? URL.createObjectURL(image) : prevImage || assets.logo_icon}
          alt="profile"
        />
      </div>
    </div>
  );
};

export default ProfileUpdate;
