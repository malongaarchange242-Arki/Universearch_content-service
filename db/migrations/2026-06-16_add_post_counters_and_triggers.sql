-- Migration: add counter columns to posts and create triggers to maintain them
-- Run in a maintenance window. Test on staging before production.

BEGIN;

-- 1) Add columns to posts
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS shares_count integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS views_count integer DEFAULT 0 NOT NULL;

-- 2) Initialize counters from existing tables
UPDATE posts p
SET
  likes_count = COALESCE(lc.cnt, 0),
  comments_count = COALESCE(cc.cnt, 0),
  shares_count = COALESCE(sc.cnt, 0),
  views_count = COALESCE(vc.cnt, 0)
FROM (
  SELECT post_id, COUNT(*) AS cnt FROM post_likes GROUP BY post_id
) lc
FULL JOIN (
  SELECT post_id, COUNT(*) AS cnt FROM post_comments GROUP BY post_id
) cc ON lc.post_id = cc.post_id
FULL JOIN (
  SELECT post_id, COUNT(*) AS cnt FROM post_shares GROUP BY post_id
) sc ON COALESCE(lc.post_id, cc.post_id) = sc.post_id
FULL JOIN (
  SELECT post_id, COUNT(*) AS cnt FROM post_views GROUP BY post_id
) vc ON COALESCE(lc.post_id, cc.post_id, sc.post_id) = vc.post_id
WHERE p.id = COALESCE(lc.post_id, cc.post_id, sc.post_id, vc.post_id);

-- 3) Create helper functions and triggers
-- Likes: increment on insert, decrement on delete
CREATE OR REPLACE FUNCTION public.increment_post_likes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.decrement_post_likes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_post_likes ON post_likes;
CREATE TRIGGER trigger_increment_post_likes AFTER INSERT ON post_likes FOR EACH ROW EXECUTE FUNCTION public.increment_post_likes();

DROP TRIGGER IF EXISTS trigger_decrement_post_likes ON post_likes;
CREATE TRIGGER trigger_decrement_post_likes AFTER DELETE ON post_likes FOR EACH ROW EXECUTE FUNCTION public.decrement_post_likes();

-- Comments
CREATE OR REPLACE FUNCTION public.increment_post_comments()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts SET comments_count = COALESCE(comments_count, 0) + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.decrement_post_comments()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_post_comments ON post_comments;
CREATE TRIGGER trigger_increment_post_comments AFTER INSERT ON post_comments FOR EACH ROW EXECUTE FUNCTION public.increment_post_comments();

DROP TRIGGER IF EXISTS trigger_decrement_post_comments ON post_comments;
CREATE TRIGGER trigger_decrement_post_comments AFTER DELETE ON post_comments FOR EACH ROW EXECUTE FUNCTION public.decrement_post_comments();

-- Shares
CREATE OR REPLACE FUNCTION public.increment_post_shares()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts SET shares_count = COALESCE(shares_count, 0) + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.decrement_post_shares()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts SET shares_count = GREATEST(COALESCE(shares_count, 0) - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_post_shares ON post_shares;
CREATE TRIGGER trigger_increment_post_shares AFTER INSERT ON post_shares FOR EACH ROW EXECUTE FUNCTION public.increment_post_shares();

DROP TRIGGER IF EXISTS trigger_decrement_post_shares ON post_shares;
CREATE TRIGGER trigger_decrement_post_shares AFTER DELETE ON post_shares FOR EACH ROW EXECUTE FUNCTION public.decrement_post_shares();

-- Views (use insert only, no delete assumed; if you remove views, adjust accordingly)
CREATE OR REPLACE FUNCTION public.increment_post_views()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE posts SET views_count = COALESCE(views_count, 0) + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_post_views ON post_views;
CREATE TRIGGER trigger_increment_post_views AFTER INSERT ON post_views FOR EACH ROW EXECUTE FUNCTION public.increment_post_views();

-- 4) Recommended indexes for query performance
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_type ON posts(author_type);
CREATE INDEX IF NOT EXISTS idx_posts_date_creation ON posts(date_creation DESC);
CREATE INDEX IF NOT EXISTS idx_posts_statut ON posts(statut);
CREATE INDEX IF NOT EXISTS idx_posts_author_feed ON posts(author_id, author_type, statut, date_creation DESC);

COMMIT;
