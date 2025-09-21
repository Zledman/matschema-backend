/**
 * Auth & RBAC integration tests using Jest + Supertest + MongoMemoryServer
 */

const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

// Miljövariabler för test
process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";
process.env.JWT_SECRET = "test-legacy-secret";
process.env.PORT = 0; // irrelevant i test

let app;
let mongoServer;

// Helpers
const register = (payload, token) => {
  const req = request(app).post("/api/auth/register").send(payload);
  if (token) {
    req.set("Authorization", `Bearer ${token}`);
  }
  return req;
};
const login = (payload) => request(app).post("/api/auth/login").send(payload);
const getMe = (token) =>
  request(app).get("/api/users/me").set("Authorization", `Bearer ${token}`);
const adminDash = (token) =>
  request(app)
    .get("/api/users/admin/dashboard")
    .set("Authorization", `Bearer ${token}`);
const changeRole = (id, token, role) =>
  request(app)
    .patch(`/api/users/${id}/role`)
    .set("Authorization", `Bearer ${token}`)
    .send({ role });

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri; // används av connectDB

  // Ladda app EFTER att vi satt MONGO_URI
  app = require("../app");

  // Anslut Mongoose manuellt (server.js sköter annars detta i runtime)
  await mongoose.connect(uri, { dbName: "testdb" });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  // Rensa databasen mellan testfall
  const collections = await mongoose.connection.db.collections();
  for (const c of collections) {
    await c.deleteMany({});
  }
});

describe("Auth & RBAC", () => {
  test("a) Register user -> role=user", async () => {
    const res = await register({
      email: "user1@example.com",
      password: "Password123",
      name: "User1",
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe("user");
  });

  test("b) Login returns accessToken and sets refresh cookie", async () => {
    await register({
      email: "login@example.com",
      password: "Password123",
      name: "Login",
    });
    const res = await login({
      email: "login@example.com",
      password: "Password123",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    // Kontrollera cookie header
    const setCookie = res.headers["set-cookie"];
    expect(setCookie.some((c) => c.startsWith("refreshToken="))).toBe(true);
  });

  test("c) Skyddad route utan token -> 401", async () => {
    const res = await request(app).get("/api/users/me");
    expect(res.status).toBe(401);
    expect(res.body.errors[0].message).toMatch(
      /Invalid token|Access token expired/
    );
  });

  test("d) Protected user route vs admin route", async () => {
    await register({ email: "r1@example.com", password: "Password123" });
    const loginRes = await login({
      email: "r1@example.com",
      password: "Password123",
    });
    const token = loginRes.body.data.accessToken;
    const me = await getMe(token);
    expect(me.status).toBe(200);
    const adminRes = await adminDash(token);
    expect(adminRes.status).toBe(403);
  });

  test("e,f) Upgrade to admin and access admin route", async () => {
    // Skapa första user
    await register({ email: "first@example.com", password: "Password123" });
    // Gör första user till admin genom DB-manipulation (direkt update)
    const User = require("../models/User");
    const u = await User.findOne({ email: "first@example.com" });
    u.role = "admin";
    await u.save();
    // Logga in efter uppgradering
    const loginRes = await login({
      email: "first@example.com",
      password: "Password123",
    });
    const adminToken = loginRes.body.data.accessToken;

    // Skapa annan user via admin
    const reg2 = await register(
      { email: "second@example.com", password: "Password123", role: "user" },
      adminToken
    );
    expect(reg2.status).toBe(201);

    // Uppgradera second -> admin via endpoint
    const secondUser = reg2.body.data.user;
    const change = await changeRole(secondUser.id, adminToken, "admin");
    expect(change.status).toBe(200);
    expect(change.body.data.user.role).toBe("admin");

    // Ny login för second
    const loginSecond = await login({
      email: "second@example.com",
      password: "Password123",
    });
    const secondToken = loginSecond.body.data.accessToken;
    const dash = await adminDash(secondToken);
    expect(dash.status).toBe(200);
  });

  test("g) Refresh token returns new accessToken", async () => {
    // Använd Supertest agent för att behålla cookies
    const agent = request.agent(app);
    await agent
      .post("/api/auth/register")
      .send({ email: "refresh@example.com", password: "Password123" });
    const loginRes = await agent
      .post("/api/auth/login")
      .send({ email: "refresh@example.com", password: "Password123" });
    const oldToken = loginRes.body.data.accessToken;
    const refRes = await agent.post("/api/auth/refresh");
    expect(refRes.status).toBe(200);
    expect(refRes.body.data.accessToken).toBeTruthy();
    expect(refRes.body.data.accessToken).not.toBe(oldToken);
  });

  test("h) Logout clears refresh cookie", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/register")
      .send({ email: "logout@example.com", password: "Password123" });
    await agent
      .post("/api/auth/login")
      .send({ email: "logout@example.com", password: "Password123" });
    const logoutRes = await agent.post("/api/auth/logout");
    expect(logoutRes.status).toBe(200);
    const setCookie = logoutRes.headers["set-cookie"] || [];
    // Cookie bör vara cleared (expires i det förflutna)
    expect(setCookie.some((c) => /refreshToken=;/i.test(c))).toBe(true);
  });

  test("i) Expired token -> 401 Access token expired", async () => {
    // Skapa user
    const regRes = await register({
      email: "expire@example.com",
      password: "Password123",
    });
    // Debug if failing
    if (regRes.status !== 201) {
      console.log("DEBUG register expire status", regRes.status, regRes.body);
    }
    // Kortlivad token
    const jwt = require("jsonwebtoken");
    const User = require("../models/User");
    const u = await User.findOne({ email: "expire@example.com" });
    if (!u) {
      console.log(
        "DEBUG could not find user expire@example.com after register"
      );
    }
    const shortToken = jwt.sign(
      { id: u.id, role: u.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1s" }
    );
    // Vänta tills den går ut
    await new Promise((r) => setTimeout(r, 1500));
    const res = await getMe(shortToken);
    expect(res.status).toBe(401);
    expect(res.body.errors[0].message).toBe("Access token expired");
  });

  test("j) Admin downgrade revokes existing tokens", async () => {
    // Steg 1: skapa och uppgradera user till admin (direkt i DB)
    const regRes = await register({
      email: "downgrade@example.com",
      password: "Password123",
    });
    if (regRes.status !== 201) {
      console.log(
        "DEBUG register downgrade status",
        regRes.status,
        regRes.body
      );
    }
    const User = require("../models/User");
    const u = await User.findOne({ email: "downgrade@example.com" });
    if (!u) {
      console.log(
        "DEBUG could not find user downgrade@example.com after register"
      );
    }
    u.role = "admin";
    await u.save();

    // Steg 2: logga in och få access token
    const loginRes = await login({
      email: "downgrade@example.com",
      password: "Password123",
    });
    const adminToken = loginRes.body.data.accessToken;
    expect(adminToken).toBeTruthy();

    // Sanity check: admin dashboard funkar nu
    const dashOk = await adminDash(adminToken);
    expect(dashOk.status).toBe(200);

    // Skapa en annan admin (superadmin) genom direkt manipulation för att kunna nedgradera första
    await register({
      email: "superadmin@example.com",
      password: "Password123",
    });
    const superUser = await User.findOne({ email: "superadmin@example.com" });
    superUser.role = "admin";
    await superUser.save();
    const superLogin = await login({
      email: "superadmin@example.com",
      password: "Password123",
    });
    const superToken = superLogin.body.data.accessToken;

    // Steg 3: nedgradera första admin -> user via endpoint (superToken används)
    const downgradeRes = await changeRole(u.id, superToken, "user");
    expect(downgradeRes.status).toBe(200);
    expect(
      downgradeRes.body.data.role || downgradeRes.body.data.user?.role
    ).toBe("user");

    // Steg 4: försök använda gamla adminToken -> ska vara 401 Token revoked
    const afterDowngrade = await adminDash(adminToken);
    expect(afterDowngrade.status).toBe(401);
    const msg = afterDowngrade.body.errors[0].message;
    expect(["Token revoked", "Invalid token"].includes(msg)).toBe(true);
  });

  test("k) Refresh token invalid after admin downgrade", async () => {
    const agent = request.agent(app);
    // Skapa användare och gör admin
    const regRes = await agent
      .post("/api/auth/register")
      .send({ email: "downg2@example.com", password: "Password123" });
    if (regRes.status !== 201) {
      console.log(
        "DEBUG agent register downg2 status",
        regRes.status,
        regRes.body
      );
    }
    const User = require("../models/User");
    const u = await User.findOne({ email: "downg2@example.com" });
    if (!u) {
      console.log(
        "DEBUG could not find user downg2@example.com after register"
      );
    }
    u.role = "admin";
    await u.save();
    // Logga in för att få cookies (refresh)
    await agent
      .post("/api/auth/login")
      .send({ email: "downg2@example.com", password: "Password123" });
    // Skapa superadmin
    await request(app)
      .post("/api/auth/register")
      .send({ email: "super2@example.com", password: "Password123" });
    const superUser = await User.findOne({ email: "super2@example.com" });
    superUser.role = "admin";
    await superUser.save();
    const superLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "super2@example.com", password: "Password123" });
    const superToken = superLogin.body.data.accessToken;
    // Nedgradera första admin
    const downgradeRes = await request(app)
      .patch(`/api/users/${u.id}/role`)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ role: "user" });
    expect(downgradeRes.status).toBe(200);
    // Försök köra refresh med gamla cookie (ska vara ogiltig efter nedgradering)
    const ref = await agent.post("/api/auth/refresh");
    expect(ref.status).toBe(401);
    expect(ref.body.errors[0].message).toMatch(
      /Token revoked|Refresh token ogiltig/
    );
  });
});
