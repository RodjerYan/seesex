import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth';
import { ApiError, asyncHandler } from '../middleware/error';
import { uploadedFiles } from '../middleware/upload';
import { parseInput } from '../schemas/common';
import {
  createPartnerSchema,
  partnerIdParamSchema,
  partnerPhotoParamSchema,
  updatePartnerSchema,
} from '../schemas/partners.schema';
import * as partnersService from '../services/partners.service';

export const list = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  res.status(200).json({ partners: await partnersService.listPartners(req.user.id) });
});

export const get = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { id } = parseInput(partnerIdParamSchema, req.params);
  res.status(200).json({ partner: await partnersService.getPartner(req.user.id, id) });
});

export const create = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const input = parseInput(createPartnerSchema, req.body);
  res.status(201).json({ partner: await partnersService.createPartner(req.user.id, input) });
});

export const update = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { id } = parseInput(partnerIdParamSchema, req.params);
  const input = parseInput(updatePartnerSchema, req.body);
  res.status(200).json({ partner: await partnersService.updatePartner(req.user.id, id, input) });
});

export const remove = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { id } = parseInput(partnerIdParamSchema, req.params);
  await partnersService.deletePartner(req.user.id, id);
  res.status(204).end();
});

/** POST /api/partners/:id/photos — лимит MAX_PHOTOS_PER_PARTNER, иначе 400. */
export const uploadPhotos = asyncHandler<AuthedRequest>(
  async (req: AuthedRequest, res: Response) => {
    const { id } = parseInput(partnerIdParamSchema, req.params);
    const files = uploadedFiles(req);
    if (files.length === 0) {
      throw ApiError.badRequest('NO_FILES', 'At least one image file is required');
    }
    const photos = await partnersService.addPartnerPhotos(
      req.user.id,
      id,
      files.map((file) => file.filename),
    );
    res.status(201).json({ photos });
  },
);

export const removePhoto = asyncHandler<AuthedRequest>(
  async (req: AuthedRequest, res: Response) => {
    const { id, photoId } = parseInput(partnerPhotoParamSchema, req.params);
    await partnersService.deletePartnerPhoto(req.user.id, id, photoId);
    res.status(204).end();
  },
);

/** PUT /api/partners/:id/primary — снять isPrimary у остальных (транзакция). */
export const setPrimary = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { id } = parseInput(partnerIdParamSchema, req.params);
  res.status(200).json({ partner: await partnersService.setPrimaryPartner(req.user.id, id) });
});
