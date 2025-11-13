import { createApiKeyMiddleware } from "../../middleware/apikey.js";
import axios from "axios";
import crypto from "crypto";

const savetube = {
  api: {
    base: "https://media.savetube.me/api",
    cdn: "/random-cdn",
    info: "/v2/info",
    download: "/download",
  },
  headers: {
    accept: "*/*",
    "content-type": "application/json",
    origin: "https://m.youtube.com",
    referer: "https://m.youtube.com/",
    "user-agent": "Mozilla/5.0 (Linux; Android 11) YouTube/18.29.38 Mobile Safari/537.36"
  },
  crypto: {
    hexToBuffer: (hex) => Buffer.from(hex, "hex"),
    decrypt: async (enc) => {
      const secretKey = "9F1E7B8D3C5A9E4F7C2D1A6B8E4F3D2C"; // NUEVA KEY
      const data = Buffer.from(enc, "base64");
      const iv = data.slice(0, 16);
      const content = data.slice(16);
      const key = savetube.crypto.hexToBuffer(secretKey);

      const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
      let decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
      return JSON.parse(decrypted.toString());
    },
  },
  youtube: (url) => {
    const patterns = [
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /shorts\/([a-zA-Z0-9_-]{11})/
    ];
    for (let r of patterns) if (r.test(url)) return url.match(r)[1];
    return null;
  },
  request: async (endpoint, data = {}, method = "post") => {
    try {
      const { data: response } = await axios({
        method,
        url: `${endpoint.startsWith("http") ? "" : savetube.api.base}${endpoint}`,
        data,
        headers: savetube.headers,
        timeout: 8000 // más rápido
      });
      return response;
    } catch (e) {
      return null;
    }
  },
  getCDN: async () => {
    const r = await savetube.request(savetube.api.cdn, {}, "get");
    return r?.cdn || null;
  },
};

export default (app) => {

  app.get("/download/ytplay", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { url, format = "mp3", quality = "128" } = req.query;
      if (!url) return res.status(400).json({ status: false, error: "URL required" });

      const id = savetube.youtube(url);
      if (!id) return res.status(400).json({ status: false, error: "Invalid YouTube URL" });

      const cdn = await savetube.getCDN();
      if (!cdn) return res.status(500).json({ status: false, error: "CDN error" });

      const info = await savetube.request(`https://${cdn}${savetube.api.info}`, { url: `https://www.youtube.com/watch?v=${id}` });
      const decrypted = await savetube.crypto.decrypt(info.data);

      const dl = await savetube.request(`https://${cdn}${savetube.api.download}`, {
        id,
        downloadType: format === "mp4" ? "video" : "audio",
        quality,
        key: decrypted.key
      });

      const result = {
        title: decrypted.title,
        channel: decrypted.channelTitle,
        views: decrypted.viewCount?.toLocaleString() || "Unknown",
        published: decrypted.publishDate || "Unknown",
        duration: decrypted.duration ? `${Math.floor(decrypted.duration / 60)}:${String(decrypted.duration % 60).padStart(2, "0")}` : "Unknown",
        thumbnail: decrypted.thumbnail,
        youtube_url: `https://youtube.com/watch?v=${id}`,
        download_url: dl?.data?.downloadUrl || null,
        requested_format: format,
        requested_quality: quality,
        available_formats: decrypted.formats?.map(f => ({
          type: f.mimeType.includes("audio") ? "audio" : "video",
          quality: f.qualityLabel || f.audioQuality || "Unknown",
          size: f.filesize ? `${(f.filesize / 1024 / 1024).toFixed(2)} MB` : "Unknown"
        })) || []
      };

      return res.json({ status: true, code: 200, result });

    } catch (e) {
      return res.status(500).json({ status: false, error: e.message });
    }
  });

};