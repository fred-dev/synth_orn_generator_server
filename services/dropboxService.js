import { Dropbox } from "dropbox";
import fetch from "node-fetch";
import fs from "fs";
import { config } from "../config/environment.js";
import { logger } from "../utils/logger.js";

class DropboxService {
  constructor() {
    this.dbx = new Dropbox({
      fetch,
      clientId: config.dropbox.clientId,
      clientSecret: config.dropbox.clientSecret,
      refreshToken: config.dropbox.refreshToken,
    });
  }

  async getAuthenticationUrl() {
    try {
      return await this.dbx.auth.getAuthenticationUrl(
        config.dropbox.redirectUri,
        null,
        "code",
        "offline",
        null,
        "none",
        false
      );
    } catch (error) {
      logger.error("Error generating auth URL:", error);
      throw error;
    }
  }

  async exchangeCodeForToken(code) {
    try {
      const tokenResponse = await this.dbx.auth.getAccessTokenFromCode(
        config.dropbox.redirectUri,
        code
      );
      
      const refreshToken = tokenResponse.result.refresh_token;
      this.dbx.auth.setRefreshToken(refreshToken);
      
      return await this.dbx.usersGetCurrentAccount();
    } catch (error) {
      logger.error("Error exchanging code for token:", error);
      throw error;
    }
  }

  async uploadFile(localFilePath, dropboxFolderPath, newFileName) {
    try {
      await this.dbx.auth.checkAndRefreshAccessToken();

      const fileContents = fs.readFileSync(localFilePath);
      const dropboxPath = `${dropboxFolderPath}/${newFileName}`;
      
      const response = await this.dbx.filesUpload({
        path: dropboxPath,
        contents: fileContents,
        mode: { ".tag": "add" },
      });

      logger.debug("Upload successful:", response.result);
      fs.unlinkSync(localFilePath);
      logger.debug("Local file deleted:", localFilePath);
      
      return response.result;
    } catch (error) {
      logger.error("Error uploading file:", error);
      throw error;
    }
  }
}

export const dropboxService = new DropboxService();

