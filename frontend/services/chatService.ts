// Copyright (c) 2025 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.
import { CHAT_AGENT_URL } from "@/constants/Constants";
import { loadAuthDataFromSecureStore } from "@/utils/authTokenStore";
import { refreshAccessToken } from "@/services/authService";
import axios from "axios";
import dayjs from "dayjs";
import { jwtDecode } from "jwt-decode";

export interface ChatResponse {
  reply: string;
}

/**
 * Check whether the access token has expired (or is about to expire).
 */
const isAccessTokenExpired = (accessToken: string): boolean => {
  try {
    const decoded = jwtDecode<{ exp: number }>(accessToken);
    // Consider expired if within 30 seconds of expiry to avoid race conditions
    return dayjs.unix(decoded.exp).subtract(30, "second").isBefore(dayjs());
  } catch {
    return true; // Assume expired if decoding fails
  }
};

/**
 * Gets a valid (non-expired) access token, refreshing if necessary.
 */
const getValidAccessToken = async (): Promise<string> => {
  const authData = await loadAuthDataFromSecureStore();

  if (!authData?.accessToken) {
    throw new Error("No access token available. Please sign in.");
  }

  // If the token is still valid, use it directly
  if (!isAccessTokenExpired(authData.accessToken)) {
    return authData.accessToken;
  }

  // Token is expired — refresh it
  const newAuthData = await refreshAccessToken(async () => {
    // onLogout callback — just throw so the caller can handle it
    throw new Error("Session expired. Please sign in again.");
  });

  if (!newAuthData?.accessToken) {
    throw new Error("Failed to refresh access token. Please sign in again.");
  }

  return newAuthData.accessToken;
};

/**
 * Sends a chat message to the agent backend service.
 * Automatically refreshes the access token if expired before sending.
 *
 * @param message - The user's chat message.
 * @returns The agent's reply.
 */
export const sendChatMessage = async (
  message: string
): Promise<ChatResponse> => {
  const accessToken = await getValidAccessToken();

  const response = await axios.post<ChatResponse>(
    `${CHAT_AGENT_URL}/chat`,
    { message },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 30000, // 30 seconds — agent may take time to reason + call tools
    }
  );

  return response.data;
};
