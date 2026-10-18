import { HttpExceptionLogFilter, TestHelper } from '@lenne.tech/nest-server';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';
import { Server } from 'http';
import { MongoClient, ObjectId } from 'mongodb';

import envConfig from '../../src/config.env';
import { imports, ServerModule } from '../../src/server/server.module';

/**
 * Helper to hash password with SHA256 if enabled in config
 */
function hashPassword(password: string): string {
  if (!envConfig.sha256) {
    return password;
  }
  return createHash('sha256').update(password).digest('hex');
}

describe('Credit Account Module REST (e2e)', () => {
  // Test environment properties
  let app: NestExpressApplication;
  let httpServer: Server;
  let testHelper: TestHelper;

  // database
  let connection;
  let db;

  // Users and accounts created by the tests (removed in afterAll)
  const userIds: string[] = [];
  const accountIds: string[] = [];
  let adminToken: string;
  let aliceToken: string;
  let bobToken: string;
  let aliceAccountId: string;
  let bobAccountId: string;

  /**
   * Signs up a verified user, optionally with roles, and returns the session token
   */
  async function signUp(name: string, roles: string[] = []): Promise<string> {
    const random = Math.random().toString(36).substring(7);
    const email = `credit-${name}-${random}@rest-test.com`;
    const password = `${random}R1!`;
    await testHelper.rest('/iam/sign-up/email', {
      method: 'POST',
      payload: { email, name, password: hashPassword(password), termsAndPrivacyAccepted: true },
      statusCode: 201,
    });
    const user = await db.collection('users').findOne({ email });
    userIds.push(user._id.toString());
    await db
      .collection('users')
      .updateOne({ _id: user._id }, { $set: { emailVerified: true, roles, verified: true } });
    const res = await testHelper.rest('/iam/sign-in/email', {
      method: 'POST',
      payload: { email, password: hashPassword(password) },
      returnResponse: true,
      statusCode: 200,
    });
    return TestHelper.extractSessionToken(res);
  }

  // ===================================================================================================================
  // Preparations
  // ===================================================================================================================

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [...imports, ServerModule],
      providers: [{ provide: 'PUB_SUB', useValue: { publish: async () => {} } }],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new HttpExceptionLogFilter());
    await app.init();
    httpServer = app.getHttpServer();
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    testHelper = new TestHelper(app);
    connection = await MongoClient.connect(envConfig.mongoose.uri);
    db = await connection.db();

    adminToken = await signUp('admin', ['admin']);
    aliceToken = await signUp('alice');
    bobToken = await signUp('bob');
  });

  afterAll(async () => {
    if (db) {
      await db.collection('creditaccounts').deleteMany({ _id: { $in: accountIds.map((id) => new ObjectId(id)) } });
      await db.collection('users').deleteMany({ _id: { $in: userIds.map((id) => new ObjectId(id)) } });
    }
    if (connection) {
      await connection.close();
    }
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
    if (app) {
      await app.close();
    }
  });

  // ===================================================================================================================
  // Accounts
  // ===================================================================================================================

  it('opens an account for each user, starting at 0', async () => {
    const alice = await testHelper.rest('/credit-accounts', {
      cookies: aliceToken,
      method: 'POST',
      payload: { name: 'Alice' },
      statusCode: 201,
    });
    const bob = await testHelper.rest('/credit-accounts', {
      cookies: bobToken,
      method: 'POST',
      payload: { name: 'Bob' },
      statusCode: 201,
    });
    expect(alice.balance).toEqual(0);
    aliceAccountId = alice.id;
    bobAccountId = bob.id;
    accountIds.push(aliceAccountId, bobAccountId);
  });

  it('lets an admin top up an account', async () => {
    const res = await testHelper.rest(`/credit-accounts/${aliceAccountId}/top-up`, {
      cookies: adminToken,
      method: 'POST',
      payload: { amount: 50 },
      statusCode: 201,
    });
    expect(res.balance).toEqual(50);
  });

  it('refuses a top-up by a normal user', async () => {
    await testHelper.rest(`/credit-accounts/${aliceAccountId}/top-up`, {
      cookies: aliceToken,
      method: 'POST',
      payload: { amount: 50 },
      statusCode: 403,
    });
  });

  // ===================================================================================================================
  // Transfers and redemptions
  // ===================================================================================================================

  it('transfers credits to another account', async () => {
    const res = await testHelper.rest(`/credit-accounts/${aliceAccountId}/transfer`, {
      cookies: aliceToken,
      method: 'POST',
      payload: { amount: 20, toAccountId: bobAccountId },
      statusCode: 201,
    });
    expect(res.balance).toEqual(30);
    const bob = await testHelper.rest(`/credit-accounts/${bobAccountId}`, { cookies: bobToken });
    expect(bob.balance).toEqual(20);
  });

  it('refuses a transfer from an account of another user', async () => {
    await testHelper.rest(`/credit-accounts/${aliceAccountId}/transfer`, {
      cookies: bobToken,
      method: 'POST',
      payload: { amount: 10, toAccountId: bobAccountId },
      statusCode: 403,
    });
  });

  it('redeems credits for a voucher', async () => {
    const res = await testHelper.rest(`/credit-accounts/${aliceAccountId}/redeem`, {
      cookies: aliceToken,
      method: 'POST',
      payload: { amount: 10 },
      statusCode: 201,
    });
    expect(res.balance).toEqual(20);
  });
});
