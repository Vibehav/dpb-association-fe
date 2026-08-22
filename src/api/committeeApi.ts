import { CommitteeMember } from "../types";
import { request } from "./client";

export const committeeApi = {
  list(token: string) {
    return request<CommitteeMember[]>("/committee", {}, token);
  },

  detail(token: string, id: string) {
    return request<CommitteeMember>(`/committee/${id}`, {}, token);
  },

  add(token: string, body: { name: string; phone: string; role: "ADMIN" | "COLLECTOR" | "VIEWER" }) {
    return request<CommitteeMember>("/committee", { method: "POST", body: JSON.stringify(body) }, token);
  },

  changeRole(token: string, id: string, role: "ADMIN" | "COLLECTOR" | "VIEWER") {
    return request<CommitteeMember>(`/committee/${id}`, { method: "PATCH", body: JSON.stringify({ role }) }, token);
  },

  resetPin(token: string, id: string) {
    return request<void>(`/committee/${id}/reset-pin`, { method: "POST" }, token);
  },

  remove(token: string, id: string) {
    return request<void>(`/committee/${id}`, { method: "DELETE" }, token);
  }
};
