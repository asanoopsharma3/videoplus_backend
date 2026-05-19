import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

const PARTNER_CODE_FRAGMENT =
  '268012000007097","sequenceNumber":"4fb0e13c-adbf-53f9-9dd2-96a2f6d3f1d4","data":{"serviceType":"games_Games_98","contentId":"-1","resultCode":"0","renFlag":"Y","requestNo":"4003562882605151927","result":"Success","OptionalParameter3":"UNSUB3D","callingParty":"26878146285","bearerId":"API","operationId":"GR","chargeAmount":"1.0","serviceNode":"UNISOLUTION","msisdn":"26878146285","serviceId":"268012000007097","category":"-1","validityDays":"2"},"transactionId":"rrt-e2e-partner","notificationType":"SUBSCRIBE"}';

function uniqueRequestNo(prefix: string): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

describe('CallbackController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/callback without params returns 400', () => {
    return request(app.getHttpServer()).get('/api/v1/callback').expect(400);
  });

  it('POST /api/v1/callback without body returns 400', () => {
    return request(app.getHttpServer())
      .post('/api/v1/callback')
      .query({
        code: '268012000007097',
        transactionId: 'rrt-empty',
        notificationType: 'SUBSCRIBE',
      })
      .send({})
      .expect(400);
  });

  it('POST /api/v1/callback body + query params inserts row', async () => {
    const requestNo = uniqueRequestNo('e2e-post-');
    const res = await request(app.getHttpServer())
      .post('/api/v1/callback')
      .query({
        code: '268012000007097',
        transactionId: `rrt-${requestNo}`,
        notificationType: 'SUBSCRIBE',
      })
      .send({
        sequenceNumber: '4fb0e13c-adbf-53f9-9dd2-96a2f6d3f1d4',
        data: {
          serviceType: 'games_Games_98',
          requestNo,
          result: 'Success',
          chargeAmount: '1.0',
          msisdn: '26878146285',
          serviceId: '268012000007097',
        },
      })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.inserted.length).toBeGreaterThanOrEqual(1);
    expect(res.body.errors).toEqual([]);
  });

  it('GET /api/v1/callback partner code fragment inserts row', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/callback')
      .query({ code: PARTNER_CODE_FRAGMENT })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.inserted.length).toBeGreaterThanOrEqual(1);
    expect(res.body.errors).toEqual([]);
  });

  it('GET /api/v1/callback with flat query params inserts row', async () => {
    const requestNo = uniqueRequestNo('e2e-flat-');
    const res = await request(app.getHttpServer())
      .get('/api/v1/callback')
      .query({
        code: '268012000007097',
        sequenceNumber: 'seq-flat',
        transactionId: `rrt-${requestNo}`,
        notificationType: 'SUBSCRIBE',
        requestNo,
        result: 'Success',
        chargeAmount: '1.0',
        serviceId: '268012000007097',
      })
      .expect(200);

    expect(res.body.inserted.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/callback duplicate requestNo still inserts', async () => {
    const requestNo = uniqueRequestNo('e2e-dup-');
    const query = {
      requestNo,
      result: 'Success',
      notificationType: 'SUBSCRIBE',
      chargeAmount: '0',
    };

    const first = await request(app.getHttpServer())
      .get('/api/v1/callback')
      .query(query)
      .expect(200);

    const second = await request(app.getHttpServer())
      .get('/api/v1/callback')
      .query(query)
      .expect(200);

    expect(first.body.inserted.length).toBeGreaterThanOrEqual(1);
    expect(second.body.inserted.length).toBeGreaterThanOrEqual(1);
  });
});
