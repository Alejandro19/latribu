import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiClient from '../lib/api-client';
import { listExercises, createExercise, reorderExercise, confirmSession, getStreak, useProtector, getAchievements, getPhraseByContext } from '../lib/training-client';

beforeEach(() => {
  vi.spyOn(apiClient, 'getSessionToken').mockReturnValue('fake-token');
  global.fetch = vi.fn();
});

describe('training-client', () => {
  it('listExercises returns the exercises array on success', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ success: true, exercises: [{ id: 'e1', title: 'Sentadilla' }] }),
    });
    const result = await listExercises('client-1');
    expect(result).toEqual([{ id: 'e1', title: 'Sentadilla' }]);
  });

  it('createExercise throws with the server error message on failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ success: false, error: 'Datos inválidos.' }),
    });
    await expect(
      createExercise('client-1', { title: '', day_number: 1, category: 'strength' })
    ).rejects.toThrow('Datos inválidos.');
  });

  it('reorderExercise sends the direction and returns the updated list', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ success: true, exercises: [{ id: 'e1', sortOrder: 1 }] }),
    });
    const result = await reorderExercise('client-1', 'e1', 'down');
    expect(result).toEqual([{ id: 'e1', sortOrder: 1 }]);
    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ direction: 'down' });
  });

  it('confirmSession returns alreadyConfirmedToday, dayNumber, streak, and phrase', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        success: true,
        alreadyConfirmedToday: false,
        dayNumber: 2,
        streak: { streakWeeks: 1, sessionsDoneThisWeek: 2, sessionsRequiredThisWeek: 2, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false },
        phrase: 'Sigue así.',
      }),
    });
    const result = await confirmSession('client-1', 'America/Mexico_City');
    expect(result).toEqual({
      alreadyConfirmedToday: false,
      dayNumber: 2,
      streak: { streakWeeks: 1, sessionsDoneThisWeek: 2, sessionsRequiredThisWeek: 2, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false },
      phrase: 'Sigue así.',
    });
  });

  it('getStreak returns the streak object', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        success: true,
        streak: { streakWeeks: 2, sessionsDoneThisWeek: 1, sessionsRequiredThisWeek: 3, protectorAvailable: true, protectorUsedThisWeek: false, atRisk: false },
      }),
    });
    const result = await getStreak('client-1', 'America/Mexico_City');
    expect(result.streakWeeks).toBe(2);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('/training/streak?tz=');
  });

  it('useProtector posts tz and returns the updated streak', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        success: true,
        streak: { streakWeeks: 1, sessionsDoneThisWeek: 0, sessionsRequiredThisWeek: 3, protectorAvailable: false, protectorUsedThisWeek: true, atRisk: false },
      }),
    });
    const result = await useProtector('client-1', 'America/Mexico_City');
    expect(result.protectorUsedThisWeek).toBe(true);
  });

  it('getAchievements returns the achievements array', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ success: true, achievements: [{ id: 'a1', clientId: 'client-1', type: 'medalla', weekNumber: 1, earnedAt: '2026-01-01' }] }),
    });
    const result = await getAchievements('client-1');
    expect(result).toHaveLength(1);
  });

  describe('getPhraseByContext', () => {
    it('returns the phrase text on success', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ success: true, phrase: 'Vamos con todo' }),
      });

      const result = await getPhraseByContext('client-1', 'instagram');
      expect(result).toBe('Vamos con todo');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/clients/client-1/training/phrase?context=instagram'),
        expect.anything()
      );
    });

    it('returns null when the backend has no eligible phrase', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ success: true, phrase: null }),
      });

      const result = await getPhraseByContext('client-1', 'confirmacion');
      expect(result).toBeNull();
    });

    it('throws when the backend reports failure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({ success: false, error: 'Contexto inválido.' }),
      });

      await expect(getPhraseByContext('client-1', 'instagram')).rejects.toThrow('Contexto inválido.');
    });
  });
});
