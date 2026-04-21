import React, { useState, useContext, useEffect } from 'react';
import assets from '../../assets/assets';
import { toast } from "react-toastify";
import { useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Appcontext } from '../../context/Appcontext';
import { supabase } from '../../config/supabase';

const Profile = () => {
  const navigate = useNavigate();
  const { user, loaduserdata } = useContext(Appcontext);
  const [image, setImage] = useState(null);
  const [previmage, setPrevImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");

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
    if (!user) { toast.error("User not logged in"); return; }
    if (!name.trim()) { toast.error("Please enter your name"); return; }

    try {
      setUploading(true);
      let imageUrl = previmage; 

      if (image) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${user.uid}_${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;
        const { error } = await supabase.storage.from('avatars').upload(filePath, image, { cacheControl: '3600', upsert: true });
        if (error) { toast.error("Failed to upload image"); setUploading(false); return; }
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        imageUrl = urlData.publicUrl;
        setPrevImage(imageUrl);
      }

      await updateDoc(doc(db, "users", user.uid), {
        avatar: imageUrl,
        username: name.trim(),
        bio: bio.trim(),
        profileCompleted: true,
        online: true,
        lastseen: new Date().toLocaleString(),
      });

      // Update the local react state to immediately satisfy Chat validation
      // We will call the standard context load to populate all global references correctly
      if (loaduserdata) {
         await loaduserdata(user.uid);
      }

      toast.success("Profile saved!");
      navigate("/chat");
    } catch (error) { toast.error("Something went wrong"); }
    finally { setUploading(false); }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      {/* Decorative background logo */}
      <img src={assets.logo_icon} className="absolute -top-12 -right-12 w-64 h-64 text-slate-100 opacity-5" alt="" />
      
      <div className="w-full max-w-[1000px] h-[750px] bg-white rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.08)] flex overflow-hidden border border-slate-50">
        
        {/* Left Side: Avatar & Bio */}
        <div className="w-full md:w-[400px] bg-white border-r border-slate-50 flex flex-col items-center py-16 px-12">
          <div className="relative group mb-10">
            <div className="w-48 h-48 rounded-[3.5rem] overflow-hidden border-8 border-white shadow-2xl relative z-10 transition-transform hover:scale-105 duration-500">
              <img src={image ? URL.createObjectURL(image) : previmage || assets.avatar_icon} className="w-full h-full object-cover" alt="avatar" />
            </div>
            <label htmlFor="avatar" className="absolute -bottom-2 -right-2 z-20 w-14 h-14 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl cursor-pointer hover:bg-blue-700 transition-all hover:rotate-12">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
               <input onChange={(e) => setImage(e.target.files[0])} type="file" id="avatar" accept=".png, .jpg, .jpeg" hidden />
            </label>
          </div>

          <h3 className="text-3xl font-extrabold text-slate-800 mb-2 truncate max-w-full">{name || "Your Identity"}</h3>
          <p className="text-slate-400 font-medium text-center leading-relaxed">
            {bio || "Tap into the fluidity of your profile. Share your essence with the world."}
          </p>

          <div className="mt-auto w-full">
            <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100/50">
              <h4 className="text-sm font-bold text-blue-600 mb-1 uppercase tracking-widest">Profile Status</h4>
              <p className="text-slate-500 text-sm">Synchronized with Fluid Cloud</p>
            </div>
          </div>
        </div>

        {/* Right Side: Account Details Form */}
        <div className="flex-1 bg-slate-50/30 flex flex-col p-16">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-4xl font-extrabold text-slate-800 tracking-tight">Account Settings</h2>
              <p className="text-slate-400 mt-2 font-medium">Manage your digital presence</p>
            </div>
            <button onClick={() => navigate('/chat')} className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-4">Full Name</label>
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-8 py-5 bg-white border border-slate-100 rounded-3xl shadow-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all text-slate-700 font-medium"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-4">About Yourself</label>
              <textarea
                placeholder="Bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                required
                rows="4"
                className="w-full px-8 py-5 bg-white border border-slate-100 rounded-3xl shadow-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all text-slate-700 font-medium resize-none"
              ></textarea>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
               <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 group hover:bg-blue-50 transition-colors cursor-pointer">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  </div>
                  <span className="font-bold text-slate-700">Security</span>
               </div>
               <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 group hover:bg-blue-50 transition-colors cursor-pointer">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                  </div>
                  <span className="font-bold text-slate-700">Alerts</span>
               </div>
            </div>

            <button 
              type="submit" 
              disabled={uploading} 
              className="mt-6 w-full py-5 bg-blue-600 text-white rounded-[2.5rem] font-extrabold text-lg shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:bg-slate-300"
            >
              {uploading ? "Updating Registry..." : "Confirm Changes"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Profile;
