import { Dashboard, EventSummary, Person, Shop } from "./api";

export const dashboardMock: Dashboard = {
  generalFundBalance: 482500,
  generalCollected: 735000,
  generalSpent: 252500,
  eventFundBalance: 168400,
  eventFundLine: "Ganeshotsav and Shiv Jayanti funds",
  shopsOnRecord: 1024,
  peopleOnRecord: 2308,
  pendingShopCount: 74,
  pendingAmount: 155400,
  activeEvent: {
    id: "ganeshotsav-2026",
    name: "Ganeshotsav 2026",
    collected: 312000,
    spent: 183600,
    remaining: 128400,
    generalSupport: 42000,
    generalFunded: false
  }
};

export const shopsMock: Shop[] = [
  {
    id: "s1",
    number: "A-12",
    businessName: "Mahalaxmi Textiles",
    wing: "A Wing",
    floor: "Ground floor",
    ownerName: "Ramesh Shah",
    rentedTo: "Vikram Jain",
    workersCount: 3,
    feeStatus: "pending",
    feeDue: 2100
  },
  {
    id: "s2",
    number: "B-04",
    businessName: "Deepak Garments",
    wing: "B Wing",
    floor: "First floor",
    ownerName: "Nitin More",
    workersCount: 2,
    feeStatus: "paid"
  },
  {
    id: "s3",
    number: "L3-06",
    businessName: "Kohinoor Footwear",
    wing: "Lane 3",
    floor: "Open stall",
    ownerName: "Farida Khan",
    workersCount: 1,
    feeStatus: "pending",
    feeDue: 2100
  }
];

export const peopleMock: Person[] = [
  {
    id: "p1",
    name: "Ramesh Shah",
    phone: "+91 98201 44120",
    shops: ["A-12"],
    roles: ["Owner"],
    lifetimeGiven: 18500,
    lastContribution: "Annual fee · 2025-26"
  },
  {
    id: "p2",
    name: "Vikram Jain",
    phone: "+91 98922 44770",
    shops: ["A-12", "L3-11"],
    roles: ["Renter", "Worker"],
    lifetimeGiven: 7200,
    lastContribution: "Ganeshotsav donation"
  },
  {
    id: "p3",
    name: "Farida Khan",
    phone: "+91 98195 22087",
    shops: ["L3-06"],
    roles: ["Owner"],
    lifetimeGiven: 23100,
    lastContribution: "Annual fee · 2026-27"
  }
];

export const eventsMock: EventSummary[] = [
  {
    id: "e1",
    name: "Ganeshotsav 2026",
    status: "active",
    collected: 312000,
    spent: 183600,
    remaining: 128400,
    ownFund: true
  },
  {
    id: "e2",
    name: "Independence Day",
    status: "closed",
    collected: 0,
    spent: 18500,
    remaining: 0,
    ownFund: false
  }
];
