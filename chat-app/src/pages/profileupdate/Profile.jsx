import React, { useState, useContext, useEffect } from 'react';
import './profile.css';
import assets from '../../assets/assets';
import ImageKit from 'imagekit-javascript';
import { toast } from "react-toastify";
import { useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Appcontext } from '../../context/AppContext';

const imagekit = new ImageKit({
  publicKey: "public_QNONAWZ6yKSuzoKyG1Ruo3u8cX8=",
  urlEndpoint: "https://ik.imagekit.io/prat123",
  authenticationEndpoint: "http://localhost:5000/auth"
});

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useContext(Appcontext);
  const [image, setImage] = useState(null);
  const [previmage, setPrevImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");

  // ✅ Fetch previous profile data on mount
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPrevImage(data.avatar || "");
          setName(data.username || "");
          setBio(data.bio || "");
        }
      } catch (err) {
        console.error("Failed to fetch user data:", err);
      }
    };

    fetchProfileData();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      toast.error("User not logged in");
      return;
    }

    if (!image) {
      toast.error("Please select an image first");
      return;
    }

    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    try {
      setUploading(true);

      const authRes = await fetch("http://localhost:5000/auth");
      const auth = await authRes.json();

      if (!auth.token || !auth.signature || !auth.expire) {
        toast.error("Failed to get ImageKit auth token");
        setUploading(false);
        return;
      }

      const result = await imagekit.upload({
        file: image,
        fileName: `${Date.now()}_${image.name}`,
        folder: "/profile_pics",
        token: auth.token,
        expire: auth.expire,
        signature: auth.signature,
      });

      setUploadedUrl(result.url);
      setPrevImage(result.url); 
      toast.success("Image uploaded successfully!");

      await updateDoc(doc(db, "users", user.uid), {
        avatar: result.url,
        username: name.trim(),
        bio: bio.trim(),
        profileCompleted: true,
      });

      toast.success("Profile saved!");
      navigate("/chat");

    } catch (error) {
      console.error(error);
      toast.error("Something went wrong while uploading");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="profile">
      <div className="profile-container">
        <form onSubmit={handleSubmit}>
          <h3>Profile Details</h3>

          <label htmlFor="avatar">
            <input
              onChange={(e) => setImage(e.target.files[0])}
              type="file"
              id="avatar"
              accept=".png, .jpg, .jpeg"
              hidden
            />
            <img
              src={image ? URL.createObjectURL(image) : previmage || assets.avatar_icon}
              alt="avatar"
            />
            Upload profile image
          </label>

          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <textarea
            placeholder="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            required
          ></textarea>

          <button type="submit" disabled={uploading}>
            {uploading ? "Uploading..." : "Save"}
          </button>
        </form>

        <img
          className="profile-pic"
          src={
            uploadedUrl ||
            (image ? URL.createObjectURL(image) :
              previmage || assets.logo_icon)
          }
          alt="preview"
        />
      </div>
    </div>
  );
};

export default Profile;
