-- Content Service Database Schema
-- Posts, Likes, Comments, Views

-- Table: posts
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  author_type TEXT NOT NULL CHECK (author_type IN ('universite', 'centre_formation')),
  titre TEXT NOT NULL,
  description TEXT,
  contenu TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IS NULL OR media_type IN ('image', 'video')),
  statut TEXT DEFAULT 'PUBLISHED' CHECK (statut IN ('PUBLISHED', 'DRAFT', 'ARCHIVED')),
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Backward compatibility aliases for org_*
  org_id UUID GENERATED ALWAYS AS (author_id) STORED,
  org_type TEXT GENERATED ALWAYS AS (author_type) STORED
);

CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_posts_author_type ON posts(author_type);
CREATE INDEX idx_posts_org_id ON posts(org_id);
CREATE INDEX idx_posts_org_type ON posts(org_type);
CREATE INDEX idx_posts_date_creation ON posts(date_creation DESC);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_statut ON posts(statut);

-- Table: post_likes
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX idx_post_likes_user_id ON post_likes(user_id);

-- Table: post_comments
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  contenu TEXT NOT NULL,
  commentaire TEXT,
  date_comment TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE
);

CREATE INDEX idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX idx_post_comments_user_id ON post_comments(user_id);
CREATE INDEX idx_post_comments_parent_id ON post_comments(parent_comment_id);

-- Table: post_views
CREATE TABLE IF NOT EXISTS post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID,
  view_duration INTEGER,
  date_view TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_post_views_post_id ON post_views(post_id);
CREATE INDEX idx_post_views_user_id ON post_views(user_id);
CREATE INDEX idx_post_views_date_view ON post_views(date_view DESC);

-- Table: post_shares
CREATE TABLE IF NOT EXISTS post_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_post_shares_post_id ON post_shares(post_id);
CREATE INDEX idx_post_shares_user_id ON post_shares(user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Show only published posts or posts by the same organization
CREATE POLICY posts_published_or_own ON posts
FOR SELECT USING (
  statut = 'PUBLISHED' OR 
  (auth.uid()::UUID = author_id)
);

-- Notes:
-- The backend service uses service_role key for full access
-- RLS policies prevent unauthorized access to draft/archived posts
-- org_id and org_type are generated columns for backward compatibility
