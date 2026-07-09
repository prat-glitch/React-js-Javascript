import React, { useContext, useRef, useState } from "react"
import assets from "../../assets/assets"
import { useNavigate } from "react-router-dom"
import { Appcontext } from "../../context/Appcontext"
import { getSupabase, supabase as publicSupabase } from "../../config/supabase"
import { toast } from "react-toastify"

const ContactsList = ({ activeTab, allUsers, userdata, handleSelectUser }) => {
  const navigate = useNavigate();
  const { loaduserdata } = useContext(Appcontext);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !userdata) return;
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${userdata.uid}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      const { error } = await getSupabase().storage.from('avatars').upload(filePath, file, { cacheControl: '3600', upsert: true });
      if (error) { toast.error("Failed to upload image"); return; }
      
      const { data: urlData } = publicSupabase.storage.from('avatars').getPublicUrl(filePath);
      const imageUrl = urlData.publicUrl;
      
      await getSupabase().from('users').update({ avatar: imageUrl }).eq('uid', userdata.uid);
      if (loaduserdata) {
        await loaduserdata(userdata.uid);
      }
      toast.success("Avatar updated!");
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setUploading(false);
    }
  };
  if (activeTab === "settings") {
    return (
      <div className="absolute top-0 left-24 lg:left-[280px] right-[-100vw] bottom-0 z-50 bg-white text-slate-800 overflow-y-auto flex pl-0 w-[100vw] lg:w-[calc(100vw-280px)] lg:right-auto max-w-[1400px]">
        <div className="w-full flex flex-col p-8 lg:p-14 max-w-6xl">
          <div className="flex items-center gap-8 mb-16">
            <div className="relative">
              <div className={`w-24 h-24 rounded-full border-4 border-slate-50 shadow-sm overflow-hidden ${uploading ? 'opacity-50' : ''}`}>
                <img src={userdata?.avatar || assets.avatar_icon} alt="" className="w-full h-full object-cover" />
              </div>
              <button 
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white shadow-sm hover:bg-blue-700 transition-colors cursor-pointer disabled:bg-slate-400"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarChange} 
                accept=".png, .jpg, .jpeg" 
                className="hidden" 
              />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">{userdata?.username}</h1>
              <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Active now
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
            <div className="flex flex-col gap-6">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-2">
                <div onClick={() => navigate('/profile')} className="p-4 hover:bg-white cursor-pointer rounded-xl flex items-center justify-between group text-slate-700 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-sm">Account Settings</span>
                  </div>
                </div>
                <div className="h-px bg-slate-200/50 mx-4"></div>
                <div className="p-4 hover:bg-white cursor-pointer rounded-xl flex items-center justify-between group text-slate-700 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-sm">Privacy & Security</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-2">
                <div className="p-4 hover:bg-white cursor-pointer rounded-xl flex items-center justify-between group text-slate-700 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-sm">Notifications</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-6">
              <div className="bg-blue-600 rounded-2xl p-8 text-white relative overflow-hidden shadow-sm">
                <h3 className="text-xl font-semibold mb-2 relative z-10">Pro Member</h3>
                <button className="bg-white text-blue-600 px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors relative z-10">Manage Subscription</button>
              </div>
              
              <div className="bg-slate-50 border border-slate-100 text-slate-700 rounded-2xl p-6">
                <h3 className="font-semibold text-sm mb-3">Support</h3>
                <button className="block text-slate-500 hover:text-slate-700 text-sm transition-colors">Help Center</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (activeTab === "contacts") {
    return (
      <div className="absolute top-0 left-24 lg:left-[280px] right-[-100vw] bottom-0 z-50 bg-white text-slate-800 overflow-y-auto flex pl-0 w-[100vw] lg:w-[calc(100vw-280px)] lg:right-auto max-w-[1400px]">
        <div className="w-full flex flex-col p-8 lg:p-14 max-w-6xl">
          <div className="flex flex-col lg:flex-row justify-between lg:items-end mb-12 gap-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-1">Directory</h1>
              <p className="text-slate-500 font-medium text-sm">{allUsers.length} active connections</p>
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 w-fit transition-colors shadow-sm">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
              New Contact
            </button>
          </div>
          
          <div className="flex flex-col gap-10 lg:gap-14">
            {"ABC".split("").map((letter, letterIdx) => {
              const groupUsers = allUsers.filter((u, idx) => idx % 3 === letterIdx)
              if (groupUsers.length === 0 && letter !== "A") return null
              return (
                <div key={letter} className="relative pl-8 border-l border-slate-200">
                  <div className="absolute left-[-17px] top-4 w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">{letter}</div>
                  
                  <div className="flex flex-wrap gap-4">
                    {groupUsers.map((u, i) => (
                      <div
                        key={i}
                        onClick={() => handleSelectUser(u)}
                        className="bg-white text-slate-800 rounded-xl p-4 flex items-center gap-4 group cursor-pointer border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all min-w-[280px]"
                      >
                        <div className="w-[50px] h-[50px] rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
                          <img src={u.avatar || assets.avatar_icon} className="w-full h-full object-cover" alt="" />
                        </div>
                        <div className="flex flex-col justify-center">
                          <h4 className="font-semibold text-[15px] leading-tight text-slate-800 group-hover:text-blue-600 transition-colors">{u.username}</h4>
                          <p className="text-[12px] font-medium text-slate-500 mt-0.5">{u.email?.split("@")[0] || "Member"}</p>
                        </div>
                        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-all">
                          <button className="bg-blue-50 text-blue-600 p-2 rounded-lg hover:bg-blue-100 transition-colors">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                    {letter === "A" && (
                      <div className="bg-slate-50 text-slate-500 border border-slate-200 border-dashed rounded-xl p-4 flex items-center gap-4 min-w-[280px] cursor-pointer hover:bg-slate-100 transition-all group">
                        <div className="w-[50px] h-[50px] rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-300 transition-colors">
                          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        </div>
                        <div className="font-medium text-sm tracking-wide">Add to "{letter}" Group</div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default ContactsList
