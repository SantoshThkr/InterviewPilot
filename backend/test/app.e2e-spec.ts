import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { HealthController } from '../src/common/health.controller';
import { PrismaService } from '../src/prisma/prisma.service';

// Health endpoint should report status without requiring a live database in CI.
describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    })
      .useMocker((token) => {
        if (token === PrismaService) {
          return {
            $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
          };
        }
        return undefined;
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET /health returns ok when the database is reachable', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    const body = res.body as { status: string; database: string };
    expect(body.status).toBe('ok');
    expect(body.database).toBe('up');
  });

  afterAll(async () => {
    await app.close();
  });
});
