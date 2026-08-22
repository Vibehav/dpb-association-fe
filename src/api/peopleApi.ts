import { Person } from "../types";
import { titleCase } from "../utils/format";
import { request } from "./client";

export const peopleApi = {
  list(token: string, search = "") {
    return request<{
      content: Array<{
        id: string;
        name: string;
        phone: string;
        shops: Array<{ shopNumber: string; businessName: string; role: string }>;
      }>;
    }>(
      `/people?query=${encodeURIComponent(search)}&page=0&size=50`,
      {},
      token
    ).then((page) =>
      page.content.map<Person>((person) => ({
        id: person.id,
        name: person.name,
        phone: `+91 ${person.phone.slice(0, 5)} ${person.phone.slice(5)}`,
        shops: person.shops.map((shop) => shop.shopNumber),
        roles: person.shops.map((shop) => titleCase(shop.role)),
        lifetimeGiven: 0,
        lastContribution: "Money module pending"
      }))
    );
  }
};
