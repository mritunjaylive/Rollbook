-- Grandfather in all existing users who signed up before email verification was enforced
UPDATE "user" SET "emailVerified" = true WHERE "emailVerified" = false;
