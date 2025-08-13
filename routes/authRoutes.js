import express from "express";
import { dropboxService } from "../services/dropboxService.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

router.get("/getauth", async (req, res) => {
  try {
    const authUrl = await dropboxService.getAuthenticationUrl();
    res.redirect(authUrl);
  } catch (error) {
    logger.error("Error generating auth URL:", error);
    res.status(500).send("Error generating Dropbox auth URL.");
  }
});

router.get("/auth", async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send("Missing authorization code from Dropbox.");
  }

  try {
    await dropboxService.exchangeCodeForToken(code);
    res.send("Authorization successful! You can close this tab now.");
  } catch (error) {
    logger.error("Error exchanging code for token:", error);
    res.status(500).send("Error exchanging code for token.");
  }
});

export default router;


