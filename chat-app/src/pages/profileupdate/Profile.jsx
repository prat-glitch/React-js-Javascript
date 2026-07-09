import React, { useState, useContext, useEffect } from 'react';
import assets from '../../assets/assets';
import { toast } from "react-toastify";
import { useNavigate } from 'react-router-dom';
import { Appcontext } from '../../context/Appcontext';
import { getSupabase, supabase as publicSupabase } from '../../config/supabase';

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
        const { data, error } = await getSupabase().from('users').select('*').eq('uid', user.uid).single();
        if (!error && data) {
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
        // Using getSupabase() for auth'd upload
        const { error } = await getSupabase().storage.from('avatars').upload(filePath, image, { cacheControl: '3600', upsert: true });
        if (error) { toast.error("Failed to upload image"); setUploading(false); return; }
        const { data: urlData } = publicSupabase.storage.from('avatars').getPublicUrl(filePath);
        imageUrl = urlData.publicUrl;
        setPrevImage(imageUrl);
      }

      await getSupabase().from('users').update({
        avatar: imageUrl,
        username: name.trim(),
        bio: bio.trim(),
        profile_completed: true,
        lastseen: new Date().toLocaleString(),
      }).eq('uid', user.uid);

      if (loaduserdata) {
         await loaduserdata(user.uid);
      }

      toast.success("Profile saved!");
      navigate("/chat");
    } catch (error) { 
      toast.error("Something went wrong"); 
    }
    finally { setUploading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-0 md:p-6 lg:p-12 relative overflow-hidden">
      
      <div className="w-full h-[100dvh] md:h-auto max-w-[900px] md:min-h-[600px] bg-white md:rounded-2xl shadow-sm flex flex-col md:flex-row overflow-hidden md:border border-slate-200 overflow-y-auto">
        
        {/* Left Side: Avatar & Bio */}
        <div className="w-full md:w-[350px] bg-slate-50/50 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col items-center py-12 px-8">
          <div className="relative group mb-8">
            <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-white shadow-sm relative z-10 transition-transform hover:scale-105 duration-300">
              <img src={image ? URL.createObjectURL(image) : previmage || assets.avatar_icon} className="w-full h-full object-cover" alt="avatar" />
            </div>
            <label htmlFor="avatar" className="absolute -bottom-2 -right-2 z-20 w-12 h-12 bg-white text-blue-600 rounded-full flex items-center justify-center border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 hover:text-blue-700 transition-all">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
               <input onChange={(e) => setImage(e.target.files[0])} type="file" id="avatar" accept=".png, .jpg, .jpeg" hidden />
            </label>
          </div>

          <h3 className="text-2xl font-bold text-slate-800 mb-2 truncate max-w-full">{name || "Your Identity"}</h3>
          <p className="text-slate-500 text-sm text-center leading-relaxed">
            {bio || "Tell us a little bit about yourself."}
          </p>

          <div className="mt-auto w-full pt-8">
            <div className="p-4 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Status</span>
                <span className="text-slate-700 text-sm font-medium">Synchronized</span>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            </div>
          </div>
        </div>

        {/* Right Side: Account Details Form */}
        <div className="flex-1 bg-white flex flex-col p-8 md:p-12">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Account Settings</h2>
              <p className="text-slate-500 mt-1">Manage your digital presence</p>
            </div>
            <button onClick={() => navigate('/chat')} className="w-10 h-10 bg-white rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Full Name</label>
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-5 py-4 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-700 font-medium"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">About Yourself</label>
              <textarea
                placeholder="Bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                required
                rows="3"
                className="w-full px-5 py-4 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-700 font-medium resize-none"
              ></textarea>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
               <div className="p-4 bg-white rounded-xl border border-slate-200 flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer shadow-sm">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  </div>
                  <span className="font-medium text-slate-700 text-sm">Security</span>
               </div>
               <div className="p-4 bg-white rounded-xl border border-slate-200 flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer shadow-sm">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                  </div>
                  <span className="font-medium text-slate-700 text-sm">Alerts</span>
               </div>
            </div>

            <button 
              type="submit" 
              disabled={uploading} 
              className="mt-4 w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-base hover:bg-blue-700 transition-all disabled:bg-slate-300"
            >
              {uploading ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Profile;
