import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TEST_PASSWORD } from './factories';

export async function loginAs(app: INestApplication, user: { email: string }): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: user.email, password: TEST_PASSWORD })
    .expect(200);
  return res.body.accessToken as string;
}

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
