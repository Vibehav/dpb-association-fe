import { AuthSession, Role } from "../types";
import { request } from "./client";

type TokenPairResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
};

type MeResponse = {
  id: string;
  name: string;
  role: "ADMIN" | "COLLECTOR" | "VIEWER";
};

export const authApi = {
  lookupPhone(phone: string) {
    return request<{ onCommittee: boolean; firstName: string | null; pinSet: boolean | null }>(
      "/auth/phone",
      {
        method: "POST",
        body: JSON.stringify({ phone })
      }
    );
  },

  async login(phone: string, pin: string): Promise<AuthSession> {
    const tokens = await request<TokenPairResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone, pin })
    });

    const me = await authApi.me(tokens.accessToken);

    return {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: me.id,
        name: me.name,
        phone,
        role: me.role.toLowerCase() as Role
      }
    };
  },

  async setPinAndLogin(phone: string, resetToken: string, newPin: string): Promise<AuthSession> {
    const tokens = await authApi.setPin(resetToken, newPin);
    const me = await authApi.me(tokens.accessToken);

    return {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: me.id,
        name: me.name,
        phone,
        role: me.role.toLowerCase() as Role
      }
    };
  },

  me(token: string) {
    return request<MeResponse>("/me", {}, token);
  },

  logout(refreshToken: string) {
    return request<void>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    });
  },

  requestOtp(phone: string, purpose: "FIRST_LOGIN" | "PIN_RESET") {
    return request<void>("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ phone, purpose })
    });
  },

  verifyOtp(phone: string, code: string) {
    return request<{ resetToken: string }>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code })
    });
  },

  setPin(resetToken: string, newPin: string) {
    return request<TokenPairResponse>("/auth/pin/set", {
      method: "POST",
      body: JSON.stringify({ resetToken, newPin })
    });
  },

  refresh(refreshToken: string) {
    return request<TokenPairResponse>("/auth/token/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    });
  },

  verifyPin(token: string, pin: string) {
    return request<void>(
      "/auth/verify-pin",
      {
        method: "POST",
        body: JSON.stringify({ pin })
      },
      token
    );
  }
};
