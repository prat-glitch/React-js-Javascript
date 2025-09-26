import React, { useState } from "react";
import ImageKit from "imagekit-javascript";

export default function TestUpload() {
  const [url, setUrl] = useState("");

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const ik = new ImageKit({
        publicKey: "public_QNONAWZ6yKSuzoKyG1Ruo3u8cX8=",
        urlEndpoint: "https://ik.imagekit.io/prat123/",
        authenticationEndpoint: "http://localhost:3001/auth",
      });

      const res = await ik.upload({
        file,
        fileName: file.name,
      });

      console.log("Upload Success:", res);
      setUrl(res.url);
    } catch (err) {
      console.error("Upload Failed:", err);
    }
  };

  return (
    <div>
      <h2>Test Image Upload</h2>
      <input type="file" onChange={handleUpload} />
      {url && <img src={url} alt="uploaded" style={{ width: 200 }} />}
    </div>
  );
}
