-- R2 / T-20261002-015: полное удаление позиций (БД)
-- Порядок: сначала бэкфилл вишлиста из позиций, затем дропы.

-- a) Бэкфилл: переносим имя/категорию позиции в кастомные поля вишлиста
UPDATE "Wishlist" w SET "customName" = p."name", "customCategory" = p."category" FROM "Position" p WHERE w."positionId" = p."id" AND w."customName" IS NULL;

-- b) Дроп implicit m2m-таблицы Event <-> Position
DROP TABLE IF EXISTS "_EventToPosition";

-- c) Дроп колонки positionId (вместе с ней уходит FK "Wishlist_positionId_fkey")
ALTER TABLE "Wishlist" DROP COLUMN "positionId";

-- d) Дроп таблицы позиций
DROP TABLE IF EXISTS "Position";
