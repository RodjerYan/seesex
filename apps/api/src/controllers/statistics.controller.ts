import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { parseInput } from '../schemas/common';
import { customStatsQuerySchema, frequencyQuerySchema } from '../schemas/statistics.schema';
import * as statisticsService from '../services/statistics.service';

export const overview = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  res.status(200).json(await statisticsService.overview(req.user.id));
});

export const frequency = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const query = parseInput(frequencyQuerySchema, req.query);
  res.status(200).json(await statisticsService.frequency(req.user.id, query));
});

export const partners = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const query = parseInput(frequencyQuerySchema, req.query);
  res.status(200).json(await statisticsService.partners(req.user.id, query));
});

export const positions = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const query = parseInput(frequencyQuerySchema, req.query);
  res.status(200).json(await statisticsService.positions(req.user.id, query));
});

export const ratings = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const query = parseInput(frequencyQuerySchema, req.query);
  res.status(200).json(await statisticsService.ratings(req.user.id, query));
});

export const periods = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  res.status(200).json(await statisticsService.periods(req.user.id));
});

export const custom = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const query = parseInput(customStatsQuerySchema, req.query);
  res.status(200).json(await statisticsService.custom(req.user.id, query));
});
