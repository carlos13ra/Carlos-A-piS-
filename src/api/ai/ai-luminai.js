// chale ya me dió paja 😔

import axios from "axios";
import { createApiKeyMiddleware } from "../../middleware/apikey.js";

export default (app) => {
  async function fetchContent(prompt) {
    try {
      const response = await axios.post(
        "https://luminai.my.id/api",
        { prompt },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching content from LuminAI:", error.response?.data || error.message);
      throw new Error("Failed to fetch content from LuminAI");
    }
  }

  app.get("/ai/luminai", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { text } = req.query;
      if (!text || text.trim() === "") {
        return res.status(400).json({ status: false, error: "Text is required" });
      }

      const data = await fetchContent(text.trim());

      if (!data || !data.result) {
        return res.status(500).json({ status: false, error: "No result from LuminAI" });
      }

      res.status(200).json({
        status: true,
        result: data.result,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({ status: false, error: error.message });
    }
  });
};