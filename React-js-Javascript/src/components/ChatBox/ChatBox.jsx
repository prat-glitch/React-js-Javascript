import React, { useContext, useEffect, useRef, useState } from 'react'
import './ChatBox.css'
import assets from '../../assets/assets'
import { AppContext } from '../../context/AppContext';
import { arrayUnion, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { toast } from 'react-toastify';
import upload from '../../lib/upload';

const ChatBox = () => {
    const { userData, messagesId, chatUser, messages, setMessages, chatVisible, setChatVisible } = useContext(AppContext);
    const [input, setInput] = useState("");
    const scrollEnd = useRef();

    const sendMessage = async () => {
        try {
            if (input && messagesId) {
                await updateDoc(doc(db, "messages", messagesId), {
                    messages: arrayUnion({
                        sId: userData.id,
                        text: input,
                        createdAt: new Date()
                    })
                })
                const userIDs = [chatUser.rId, userData.id];
                userIDs.forEach(async (id) => {
                    const userChatsRef = doc(db, "chats", id);
                    const userChatsSnapshot = await getDoc(userChatsRef);
                    if (userChatsSnapshot.exists()) {
                        const userChatsData = userChatsSnapshot.data();
                        const chatIndex = userChatsData.chatsData.findIndex((c) => c.messageId === messagesId);
                        userChatsData.chatsData[chatIndex].lastMessage = input;
                        userChatsData.chatsData[chatIndex].updatedAt = Date.now();
                        if (userChatsData.chatsData[chatIndex].rId === userData.id) {
                            userChatsData.chatsData[chatIndex].messageSeen = false;
                        }
                        await updateDoc(userChatsRef, {
                            chatsData: userChatsData.chatsData,
                        });
                    }
                })
            }
        } catch (error) {
            toast.error(error.message)
        }
        setInput("")
    }

    const convertTimestamp = (timestamp) => {
        if (!timestamp) return "";
        let date = timestamp.toDate();
        const hour = date.getHours();
        const minute = date.getMinutes();
        const period = hour >= 12 ? 'PM' : 'AM';
        const formattedHour = hour % 12 || 12; // Converts 0 to 12
        const formattedMinute = minute < 10 ? '0' + minute : minute;
        return `${formattedHour}:${formattedMinute} ${period}`;
    }

    const sendImage = async (e) => {
        const fileUrl = await upload(e.target.files[0])
        if (fileUrl && messagesId) {
            await updateDoc(doc(db, "messages", messagesId), {
                messages: arrayUnion({
                    sId: userData.id,
                    image: fileUrl,
                    createdAt: new Date()
                })
            })
            const userIDs = [chatUser.rId, userData.id];
            userIDs.forEach(async (id) => {
                const userChatsRef = doc(db, "chats", id);
                const userChatsSnapshot = await getDoc(userChatsRef);
                if (userChatsSnapshot.exists()) {
                    const userChatsData = userChatsSnapshot.data();
                    const chatIndex = userChatsData.chatsData.findIndex((c) => c.messageId === messagesId);
                    userChatsData.chatsData[chatIndex].lastMessage = "Image";
                    userChatsData.chatsData[chatIndex].updatedAt = Date.now();
                    await updateDoc(userChatsRef, {
                        chatsData: userChatsData.chatsData,
                    });
                }
            })
        }
    }

    useEffect(() => {
        scrollEnd.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages])

    useEffect(() => {
        if (messagesId) {
            const unSub = onSnapshot(doc(db, "messages", messagesId), (res) => {
                setMessages(res.data().messages.reverse());
            });
            return () => {
                unSub();
            };
        }
    }, [messagesId]);

    // Check if chatUser and chatUser.userData exist before rendering
    if (!chatUser || !chatUser.userData) {
        return (
            <div className={`chat-welcome ${chatVisible ? "" : "hidden"}`}>
                <img src={assets.logo_icon} alt='' />
                <p>Chat anytime, anywhere</p>
            </div>
        )
    }

    return (
        <div className={`chat-box ${chatVisible ? "" : "hidden"}`}>
            <div className="chat-user">
                <img src={chatUser.userData.avatar || assets.profile_img} alt="" />
                <p>{chatUser.userData.name} {Date.now() - chatUser.userData.lastSeen <= 70000 ? <img className='dot' src={assets.green_dot} alt='' /> : null}</p>
                <img onClick={() => setChatVisible(false)} className='arrow' src={assets.arrow_icon} alt="" />
                <img className='help' src={assets.help_icon} alt="" />
            </div>
            <div className="chat-msg">
                <div ref={scrollEnd}></div>
                {
                    messages.map((msg, index) => {
                        // Check if userData and chatUser.userData exist before using them
                        if (!userData || !chatUser.userData) return null;
                        return (
                            <div key={index} className={msg.sId === userData.id ? "s-msg" : "r-msg"}>
                                {msg.image
                                    ? <img className='msg-img' src={msg.image} alt="" />
                                    : <p className="msg">{msg.text}</p>
                                }
                                <div>
                                    <img src={msg.sId === userData.id ? userData.avatar : chatUser.userData.avatar} alt="" />
                                    <p>{convertTimestamp(msg.createdAt)}</p>
                                </div>
                            </div>
                        )
                    })
                }
            </div>
            <div className="chat-input">
                <input onKeyDown={(e) => e.key === "Enter" ? sendMessage() : null} onChange={(e) => setInput(e.target.value)} value={input} type="text" placeholder='Send a message' />
                <input onChange={sendImage} type="file" id='image' accept="image/png, image/jpeg" hidden />
                <label htmlFor="image">
                    <img src={assets.gallery_icon} alt="" />
                </label>
                <img onClick={sendMessage} src={assets.send_button} alt="" />
            </div>
        </div>
    )
}

export default ChatBox