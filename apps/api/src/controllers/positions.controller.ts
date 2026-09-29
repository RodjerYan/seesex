import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { parseInput } from '../schemas/common';
import {
  createPositionSchema,
  listPositionsQuerySchema,
  positionIdParamSchema,
  systemPositionsQuerySchema,
  updatePositionSchema,
} from '../schemas/positions.schema';
import * as positionsService from '../services/positions.service';

/** GET /api/positions — системные + свои (опционально ?category=). */
export const list = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { category } = parseInput(listPositionsQuerySchema, req.query);
  res.status(200).json({ positions: await positionsService.listPositions(req.user.id, category) });
});

/** GET /api/positions/system — только системные, пагинация + фильтр. */
export const listSystem = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const query = parseInput(systemPositionsQuerySchema, req.query);
  res.status(200).json(await positionsService.listSystemPositions(query));
});

/** GET /api/positions/categories — уникальные категории. */
export const categories = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  res.status(200).json(await positionsService.listCategories(req.user.id));
});

export const create = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const input = parseInput(createPositionSchema, req.body);
  res.status(201).json({ position: await positionsService.createPosition(req.user.id, input) });
});

export const update = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { id } = parseInput(positionIdParamSchema, req.params);
  const input = parseInput(updatePositionSchema, req.body);
  res.status(200).json({ position: await positionsService.updatePosition(req.user.id, id, input) });
});

export const remove = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { id } = parseInput(positionIdParamSchema, req.params);
  await positionsService.deletePosition(req.user.id, id);
  res.status(204).end();
});
