import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { setStoreForTesting } from '../src/db/index.js';
import { LocalJsonStore } from '../src/db/localStore.js';
import { normalizeVercelSlug } from '../src/services/vercelService.js';
import {
  decryptToken,
  encryptToken,
  extractTaskCodes,
  verifyGitHubWebhookSignature,
} from '../src/utils/crypto.js';
import { extractGitHubTarball } from '../src/utils/tar.js';

function buildTarEntry(filePath: string, content: string): Buffer {
  const header = Buffer.alloc(512, 0);
  Buffer.from(filePath).copy(header, 0);
  Buffer.from('0000644\0').copy(header, 100);
  Buffer.from('0000000\0').copy(header, 108);
  Buffer.from('0000000\0').copy(header, 116);
  const body = Buffer.from(content, 'utf8');
  Buffer.from(body.length.toString(8).padStart(11, '0') + '\0').copy(header, 124);
  Buffer.from('00000000000\0').copy(header, 136);
  header.fill(0x20, 148, 156);
  header[156] = 48; // '0' regular file
  Buffer.from('ustar\0').copy(header, 257);
  Buffer.from('00').copy(header, 263);
  const checksum = header.reduce((sum, b) => sum + b, 0);
  Buffer.from(checksum.toString(8).padStart(6, '0') + '\0 ').copy(header, 148);

  const paddedSize = Math.ceil(body.length / 512) * 512;
  const dataBlock = Buffer.alloc(paddedSize, 0);
  body.copy(dataBlock, 0);
  return Buffer.concat([header, dataBlock]);
}

describe('CodePulse Core & API Integration', () => {
  let tmpDir: string;
  let store: LocalJsonStore;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codepulse-test-'));
    const dbPath = path.join(tmpDir, 'test-db.json');
    store = new LocalJsonStore(dbPath, { seedDemoData: true });
    await store.init();
    setStoreForTesting(store);
    app = createApp();
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('Security & Parser Utilities', () => {
    it('encrypts and decrypts OAuth tokens using AES-256-GCM', () => {
      const secret = 'gho_super_secret_oauth_token_12345';
      const encrypted = encryptToken(secret);
      expect(encrypted).not.toContain(secret);
      expect(decryptToken(encrypted)).toBe(secret);
    });

    it('extracts normalized #CP-XX task codes from commit messages', () => {
      expect(extractTaskCodes('feat: login page #CP-01')).toEqual(['CP-01']);
      expect(extractTaskCodes('fix(auth): cp-2 and #cp-14')).toEqual(['CP-02', 'CP-14']);
      expect(extractTaskCodes('chore: readme update')).toEqual([]);
    });

    it('verifies GitHub X-Hub-Signature-256 HMAC signatures', () => {
      const payload = JSON.stringify({ ref: 'refs/heads/feat/auth' });
      const secret = 'demo-webhook-secret';
      const validSig =
        'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

      expect(verifyGitHubWebhookSignature(payload, validSig, secret)).toBe(true);
      expect(verifyGitHubWebhookSignature(payload, 'sha256=deadbeef', secret)).toBe(false);
    });

    it('extracts GitHub tarball files, strips repo root prefix, and normalizes Vercel slugs', () => {
      const tar = Buffer.concat([
        buildTarEntry('KyyX969-VETA-abc1234/index.html', '<h1>VETA</h1>'),
        buildTarEntry('KyyX969-VETA-abc1234/.git/config', '[core]'),
        Buffer.alloc(1024, 0),
      ]);
      const gz = zlib.gzipSync(tar);
      const files = extractGitHubTarball(gz);

      expect(files).toHaveLength(1);
      expect(files[0].file).toBe('index.html');
      expect(files[0].size).toBe('<h1>VETA</h1>'.length);
      expect(files[0].sha).toBe(
        crypto.createHash('sha1').update('<h1>VETA</h1>').digest('hex'),
      );
      expect(normalizeVercelSlug('VETA App / 2026!')).toBe('veta-app-2026');
    });
  });

  describe('End-to-End Flow (F-01 to F-06)', () => {
    let leaderAgent: ReturnType<typeof request.agent>;
    let memberAgent: ReturnType<typeof request.agent>;
    let workspaceId: string;
    let createdTaskId: string;
    let createdTaskCode: string;

    it('boots health check & registers/authenticates Leader and Member accounts (F-01)', async () => {
      const health = await request(app).get('/api/health');
      expect(health.status).toBe(200);
      expect(health.body.ok).toBe(true);

      leaderAgent = request.agent(app);
      const leaderReg = await leaderAgent.post('/api/auth/register').send({
        email: 'leader-test@codepulse.dev',
        password: 'SecretPassword123!',
        username: 'lead-tester',
        displayName: 'Lead Tester',
        role: 'leader',
      });
      expect(leaderReg.status).toBe(201);
      expect(leaderReg.body.user.role).toBe('leader');

      // Wrong password must be rejected with 401
      const badLogin = await request(app).post('/api/auth/login').send({
        email: 'leader-test@codepulse.dev',
        password: 'WrongPassword!',
      });
      expect(badLogin.status).toBe(401);

      // Valid login succeeds
      const goodLogin = await leaderAgent.post('/api/auth/login').send({
        email: 'leader-test@codepulse.dev',
        password: 'SecretPassword123!',
      });
      expect(goodLogin.status).toBe(200);

      memberAgent = request.agent(app);
      const memberReg = await memberAgent.post('/api/auth/register').send({
        email: 'member-test@codepulse.dev',
        password: 'MemberPassword123!',
        username: 'member-tester',
        displayName: 'Member Tester',
        role: 'member',
      });
      expect(memberReg.status).toBe(201);
      expect(memberReg.body.user.role).toBe('member');
    });

    it('loads workspace and enforces Gatekeeper drag rules on Kanban (F-02, F-04)', async () => {
      const wsRes = await memberAgent.get('/api/workspaces');
      expect(wsRes.status).toBe(200);
      workspaceId = wsRes.body.workspaces[0].id;

      const createRes = await memberAgent
        .post(`/api/workspaces/${workspaceId}/tasks`)
        .send({
          title: 'Implement Push Notification Service',
          priority: 'high',
        });
      expect(createRes.status).toBe(201);
      createdTaskId = createRes.body.task.id;
      createdTaskCode = createRes.body.task.taskCode;
      expect(createdTaskCode).toMatch(/^CP-\d+$/);

      // Member moves to in_progress -> allowed
      const progressRes = await memberAgent
        .patch(`/api/workspaces/${workspaceId}/tasks/${createdTaskId}`)
        .send({ status: 'in_progress' });
      expect(progressRes.status).toBe(200);
      expect(progressRes.body.task.status).toBe('in_progress');

      // Member tries moving directly to done -> blocked by Gatekeeper (403)
      const directDoneRes = await memberAgent
        .patch(`/api/workspaces/${workspaceId}/tasks/${createdTaskId}`)
        .send({ status: 'done' });
      expect(directDoneRes.status).toBe(403);
    });

    it('auto-moves task to In Review on signed GitHub push webhook < 3s (F-03)', async () => {
      const payload = JSON.stringify({
        ref: 'refs/heads/feat/push-notify',
        after: 'abc12349999',
        repository: { full_name: 'campussync-team/campussync-web' },
        pusher: { name: 'nadia-dev' },
        commits: [
          {
            id: 'abc12349999',
            message: `feat: add web push worker #${createdTaskCode}`,
          },
        ],
      });

      const sig =
        'sha256=' +
        crypto.createHmac('sha256', 'demo-webhook-secret').update(payload).digest('hex');

      const webhookRes = await request(app)
        .post('/api/webhooks/github')
        .set('X-GitHub-Event', 'push')
        .set('X-Hub-Signature-256', sig)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(webhookRes.status).toBe(200);
      expect(webhookRes.body.blocked).toBe(false);
      expect(webhookRes.body.latencyMs).toBeLessThan(3000);
      expect(webhookRes.body.updatedTasks[0].status).toBe('in_review');
    });

    it('blocks direct push to protected main branch (F-04 Zero Direct Push)', async () => {
      const payload = JSON.stringify({
        ref: 'refs/heads/main',
        after: 'bad9999',
        repository: { full_name: 'campussync-team/campussync-web' },
        pusher: { name: 'nadia-dev' },
        commits: [{ id: 'bad9999', message: 'bypass PR directly to main' }],
      });

      const sig =
        'sha256=' +
        crypto.createHmac('sha256', 'demo-webhook-secret').update(payload).digest('hex');

      const blockedRes = await request(app)
        .post('/api/webhooks/github')
        .set('X-GitHub-Event', 'push')
        .set('X-Hub-Signature-256', sig)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.blocked).toBe(true);
      expect(blockedRes.body.events[0].eventType).toBe('direct_push_blocked');
    });

    it('requires Leader to Approve & Merge and triggers auto-deploy (F-04, F-05)', async () => {
      // Member cannot approve & merge
      const memberApprove = await memberAgent
        .post(`/api/workspaces/${workspaceId}/gatekeeper/tasks/${createdTaskId}/approve-merge`)
        .send({});
      expect(memberApprove.status).toBe(403);

      // Leader approves & merges
      const leaderApprove = await leaderAgent
        .post(`/api/workspaces/${workspaceId}/gatekeeper/tasks/${createdTaskId}/approve-merge`)
        .send({ reviewComment: 'LGTM!', triggerDeploy: true });

      expect(leaderApprove.status).toBe(200);
      expect(leaderApprove.body.task.status).toBe('done');
      expect(leaderApprove.body.deployment).toBeTruthy();
      expect(['QUEUED', 'BUILDING', 'READY']).toContain(
        leaderApprove.body.deployment.status,
      );
    });

    it('restricts manual Vercel Deploy Now to Project Leader (F-05)', async () => {
      const memberDeploy = await memberAgent
        .post(`/api/workspaces/${workspaceId}/deployments`)
        .send({});
      expect(memberDeploy.status).toBe(403);

      const leaderDeploy = await leaderAgent
        .post(`/api/workspaces/${workspaceId}/deployments`)
        .send({ branch: 'main' });
      expect(leaderDeploy.status).toBe(201);
      expect(leaderDeploy.body.deployment.branch).toBe('main');
    });

    it('tracks live WebRTC screen monitor sessions (F-06)', async () => {
      const startRes = await memberAgent
        .post(`/api/workspaces/${workspaceId}/sessions/start`)
        .send({ activeTaskCode: createdTaskCode, fps: 30, resolution: '1920x1080' });
      expect(startRes.status).toBe(200);
      expect(startRes.body.sessions.length).toBe(1);
      expect(startRes.body.sessions[0].activeTaskCode).toBe(createdTaskCode);

      const stopRes = await memberAgent
        .post(`/api/workspaces/${workspaceId}/sessions/stop`)
        .send({});
      expect(stopRes.status).toBe(200);
      expect(stopRes.body.sessions.length).toBe(0);
    });

    it('supports sending, receiving, accepting, and joining via invite codes', async () => {
      // Member cannot send invitations
      const forbiddenInvite = await memberAgent
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .send({ target: '@fresh-dev', role: 'member' });
      expect(forbiddenInvite.status).toBe(403);

      // Leader creates a direct invitation for @fresh-dev before they even register
      const directInvite = await leaderAgent
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .send({ target: '@fresh-dev', role: 'member', message: 'Welcome aboard!' });
      expect(directInvite.status).toBe(201);
      expect(directInvite.body.invitation.inviteCode).toMatch(/^CP-[A-Z0-9]{6}$/);
      const invId = directInvite.body.invitation.id;

      // @fresh-dev registers, checks incoming inbox, and accepts invitation
      const freshAgent = request.agent(app);
      const regRes = await freshAgent.post('/api/auth/register').send({
        email: 'fresh.dev@codepulse.test',
        password: 'FreshPassword123!',
        username: 'fresh-dev',
        displayName: 'Fresh Dev',
        role: 'member',
      });
      expect(regRes.status).toBe(201);

      const mineRes = await freshAgent.get('/api/invitations/mine');
      expect(mineRes.status).toBe(200);
      expect(mineRes.body.incoming.some((i: { id: string }) => i.id === invId)).toBe(true);

      const acceptRes = await freshAgent.post(`/api/invitations/${invId}/accept`).send({});
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.invitation.status).toBe('accepted');
      expect(
        acceptRes.body.workspace.members.some((m: { username: string }) => m.username === 'fresh-dev'),
      ).toBe(true);

      // Leader generates an open shareable invite link/code -> another user joins via full URL
      const openInvite = await leaderAgent
        .post(`/api/workspaces/${workspaceId}/invitations`)
        .send({ role: 'member' });
      expect(openInvite.status).toBe(201);
      const code = openInvite.body.invitation.inviteCode as string;

      const joinerAgent = request.agent(app);
      await joinerAgent.post('/api/auth/register').send({
        email: 'link.joiner@codepulse.test',
        password: 'JoinerPassword123!',
        username: 'link-joiner',
        displayName: 'Link Joiner',
        role: 'member',
      });

      const joinRes = await joinerAgent
        .post('/api/invitations/join')
        .send({ code: `http://localhost:5173/?invite=${code}` });
      expect(joinRes.status).toBe(200);
      expect(
        joinRes.body.workspace.members.some((m: { username: string }) => m.username === 'link-joiner'),
      ).toBe(true);
    });

    it('allows Project Leader to edit and delete a project workspace while blocking Contributors', async () => {
      const createdRes = await leaderAgent.post('/api/workspaces').send({
        name: 'Temp Workspace',
        description: 'Initial notes',
      });
      expect(createdRes.status).toBe(201);
      const tempId = createdRes.body.workspace.id as string;

      // Contributor cannot rename or delete
      const memberEdit = await memberAgent
        .patch(`/api/workspaces/${tempId}`)
        .send({ name: 'Hijacked Name' });
      expect(memberEdit.status).toBe(403);

      const memberDel = await memberAgent.delete(`/api/workspaces/${tempId}`);
      expect(memberDel.status).toBe(403);

      // Leader renames & updates description
      const editRes = await leaderAgent.patch(`/api/workspaces/${tempId}`).send({
        name: 'Renamed Workspace',
        description: 'Updated description',
      });
      expect(editRes.status).toBe(200);
      expect(editRes.body.workspace.name).toBe('Renamed Workspace');
      expect(editRes.body.workspace.description).toBe('Updated description');

      // Leader deletes workspace
      const delRes = await leaderAgent.delete(`/api/workspaces/${tempId}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.deletedId).toBe(tempId);

      // Deleted workspace no longer exists
      const getAfter = await leaderAgent.get(`/api/workspaces/${tempId}`);
      expect(getAfter.status).toBe(404);
    });

    it('sets distinct OAuth intent cookies for Sign In vs Sign Up vs Onboarding Connect', async () => {
      const loginRes = await request(app).get('/api/auth/github?intent=login');
      expect(loginRes.status).toBe(302);
      const loginLocation = String(loginRes.headers.location || '');
      if (loginLocation.startsWith('https://github.com/login/oauth/authorize')) {
        const loginCookies = (loginRes.headers['set-cookie'] || []) as string[];
        expect(loginCookies.some((c) => c.includes('cp_oauth_intent=login'))).toBe(true);

        const registerRes = await request(app).get('/api/auth/github?intent=register');
        expect(registerRes.status).toBe(302);
        const registerCookies = (registerRes.headers['set-cookie'] || []) as string[];
        expect(registerCookies.some((c) => c.includes('cp_oauth_intent=register'))).toBe(true);

        const onboardingConnectRes = await request(app).get(
          '/api/auth/github?intent=connect&return_to=onboarding',
        );
        expect(onboardingConnectRes.status).toBe(302);
        const connectCookies = (onboardingConnectRes.headers['set-cookie'] || []) as string[];
        expect(connectCookies.some((c) => c.includes('cp_oauth_intent=connect'))).toBe(true);
        expect(connectCookies.some((c) => c.includes('cp_oauth_return=onboarding'))).toBe(true);
      } else {
        expect(loginLocation).toContain('auth_error=github_oauth_not_configured');
      }
    });
  });
});

