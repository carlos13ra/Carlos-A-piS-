import axios from "axios"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

export default (app) => {

  async function scrapeSpotify(url) {
    try {

      const { data: first } = await axios.get(`https://api.fabdl.com/spotify/get?url=${encodeURIComponent(url)}`)
      if (!first?.result) throw new Error("No se pudo obtener información del track.")

      const info = first.result
      const trackId = info.type === "album" ? info.tracks[0].id : info.id
      const gid = info.type === "album" ? info.tracks[0].gid : info.gid

      const { data: convert } = await axios.get(`https://api.fabdl.com/spotify/mp3-convert-task/${gid}/${trackId}`)
      const tid = convert?.result?.task_id
      if (!tid) throw new Error("No se pudo iniciar la conversión.")

      let download = null
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1500))

        const { data: progress } = await axios.get(`https://api.fabdl.com/spotify/mp3-convert-progress/${tid}`)
        if (progress?.result?.status === "finished") {
          download = `https://api.fabdl.com${progress.result.download_url}`
          break
        }
      }

      if (!download) throw new Error("La conversión demoró demasiado, intenta de nuevo.")

      return {
        title: info.name,
        type: info.type,
        artists: info.artists,
        duration: info.type === "album" ? info.tracks[0].duration_ms : info.duration_ms,
        image: info.image,
        download,
        status: "finished",
      }

    } catch (err) {
      throw new Error("Spotify Download Failed: " + err.message)
    }
  }

  app.get("/download/spotify", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { url } = req.query
      if (!url) return res.status(400).json({ status: false, error: "URL missing" })

      const result = await scrapeSpotify(url.trim())
      res.json({ status: true, data: result, timestamp: new Date().toISOString() })

    } catch (err) {
      res.status(500).json({ status: false, error: err.message })
    }
  })

  app.post("/download/spotify", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { url } = req.body
      if (!url) return res.status(400).json({ status: false, error: "URL missing" })

      const result = await scrapeSpotify(url.trim())
      res.json({ status: true, data: result, timestamp: new Date().toISOString() })

    } catch (err) {
      res.status(500).json({ status: false, error: err.message })
    }
  })
}