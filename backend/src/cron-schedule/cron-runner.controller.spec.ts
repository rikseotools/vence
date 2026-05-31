import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import type { AuthenticatedUser } from '../auth/jwt-verifier';
import { JwtGuard } from '../auth/jwt.guard';
import { CronRunnerController } from './cron-runner.controller';

describe('CronRunnerController', () => {
  let ctrl: CronRunnerController;
  let registry: { getCronJob: jest.Mock };

  const admin: AuthenticatedUser = {
    userId: 'u-admin',
    email: 'manueltrader@gmail.com',
  } as AuthenticatedUser;
  const nonAdmin: AuthenticatedUser = {
    userId: 'u-user',
    email: 'rando@example.com',
  } as AuthenticatedUser;

  beforeEach(async () => {
    registry = { getCronJob: jest.fn() };
    const mod = await Test.createTestingModule({
      controllers: [CronRunnerController],
      providers: [{ provide: SchedulerRegistry, useValue: registry }],
    })
      // El JwtGuard se valida en E2E con un JWT real; aquí lo bypaseamos
      // para testar la lógica del controller (admin gate + run-now).
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .compile();
    ctrl = mod.get(CronRunnerController);
  });

  it('rechaza con 403 a non-admin', async () => {
    await expect(
      ctrl.runNow(nonAdmin, { name: 'detect-oep-llm' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(registry.getCronJob).not.toHaveBeenCalled();
  });

  it('rechaza con 400 si falta el name', async () => {
    await expect(ctrl.runNow(admin, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(ctrl.runNow(admin, { name: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      ctrl.runNow(admin, { name: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza con 400 si name no es string', async () => {
    await expect(
      ctrl.runNow(admin, { name: 42 as unknown as string }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('responde 404 si el cron no está registrado', async () => {
    registry.getCronJob.mockImplementation(() => {
      throw new Error('No Cron Job was found with the given name');
    });
    await expect(
      ctrl.runNow(admin, { name: 'inexistente' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('dispara fireOnTick y devuelve resumen', async () => {
    const fireOnTick = jest.fn().mockResolvedValue(undefined);
    registry.getCronJob.mockReturnValue({ fireOnTick });

    const res = await ctrl.runNow(admin, { name: 'detect-oep-llm' });

    expect(fireOnTick).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({
      success: true,
      cron: 'detect-oep-llm',
      ranBy: 'manueltrader@gmail.com',
    });
    expect(typeof res.durationMs).toBe('number');
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof res.ranAt).toBe('string');
  });

  it('propaga al caller errores que escapen del handler del cron', async () => {
    const boom = new Error('cron exploded');
    const fireOnTick = jest.fn().mockRejectedValue(boom);
    registry.getCronJob.mockReturnValue({ fireOnTick });

    await expect(
      ctrl.runNow(admin, { name: 'detect-oep-llm' }),
    ).rejects.toBe(boom);
  });

  it('acepta emails @vencemitfg.es como admin (whitelist por dominio)', async () => {
    const domainAdmin: AuthenticatedUser = {
      userId: 'u-dom',
      email: 'someone@vencemitfg.es',
    } as AuthenticatedUser;
    const fireOnTick = jest.fn().mockResolvedValue(undefined);
    registry.getCronJob.mockReturnValue({ fireOnTick });

    const res = await ctrl.runNow(domainAdmin, { name: 'detect-oep-llm' });
    expect(res.success).toBe(true);
    expect(res.ranBy).toBe('someone@vencemitfg.es');
  });
});
