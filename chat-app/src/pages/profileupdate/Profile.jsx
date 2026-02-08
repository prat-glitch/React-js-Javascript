import React, { useState, useContext, useEffect } from 'react';
import './profile.css';
import assets from '../../assets/assets';
import { toast } from "react-toastify";
import { useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Appcontext } from '../../context/Appcontext';
import { supabase } from '../../config/supabase';

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

    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    try {
      setUploading(true);

      let imageUrl = previmage; // Use existing image by default

      // Only upload if new image selected
      if (image) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${user.uid}_${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(filePath, image, {
            cacheControl: '3600',
            upsert: true
          });

        if (error) {
          toast.error("Failed to upload image");
          console.error(error);
          setUploading(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
        setUploadedUrl(imageUrl);
        setPrevImage(imageUrl);
      }

      await updateDoc(doc(db, "users", user.uid), {
        avatar: imageUrl,
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
