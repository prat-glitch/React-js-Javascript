import React from "react"
import assets from "../../assets/assets"

const ContactsList = ({ activeTab, allUsers, userdata, handleSelectUser, isUserOnline }) => {
  if (activeTab === "settings") {
    return (
      <div className="absolute top-0 left-24 lg:left-[280px] right-[-100vw] bottom-0 z-50 bg-[#060814] text-white overflow-y-auto flex pl-0 w-[100vw] lg:w-[calc(100vw-280px)] lg:right-auto max-w-[1400px]">
        <div className="w-full flex flex-col p-8 lg:p-14 max-w-6xl">
          <div className="flex items-center gap-8 mb-16">
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-pink-500 to-orange-400 p-1">
                <img src={userdata?.avatar || assets.avatar_icon} alt="" className="w-full h-full rounded-[22px] object-cover border-2 border-transparent" />
              </div>
              <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center border-2 border-[#060814]">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
              </button>
            </div>
            <div>
              <h1 className="text-4xl font-extrabold text-blue-500 mb-2 tracking-tight">{userdata?.username}</h1>
              <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                Active now
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
            <div className="flex flex-col gap-6">
              <div className="bg-white rounded-3xl p-2">
                <div className="p-4 hover:bg-slate-50 cursor-pointer rounded-2xl flex items-center justify-between group text-slate-800">
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-sm">Account</span>
                  </div>
                </div>
                <div className="h-px bg-slate-100 mx-4"></div>
                <div className="p-4 hover:bg-slate-50 cursor-pointer rounded-2xl flex items-center justify-between group text-slate-800">
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-sm">Privacy & Security</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-3xl p-2">
                <div className="p-4 hover:bg-slate-50 cursor-pointer rounded-2xl flex items-center justify-between group text-slate-800">
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-sm">Notifications</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-6">
              <div className="bg-[#1d4ed8] rounded-3xl p-8 text-white relative overflow-hidden">
                <h3 className="text-xl font-bold mb-2 relative z-10">Pro Member</h3>
                <button className="bg-white text-blue-600 px-6 py-3 rounded-2xl font-bold text-sm hover:shadow-lg transition-all relative z-10">Manage Subscription</button>
              </div>
              
              <div className="bg-white text-slate-800 rounded-3xl p-6">
                <h3 className="font-bold text-sm mb-4">Support</h3>
                <button className="block text-slate-500 mb-2">Help Center</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (activeTab === "contacts") {
    return (
      <div className="absolute top-0 left-24 lg:left-[280px] right-[-100vw] bottom-0 z-50 bg-[#060814] text-white overflow-y-auto flex pl-0 w-[100vw] lg:w-[calc(100vw-280px)] lg:right-auto max-w-[1400px]">
        <div className="w-full flex flex-col p-8 lg:p-14 max-w-6xl">
          <div className="flex flex-col lg:flex-row justify-between lg:items-end mb-16 gap-6">
            <div>
              <h1 className="text-4xl lg:text-[56px] font-black text-blue-600 tracking-tight lg:leading-[1.1] mb-2">Directory</h1>
              <p className="text-slate-400 font-medium text-sm ml-1">{allUsers.length} active connections</p>
            </div>
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-2.5 w-fit transition-all shadow-[0_10px_25px_rgba(37,99,235,0.3)]">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
              New Contact
            </button>
          </div>
          
          <div className="flex flex-col gap-12 lg:gap-16">
            {"ABC".split("").map((letter, letterIdx) => {
              const groupUsers = allUsers.filter((u, idx) => idx % 3 === letterIdx)
              if (groupUsers.length === 0 && letter !== "A") return null
              return (
                <div key={letter} className="relative pl-10 border-l-2 border-[#1a1f36]">
                  <div className="absolute left-[-17px] top-4 w-8 h-8 rounded-full bg-[#060814] border-2 border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{letter}</div>
                  
                  <div className="flex flex-wrap gap-5">
                    {groupUsers.map((u, i) => (
                      <div
                        key={i}
                        onClick={() => handleSelectUser(u)}
                        className="bg-white text-slate-800 rounded-[28px] p-2.5 pr-8 flex items-center gap-4 group cursor-pointer hover:-translate-y-1 transition-all h-[100px] min-w-[300px] shadow-sm hover:shadow-xl"
                      >
                        <div className="w-[80px] h-[80px] rounded-[22px] overflow-hidden bg-slate-100 flex-shrink-0 shadow-inner">
                          <img src={u.avatar || assets.avatar_icon} className="w-full h-full object-cover" alt="" />
                        </div>
                        <div className="flex flex-col justify-center">
                          <h4 className="font-extrabold text-[15px] leading-tight text-slate-800 group-hover:text-blue-600 transition-colors">{u.username}</h4>
                          <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{u.email?.split("@")[0] || "Member"}</p>
                        </div>
                        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                          <button className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                    {letter === "A" && (
                      <div className="bg-[#0b0e1e] text-slate-400 border border-slate-800 border-dashed rounded-[28px] p-2.5 flex items-center gap-4 h-[100px] min-w-[300px] cursor-pointer hover:bg-[#12172d] transition-all group">
                        <div className="w-[80px] h-[80px] rounded-[22px] bg-[#1a1f36] flex items-center justify-center flex-shrink-0 group-hover:bg-[#202742] transition-colors">
                          <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        </div>
                        <div className="font-bold text-sm tracking-wide">Add to "{letter}" Group</div>
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
