export type Role = "admin" | "collector" | "viewer";

export type User = {
  id: string;
  name: string;
  phone: string;
  role: Role;
};

export type AuthSession = {
  token: string;
  refreshToken: string;
  user: User;
};

export type Dashboard = {
  generalFundBalance: number;
  generalCollected: number;
  generalSpent: number;
  eventFundBalance: number;
  eventFundLine: string;
  shopsOnRecord: number;
  peopleOnRecord: number;
  pendingShopCount: number;
  pendingAmount: number;
  activeEvent?: {
    id: string;
    name: string;
    collected: number;
    spent: number;
    remaining: number;
    generalSupport: number;
    generalFunded: boolean;
  };
};

export type Shop = {
  id: string;
  number: string;
  businessName: string;
  wing: string;
  floor: string;
  ownerName?: string;
  rentedTo?: string;
  workersCount: number;
  feeStatus: "paid" | "pending" | "none";
  feeDue?: number;
};

export type Person = {
  id: string;
  name: string;
  phone: string;
  shops: string[];
  roles: string[];
  lifetimeGiven: number;
  lastContribution?: string;
};

export type EventSummary = {
  id: string;
  name: string;
  status: "active" | "closed" | "planned";
  collected: number;
  spent: number;
  remaining: number;
  ownFund: boolean;
};

export type CommitteeMember = {
  id: string;
  name: string;
  phone: string;
  role: "ADMIN" | "COLLECTOR" | "VIEWER";
  active: boolean;
  pinSet: boolean;
  removedAt?: string | null;
};
